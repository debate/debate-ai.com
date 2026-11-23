/**
 * @fileoverview `/api/rebuttal-redos` against a real SQLite database, with
 * the model call and R2 stubbed: a judge drafts redos for a round, edits and
 * assigns one, the debater (found by email) records and turns it in, the judge
 * reviews it, and fiat points are paid. Plus the guards.
 */

import { drizzle } from "drizzle-orm/libsql";
import { getTableColumns, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { REBUTTAL_REDOS_DDL, resetEnsuredRebuttalRedoTables } from "@/lib/rebuttal-redos/ensure-tables";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "judge";
let modelOnline = true;
const objects = new Map<string, { body: ArrayBuffer; type?: string }>();

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db, getCloudflareContext: () => null }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/round-recordings/storage", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/round-recordings/storage")>();
  return {
    ...real,
    getRoundRecordingsBucket: () => ({
      put: async (key: string, body: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) => {
        objects.set(key, { body, type: options?.httpMetadata?.contentType });
      },
      get: async (key: string) => {
        const found = objects.get(key);
        if (!found) return null;
        return { body: new Response(found.body).body!, size: found.body.byteLength, httpMetadata: { contentType: found.type } };
      },
      list: async () => ({ objects: [], truncated: false }),
    }),
  };
});
vi.mock("@/lib/debate-challenges/ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/debate-challenges/ai")>();
  return {
    ...real,
    challengeTextGenerator: () => async () =>
      modelOnline ? JSON.stringify({ assignments: [{ seat: "Neg 2NR", instructions: "1. Answer the perm before extending the DA." }] }) : null,
  };
});

const { GET, POST } = await import("@/app/api/rebuttal-redos/route");
const { PATCH } = await import("@/app/api/rebuttal-redos/[redoId]/route");
const audioRoute = await import("@/app/api/rebuttal-redos/[redoId]/audio/route");

async function as<T>(userId: string | null, call: () => Promise<Response>): Promise<{ status: number; body: T }> {
  signedInAs = userId;
  const res = await call();
  return { status: res.status, body: (await res.json()) as T };
}
const board = (userId: string | null) => as<Record<string, any>>(userId, () => GET());
const draft = (userId: string, body: unknown) =>
  as<Record<string, any>>(userId, () => POST(new Request("https://d.ebate.app/api/rebuttal-redos", { method: "POST", body: JSON.stringify(body) }) as never));
const act = (userId: string, id: string, body: unknown) =>
  as<Record<string, any>>(userId, () =>
    PATCH(new Request(`https://d.ebate.app/api/rebuttal-redos/${id}`, { method: "PATCH", body: JSON.stringify(body) }) as never, {
      params: Promise.resolve({ redoId: id }),
    }),
  );

const ROUND = {
  roundId: "1732",
  roundTitle: "Glenbrooks — Octos",
  format: "policy",
  winner: "aff",
  debaters: [
    { email: "aff1@example.com", side: "aff", position: 0 },
    { email: "neg2@example.com", side: "neg", position: 1 },
    { email: "judge@example.com", side: "neg", position: 0 },
  ],
  speeches: { "Neg 2NR": "- Extend the DA\n- Perm is severance" },
  judgeNotes: "",
};

describe("/api/rebuttal-redos", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
    modelOnline = true;
    objects.clear();
    resetEnsuredRebuttalRedoTables();
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      [
        ["judge", "Jamie Judge", "judge@example.com"],
        ["neg2", "Nia", "Neg2@Example.com"],
        ["late", "Ari", "aff1@example.com"],
        ["stranger", "Sam", "sam@example.com"],
      ].map(([id, name, email]) => ({ id, name, email, createdAt: now, updatedAt: now })),
    );
  });

  it("keeps the DDL in step with schema.ts", async () => {
    const client = await freshSchemaClient();
    await client.execute("DROP TABLE rebuttal_redos");
    for (const statement of REBUTTAL_REDOS_DDL) await client.execute(statement);
    const columns = await client.execute("PRAGMA table_info(rebuttal_redos)");
    const names = columns.rows.map((row) => String(row.name)).sort();
    expect(names).toEqual(Object.values(getTableColumns(schema.rebuttalRedos)).map((column) => column.name).sort());
  });

  it("runs a redo from AI draft to judge feedback and pays fiat points", async () => {
    const drafted = await draft("judge", ROUND);
    expect(drafted.status).toBe(201);
    const redos = drafted.body.redos as any[];
    // The judge's own email is never assigned.
    expect(redos.map((redo) => redo.speech).sort()).toEqual(["1AR", "2NR"]);
    const neg = redos.find((redo) => redo.speech === "2NR");
    expect(neg.aiInstructions).toContain("Answer the perm");
    expect(neg.student.id).toBe("neg2");
    expect(redos.find((redo) => redo.speech === "1AR").aiInstructions).toContain("Redo your 1AR");

    // Drafting the same round again returns what exists.
    expect((await draft("judge", ROUND)).status).toBe(200);

    // Drafts stay hidden from the debater.
    expect((await board("neg2")).body.assignments).toHaveLength(0);
    expect((await act("neg2", neg.id, { action: "submit", submissionText: "x" })).status).toBe(409);

    const edited = await act("judge", neg.id, { action: "edit", judgeInstructions: "Go for the DA only.", dueInDays: 3, timeLimitSeconds: 360 });
    expect(edited.body.redo).toMatchObject({ judgeInstructions: "Go for the DA only.", timeLimitSeconds: 360 });
    expect((await act("judge", neg.id, { action: "assign" })).body.redo.status).toBe("assigned");

    const studentBoard = await board("neg2");
    expect(studentBoard.body.assignments).toHaveLength(1);
    expect(studentBoard.body.fiat.points).toBe(0);
    const note = await db.select().from(schema.notifications).where(sql`user_id = 'neg2'`);
    expect(note[0]?.title).toContain("assigned you a rebuttal redo");

    // Strangers can't see or touch it, or its recording.
    expect((await act("stranger", neg.id, { action: "review", feedback: "hi", rating: 5 })).status).toBe(404);

    signedInAs = "neg2";
    const upload = await audioRoute.PUT(
      new Request(`https://d.ebate.app/api/rebuttal-redos/${neg.id}/audio`, { method: "PUT", headers: { "content-type": "audio/webm" }, body: new Uint8Array([1, 2, 3]) }),
      { params: Promise.resolve({ redoId: neg.id }) },
    );
    expect(upload.status).toBe(200);
    const submitted = await act("neg2", neg.id, { action: "submit", submissionText: "" });
    expect(submitted.body.redo).toMatchObject({ status: "submitted", hasAudio: true, fiatPoints: 15 });

    signedInAs = "judge";
    const listened = await audioRoute.GET(new Request("https://d.ebate.app/"), { params: Promise.resolve({ redoId: neg.id }) });
    expect(new Uint8Array(await listened.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    signedInAs = "stranger";
    expect((await audioRoute.GET(new Request("https://d.ebate.app/"), { params: Promise.resolve({ redoId: neg.id }) })).status).toBe(404);

    expect((await act("judge", neg.id, { action: "review", feedback: "Much cleaner collapse.", rating: 5 })).body.redo.status).toBe("reviewed");
    const after = await board("neg2");
    expect(after.body.fiat.points).toBe(10 + 5 + 25);
    expect(after.body.fiat.badges.filter((badge: any) => badge.earned).map((badge: any) => badge.id)).toEqual(["first-redo", "judges-pick"]);
    expect(after.body.assignments[0].feedback).toBe("Much cleaner collapse.");
  });

  it("falls back to general assignments when no model answers, and links late accounts by email", async () => {
    modelOnline = false;
    await db.delete(schema.user).where(sql`id = 'late'`);
    const drafted = await draft("judge", ROUND);
    const aff = (drafted.body.redos as any[]).find((redo) => redo.speech === "1AR");
    expect(aff.student.id).toBeNull();
    expect(aff.aiInstructions).toContain("collapse");
    await act("judge", aff.id, { action: "assign" });
    const now = new Date();
    await db.insert(schema.user).values({ id: "late2", name: "Ari", email: "AFF1@example.com", createdAt: now, updatedAt: now });
    expect((await board("late2")).body.assignments).toHaveLength(1);
  });

  it("refuses signed-out readers and rounds without debaters", async () => {
    expect((await board(null)).status).toBe(401);
    expect((await draft("judge", { ...ROUND, debaters: [] })).status).toBe(400);
    expect((await draft("judge", { ...ROUND, debaters: [{ email: "judge@example.com", side: "aff", position: 0 }] })).status).toBe(400);
  });
});
