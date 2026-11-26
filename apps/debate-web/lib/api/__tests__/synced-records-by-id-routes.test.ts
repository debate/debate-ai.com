/**
 * @fileoverview The id-keyed account-sync routes for tournament results,
 * strategy recommendations and round pairings, against a real SQLite
 * database: PUT validates the record against the URL and upserts per account,
 * DELETE removes only the caller's copy.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));

const results = await import("@/app/api/tournament-results/[resultId]/route");
const recommendations = await import("@/app/api/strategy-recommendations/[recommendationId]/route");
const pairings = await import("@/app/api/round-pairings/[pairingId]/route");

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
const call = (handler: unknown, key: string, id: string, method: string, body?: unknown) =>
  (handler as Handler)(
    new NextRequest(`https://debate-ai.com/api/x/${id}`, {
      method,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ [key]: id }) },
  );

const strategy = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  matchupId: "m1",
  generatedAt: 1,
  recommendation: {
    recommendedCase: { name: "Case A", argumentTags: ["t"], overlapScore: 0.5 },
    caseRankings: [{ name: "Case A", argumentTags: ["t"], overlapScore: 0.5 }],
    judgeAdaptationNotes: ["Slow down"],
    riskLevel: "low",
    riskFactors: [],
  },
  ...extra,
});

beforeEach(async () => {
  signedInAs = "alex";
  db = drizzle(await freshSchemaClient(), { schema });
  const now = new Date();
  await db.insert(schema.user).values(["alex", "sam"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })));
});

describe.each([
  {
    route: "/api/tournament-results/[resultId]",
    handlers: results,
    key: "resultId",
    idField: "id",
    table: schema.savedTournamentResults,
    make: (id: string) => ({
      id, teamId: "t1", tournamentName: "Nationals", date: "2026-05-01", division: "Open", finish: "finalist",
      bidLevel: 1, prelimWins: 5, prelimLosses: 1,
    }),
    invalid: (id: string) => ({ id, teamId: "t1" }),
    huge: (id: string) => ({ ...({ id, teamId: "t1", tournamentName: "N", date: "d", division: "Open", finish: "finalist", bidLevel: 0, prelimWins: 0, prelimLosses: 0 }), notes: "x".repeat(20_001) }),
  },
  {
    route: "/api/strategy-recommendations/[recommendationId]",
    handlers: recommendations,
    key: "recommendationId",
    idField: "id",
    table: schema.savedStrategyRecommendations,
    make: (id: string) => strategy(id),
    invalid: (id: string) => strategy(id, { generatedAt: "now" }),
    huge: (id: string) => strategy(id, { notes: "x".repeat(200_001) }),
  },
  {
    route: "/api/round-pairings/[pairingId]",
    handlers: pairings,
    key: "pairingId",
    idField: "roundId",
    table: schema.savedRoundPairings,
    make: (id: string) => ({ roundId: id, tournamentName: "Nationals", division: "Open", roundLabel: "Round 1", side: "aff", room: "204" }),
    invalid: (id: string) => ({ roundId: id, tournamentName: "Nationals", division: "Open", roundLabel: "Round 1", side: "both" }),
    huge: (id: string) => ({ roundId: id, tournamentName: "Nationals", division: "Open", roundLabel: "Round 1", side: "aff", room: "x".repeat(20_001) }),
  },
])("$route", ({ handlers, key, idField, table, make, invalid, huge }) => {
  const put = (id: string, body: unknown) => call(handlers.PUT, key, id, "PUT", body);
  const del = (id: string) => call(handlers.DELETE, key, id, "DELETE");
  const rowOf = async (userId: string, id: string) =>
    (await db.select().from(table).where(and(eq(table.userId, userId), eq(table.clientId, id))))[0];

  it("requires a session", async () => {
    signedInAs = null;
    expect((await put("r1", { record: make("r1") })).status).toBe(401);
    expect((await del("r1")).status).toBe(401);
  });

  it("validates the body, the record, the id and the size", async () => {
    expect((await put("r1", "{nope")).status).toBe(400);
    expect((await put("r1", null)).status).toBe(400);
    expect((await put("r1", { record: invalid("r1") })).status).toBe(400);
    const mismatch = await put("r1", { record: make("r2") });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toContain("must match the URL");
    expect((await put("r1", { record: huge("r1") })).status).toBe(413);
    expect(await db.select().from(table)).toEqual([]);
  });

  it("upserts the record for the caller only", async () => {
    const first = await put("r1", { record: make("r1") });
    expect(await first.json()).toMatchObject({ [key]: "r1", updatedAt: expect.any(String) });
    expect((await put("r1", { record: { ...make("r1"), edited: true } })).status).toBe(200);

    expect(JSON.parse((await rowOf("alex", "r1")).data)).toMatchObject({ [idField]: "r1", edited: true });
    expect(await rowOf("sam", "r1")).toBeUndefined();
    expect(await db.select().from(table)).toHaveLength(1);
  });

  it("deletes only the caller's copy", async () => {
    await put("r1", { record: make("r1") });
    signedInAs = "sam";
    await put("r1", { record: make("r1") });
    expect(await (await del("r1")).json()).toEqual({ success: true });
    expect(await rowOf("sam", "r1")).toBeUndefined();
    expect(await rowOf("alex", "r1")).toBeDefined();
  });
});

describe("strategy recommendations", () => {
  it("stores the matchup id alongside the record", async () => {
    await call(recommendations.PUT, "recommendationId", "r1", "PUT", { record: strategy("r1") });
    const [row] = await db.select().from(schema.savedStrategyRecommendations);
    expect(row.matchupId).toBe("m1");
  });
});
