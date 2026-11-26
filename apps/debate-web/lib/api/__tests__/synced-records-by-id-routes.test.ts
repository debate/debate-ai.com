/**
 * @fileoverview The id-keyed account-sync routes (tournament results, strategy
 * recommendations, round pairings, drill sets, judge decisions, counsel-panel
 * assessments, coach-material versions and review-log entries) against a real
 * SQLite database: PUT validates the record against the URL and upserts per account,
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
const drillSets = await import("@/app/api/drill-sets/[roundId]/route");
const judgeDecisions = await import("@/app/api/judge-decisions/[decisionId]/route");
const counselAssessments = await import("@/app/api/counsel-panel-assessments/[assessmentId]/route");
const coachVersions = await import("@/app/api/coach-material-versions/[versionId]/route");
const reviewLog = await import("@/app/api/learn-review-log/[entryId]/route");

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

const counselResult = {
  argumentAssessments: [
    { rowIndex: 0, counselRole: "Policy Counsel", likelyResponsePath: "Turn", clashEstimate: "High" },
  ],
  overallClashSummary: "Clash on solvency",
};

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
  {
    route: "/api/drill-sets/[roundId]",
    handlers: drillSets,
    key: "roundId",
    idField: "roundId",
    table: schema.savedDrillSets,
    make: (id: string) => ({
      roundId: id, sideKey: "aff", drills: [{ kind: "overview", rowIndex: null, prompt: "Summarise", difficulty: "easy" }],
      completedDrillIndexes: [0],
    }),
    invalid: (id: string) => ({ roundId: id, sideKey: "aff", drills: [{ kind: "nonsense" }] }),
    huge: (id: string) => ({ roundId: id, sideKey: "aff", drills: [], aiScripts: { 0: "x".repeat(200_001) } }),
  },
  {
    route: "/api/judge-decisions/[decisionId]",
    handlers: judgeDecisions,
    key: "decisionId",
    idField: "id",
    table: schema.savedJudgeDecisions,
    make: (id: string) => ({
      id, roundId: "round-1", paradigmName: "Flow judge", sideNames: { primary: "Aff", secondary: "Neg" },
      result: { winner: "primary", keyVotingIssues: ["Solvency"], rationale: "Aff solved" }, generatedAt: 1,
    }),
    invalid: (id: string) => ({ id, roundId: "round-1", paradigmName: "Flow judge", sideNames: { primary: "Aff" }, generatedAt: 1 }),
    huge: (id: string) => ({
      id, roundId: "round-1", paradigmName: "x".repeat(200_001), sideNames: { primary: "Aff", secondary: "Neg" },
      result: { winner: "secondary", keyVotingIssues: [], rationale: "" }, generatedAt: 1,
    }),
  },
  {
    route: "/api/counsel-panel-assessments/[assessmentId]",
    handlers: counselAssessments,
    key: "assessmentId",
    idField: "id",
    table: schema.savedCounselPanelAssessments,
    make: (id: string) => ({ id, roundId: "round-1", result: counselResult, generatedAt: 1 }),
    invalid: (id: string) => ({ id, roundId: "round-1", result: { ...counselResult, argumentAssessments: [] }, generatedAt: 1 }),
    huge: (id: string) => ({ id, roundId: "round-1", result: { ...counselResult, overallClashSummary: "x".repeat(200_001) }, generatedAt: 1 }),
  },
  {
    route: "/api/coach-material-versions/[versionId]",
    handlers: coachVersions,
    key: "versionId",
    idField: "id",
    table: schema.savedCoachMaterialVersions,
    make: (id: string) => ({ id, materialId: "mat-1", kind: "camp_material", title: "Notes", tags: ["k"], text: "body", replacedAt: 1 }),
    invalid: (id: string) => ({ id, materialId: "mat-1", kind: "unknown", title: "Notes", tags: [], text: "body", replacedAt: 1 }),
    huge: (id: string) => ({ id, materialId: "mat-1", kind: "camp_material", title: "Notes", tags: [], text: "x".repeat(1_000_001), replacedAt: 1 }),
  },
  {
    route: "/api/learn-review-log/[entryId]",
    handlers: reviewLog,
    key: "entryId",
    idField: "cardId",
    bodyKey: "entry",
    table: schema.savedLearnReviewLog,
    idOf: (id: string) => `${id}:2026-01-01T00:00:00.000Z`,
    make: (id: string) => ({ cardId: id, at: "2026-01-01T00:00:00.000Z", grade: "remembered", intervalBefore: 1, intervalAfter: 3 }),
    invalid: (id: string) => ({ cardId: id, at: "2026-01-01T00:00:00.000Z", grade: "meh", intervalBefore: 1, intervalAfter: 3 }),
    huge: (id: string) => ({ cardId: id, at: "2026-01-01T00:00:00.000Z", grade: "forgot", intervalBefore: 1, intervalAfter: 1, note: "x".repeat(200_001) }),
  },
])("$route", ({ handlers, key, idField, table, make, invalid, huge, bodyKey = "record", idOf = (id: string) => id }) => {
  const url = idOf("r1");
  const body = (value: unknown) => ({ [bodyKey]: value });
  const put = (id: string, payload: unknown) => call(handlers.PUT, key, id, "PUT", payload);
  const del = (id: string) => call(handlers.DELETE, key, id, "DELETE");
  const rowOf = async (userId: string, id: string) =>
    (await db.select().from(table).where(and(eq(table.userId, userId), eq(table.clientId, id))))[0];

  it("requires a session", async () => {
    signedInAs = null;
    expect((await put(url, body(make("r1")))).status).toBe(401);
    expect((await del(url)).status).toBe(401);
  });

  it("validates the body, the record, the id and the size", async () => {
    expect((await put(url, "{nope")).status).toBe(400);
    expect((await put(url, null)).status).toBe(400);
    expect((await put(url, body(invalid("r1")))).status).toBe(400);
    const mismatch = await put(url, body(make("r2")));
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error).toContain("must match the URL");
    expect((await put(url, body(huge("r1")))).status).toBe(413);
    expect(await db.select().from(table)).toEqual([]);
  });

  it("upserts the record for the caller only", async () => {
    const first = await put(url, body(make("r1")));
    expect(await first.json()).toMatchObject({ [key]: url, updatedAt: expect.any(String) });
    expect((await put(url, body({ ...make("r1"), edited: true }))).status).toBe(200);

    expect(JSON.parse((await rowOf("alex", url)).data)).toMatchObject({ [idField]: "r1", edited: true });
    expect(await rowOf("sam", url)).toBeUndefined();
    expect(await db.select().from(table)).toHaveLength(1);
  });

  it("deletes only the caller's copy", async () => {
    await put(url, body(make("r1")));
    signedInAs = "sam";
    await put(url, body(make("r1")));
    expect(await (await del(url)).json()).toEqual({ success: true });
    expect(await rowOf("sam", url)).toBeUndefined();
    expect(await rowOf("alex", url)).toBeDefined();
  });
});

describe("strategy recommendations", () => {
  it("stores the matchup id alongside the record", async () => {
    await call(recommendations.PUT, "recommendationId", "r1", "PUT", { record: strategy("r1") });
    const [row] = await db.select().from(schema.savedStrategyRecommendations);
    expect(row.matchupId).toBe("m1");
  });
});
