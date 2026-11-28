/**
 * @fileoverview `PUT /api/judge-decisions/[decisionId]` keeps each round at
 * `MAX_JUDGE_DECISIONS_PER_ROUND` decisions in the account, against a real
 * SQLite database. Before this, only the client trimmed, so an older client
 * that never trims could grow a round's `saved_judge_decisions` rows without
 * bound.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_JUDGE_DECISIONS_PER_ROUND } from "@debate-ai/practice-rounds";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const { PUT } = await import("@/app/api/judge-decisions/[decisionId]/route");

const decision = (id: string, generatedAt: number, roundId = "round-1") => ({
  id,
  roundId,
  paradigmName: "Flow judge",
  sideNames: { primary: "Aff", secondary: "Neg" },
  result: { winner: "primary", keyVotingIssues: ["Dropped DA"], rationale: "Neg dropped the DA." },
  generatedAt,
});

const put = (record: ReturnType<typeof decision>) =>
  PUT(
    new NextRequest(`https://debate-ai.com/api/judge-decisions/${record.id}`, {
      method: "PUT",
      body: JSON.stringify({ record }),
    }),
    { params: Promise.resolve({ decisionId: record.id }) },
  );

/** Inserts rows directly, as an older client that never trimmed would have left them. */
async function seed(userId: string, records: ReturnType<typeof decision>[]) {
  const now = new Date();
  await db.insert(schema.savedJudgeDecisions).values(
    records.map((record) => ({
      userId,
      clientId: record.id,
      roundId: record.roundId,
      data: JSON.stringify(record),
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function idsFor(userId: string, roundId = "round-1") {
  const rows = await db
    .select({ clientId: schema.savedJudgeDecisions.clientId })
    .from(schema.savedJudgeDecisions)
    .where(and(eq(schema.savedJudgeDecisions.userId, userId), eq(schema.savedJudgeDecisions.roundId, roundId)));
  return rows.map((row) => row.clientId).sort();
}

const pad = (i: number) => `d${String(i).padStart(3, "0")}`;

beforeEach(async () => {
  signedInAs = "alex";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db
    .insert(schema.user)
    .values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
});

describe("PUT /api/judge-decisions/[decisionId] — per-round cap", () => {
  it("trims nothing while the round is at the cap", async () => {
    await seed("alex", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND - 1 }, (_, i) => decision(pad(i), i)));

    const res = await put(decision("d-new", 1000));

    expect(res.status).toBe(200);
    expect((await res.json()).trimmedIds).toEqual([]);
    expect(await idsFor("alex")).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND);
  });

  it("deletes the round's oldest decision once a save takes it past the cap", async () => {
    await seed("alex", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND }, (_, i) => decision(pad(i), 10 + i)));

    const res = await put(decision("d-new", 1000));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decisionId).toBe("d-new");
    expect(body.trimmedIds).toEqual(["d000"]);
    const ids = await idsFor("alex");
    expect(ids).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND);
    expect(ids).toContain("d-new");
    expect(ids).not.toContain("d000");
  });

  it("brings a round an older client grew far past the cap back to it in one save", async () => {
    await seed("alex", Array.from({ length: 130 }, (_, i) => decision(pad(i), 10 + i)));

    const res = await put(decision("d-new", 10_000));

    const { trimmedIds } = await res.json();
    expect(trimmedIds).toHaveLength(130 + 1 - MAX_JUDGE_DECISIONS_PER_ROUND);
    expect(trimmedIds[0]).toBe("d000");
    const ids = await idsFor("alex");
    expect(ids).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND);
    expect(ids).toContain("d-new");
    expect(ids).toContain(pad(129));
  });

  it("says when the saved decision itself is older than the round's newest 20", async () => {
    await seed("alex", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND }, (_, i) => decision(pad(i), 100 + i)));

    const res = await put(decision("d-ancient", 1));

    expect(res.status).toBe(200);
    expect((await res.json()).trimmedIds).toEqual(["d-ancient"]);
    expect(await idsFor("alex")).not.toContain("d-ancient");
  });

  it("only counts and trims the caller's rows for that round", async () => {
    await seed("sam", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND + 5 }, (_, i) => decision(`sam-${pad(i)}`, i)));
    await seed("alex", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND + 5 }, (_, i) => decision(`r2-${pad(i)}`, i, "round-2")));

    const res = await put(decision("d-new", 1000));

    expect((await res.json()).trimmedIds).toEqual([]);
    expect(await idsFor("sam")).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND + 5);
    expect(await idsFor("alex", "round-2")).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND + 5);
    expect(await idsFor("alex")).toEqual(["d-new"]);
  });

  it("leaves a row with unreadable data alone and doesn't count it", async () => {
    await seed("alex", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND - 1 }, (_, i) => decision(pad(i), 10 + i)));
    const now = new Date();
    await db.insert(schema.savedJudgeDecisions).values({
      userId: "alex",
      clientId: "d-broken",
      roundId: "round-1",
      data: "{not json",
      createdAt: now,
      updatedAt: now,
    });

    const res = await put(decision("d-new", 1000));

    expect((await res.json()).trimmedIds).toEqual([]);
    const ids = await idsFor("alex");
    expect(ids).toContain("d-broken");
    expect(ids).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND + 1);
  });

  it("trims nothing when the save itself is refused", async () => {
    await seed("alex", Array.from({ length: MAX_JUDGE_DECISIONS_PER_ROUND + 3 }, (_, i) => decision(pad(i), i)));

    signedInAs = null;
    expect((await put(decision("d-new", 1000))).status).toBe(401);
    signedInAs = "alex";
    const invalid = { ...decision("d-bad", 1000), generatedAt: "now" as unknown as number };
    expect((await put(invalid)).status).toBe(400);

    expect(await idsFor("alex")).toHaveLength(MAX_JUDGE_DECISIONS_PER_ROUND + 3);
  });
});
