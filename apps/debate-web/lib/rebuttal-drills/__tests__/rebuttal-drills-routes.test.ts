/**
 * @fileoverview `/api/rebuttal-drills` against a real SQLite database, with
 * the model calls stubbed: pairing two students Aff vs Neg on one video, a
 * drill against the AI, coach help, switching a waiting drill to the AI, and
 * the guards.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { REBUTTAL_DRILLS_DDL, resetEnsuredRebuttalDrillTables } from "@/lib/rebuttal-drills/ensure-tables";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alice";
let modelOnline = true;
let judgeWinner: "aff" | "neg" = "neg";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/debate-challenges/ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/debate-challenges/ai")>();
  return {
    ...real,
    challengeTextGenerator: () => async (prompt: string) => {
      if (!modelOnline) return null;
      if (prompt.includes('"winner"')) return JSON.stringify({ winner: judgeWinner, reason: "Neg collapsed cleanly. Aff: weigh. Neg: extend warrants." });
      if (prompt.includes("debate coach")) return "1. Good collapse. 2. Answer their link turn. 3. Weigh on probability.";
      return "The AI's rebuttal: extend the link turn, they dropped it, and it outweighs on probability.";
    },
  };
});

const { GET, POST } = await import("@/app/api/rebuttal-drills/route");
const { PATCH } = await import("@/app/api/rebuttal-drills/[drillId]/route");

const REBUTTAL =
  "Extend our first contention: they dropped the link turn, so it's offense for us. Weigh it on probability — their impact needs four steps.";
const VIDEO = { playlistId: "pf-finals", videoId: "OB3bJ_RN0RY" };

async function as<T>(userId: string | null, call: () => Promise<Response>): Promise<{ status: number; body: T }> {
  signedInAs = userId;
  const res = await call();
  return { status: res.status, body: (await res.json()) as T };
}

const board = (userId: string | null) =>
  as<Record<string, any>>(userId, () => GET(new Request("https://d.ebate.app/api/rebuttal-drills") as never));
const start = (userId: string, body: unknown) =>
  as<Record<string, any>>(userId, () =>
    POST(new Request("https://d.ebate.app/api/rebuttal-drills", { method: "POST", body: JSON.stringify(body) }) as never),
  );
const act = (userId: string, id: string, body: unknown) =>
  as<Record<string, any>>(userId, () =>
    PATCH(new Request(`https://d.ebate.app/api/rebuttal-drills/${id}`, { method: "PATCH", body: JSON.stringify(body) }) as never, {
      params: Promise.resolve({ drillId: id }),
    }),
  );

describe("/api/rebuttal-drills", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));
    modelOnline = true;
    judgeWinner = "neg";
    resetEnsuredRebuttalDrillTables();
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values(
      ["alice", "bob", "carol", "guest"].map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        email: `${id}@example.com`,
        isAnonymous: id === "guest",
        createdAt: now,
        updatedAt: now,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is account-only", async () => {
    expect((await board(null)).status).toBe(401);
  });

  it("pairs two students Aff vs Neg on one video and judges both rebuttals", async () => {
    const first = await start("alice", { ...VIDEO, side: "aff", partner: "partner" });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ joined: false, drill: { status: "waiting", viewerSide: "aff" } });
    const id = first.body.drill.id as string;

    // Alice writes while waiting.
    expect((await act("alice", id, { action: "submit", text: REBUTTAL })).body.drill.aff.submitted).toBe(true);

    // Carol wants Aff too: nothing to join, she waits on her own drill.
    expect((await start("carol", { ...VIDEO, side: "aff", partner: "partner" })).body.joined).toBe(false);
    // Bob sees two students waiting for a Neg partner.
    expect((await board("bob")).body.openSeats).toEqual([{ videoId: VIDEO.videoId, side: "neg", count: 2 }]);

    // Bob joins the oldest one — Alice's.
    const joined = await start("bob", { ...VIDEO, side: "neg", partner: "partner" });
    expect(joined.body).toMatchObject({ joined: true, drill: { id, status: "writing", viewerSide: "neg" } });
    // He can't read Alice's rebuttal before judging.
    expect(joined.body.drill.aff).toMatchObject({ submitted: true, text: null });

    const done = await act("bob", id, { action: "submit", text: REBUTTAL });
    expect(done.body.drill).toMatchObject({ status: "complete", winnerSide: "neg" });
    expect(done.body.drill.decision).toContain("collapsed");
    expect(done.body.drill.aff.text).toBe(REBUTTAL);

    const notes = await db.select().from(schema.notifications);
    expect(notes.every((note) => note.type === "rebuttal_drill" && note.link === "/practice/debates?section=drills")).toBe(true);
    // Alice: Bob joined, Bob turned in, the decision. Bob: the decision.
    expect(notes.map((note) => note.userId).sort()).toEqual(["alice", "alice", "alice", "bob"]);
  });

  it("runs a drill against the AI, with coach help, straight to the judge", async () => {
    judgeWinner = "aff";
    const sent = await start("alice", { ...VIDEO, side: "aff", partner: "ai" });
    const id = sent.body.drill.id as string;
    expect(sent.body.drill).toMatchObject({ vsAi: true, status: "writing", neg: { submitted: true, text: null } });

    const coached = await act("alice", id, { action: "coach", text: "My draft rebuttal on the link turn." });
    expect(coached.body.coach.feedback).toContain("probability");
    expect(coached.body.drill.aff.coachLeft).toBe(2);

    const done = await act("alice", id, { action: "submit", text: REBUTTAL });
    expect(done.body.drill).toMatchObject({ status: "complete", winnerSide: "aff" });
  });

  it("switches a waiting drill to the AI, and retries a model that was down", async () => {
    const sent = await start("alice", { ...VIDEO, side: "neg", partner: "partner" });
    modelOnline = false;
    const switched = await act("alice", sent.body.drill.id, { action: "use_ai" });
    expect(switched.body.drill).toMatchObject({ vsAi: true, aff: { submitted: false } });
    modelOnline = true;
    expect((await board("alice")).body.drills[0].aff.submitted).toBe(true);
  });

  it("returns an open drill instead of a duplicate, and guards guests, strangers and bad videos", async () => {
    const first = await start("alice", { ...VIDEO, side: "aff", partner: "partner" });
    const again = await start("alice", { ...VIDEO, side: "aff", partner: "ai" });
    expect(again.status).toBe(200);
    expect(again.body.drill.id).toBe(first.body.drill.id);
    expect((await start("guest", { ...VIDEO, side: "neg", partner: "partner" })).status).toBe(403);
    expect((await start("guest", { ...VIDEO, side: "neg", partner: "ai" })).status).toBe(201);
    expect((await start("alice", { playlistId: "pf-finals", videoId: "HXGNNhOxrBw", side: "aff", partner: "ai" })).status).toBe(400);
    expect((await act("carol", first.body.drill.id, { action: "cancel" })).status).toBe(404);
    expect((await act("alice", first.body.drill.id, { action: "cancel" })).body.drill.status).toBe("cancelled");
  });
});

describe("REBUTTAL_DRILLS_DDL", () => {
  it("creates the same columns as the schema", async () => {
    const fromSchema = await freshSchemaClient();
    const fromDdl = createClient({ url: ":memory:" });
    await fromDdl.execute(`CREATE TABLE "user" ("id" text PRIMARY KEY NOT NULL)`);
    for (const statement of REBUTTAL_DRILLS_DDL) await fromDdl.execute(statement);
    const columns = async (client: typeof fromDdl) =>
      (await client.execute(`PRAGMA table_info("rebuttal_drills")`)).rows.map((row) => [
        row.name,
        String(row.type).toLowerCase(),
        row.notnull,
        row.pk,
      ]);
    expect(await columns(fromDdl)).toEqual(await columns(fromSchema));
  });
});
