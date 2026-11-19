/**
 * @fileoverview `fillCollegeResults` against a real in-memory SQLite `videos`
 * table, with College Debate Results served from the 2026 Shirley fixture.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLEGE_RESULTS_API } from "@debate-ai/videos-admin/src/lib/college-results";
// The package's own fixture: real responses for the 2026 Shirley.
import shirley from "../../../../../packages/debate-videos-admin/test/fixtures/college-results-shirley-2026.json";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { videos } from "../../database/schema";

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

type Db = Awaited<ReturnType<typeof freshDb>>;

/** Serves the fixture's backend paths; any other round is empty. */
function stubFetch() {
  const routes: Record<string, unknown> = {
    "/tournaments?season=2026-2027&page=1": shirley.season,
    "/tournaments/2014/rounds": shirley.rounds,
    "/tournaments/2014/rounds/Finals": shirley.finals,
    "/tournaments/2014/rounds/Semis": shirley.semis,
    "/tournaments/2014/elims": shirley.elims,
  };
  return vi.fn(async (url: string | URL | Request) => {
    const path = String(url).slice(COLLEGE_RESULTS_API.length);
    if (path in routes) return new Response(JSON.stringify(routes[path]), { status: 200 });
    if (path.startsWith("/tournaments/2014/rounds/")) return new Response("[]", { status: 200 });
    return new Response("{}", { status: 404 });
  });
}

const round = (videoId: string, overrides: Partial<typeof videos.$inferInsert> = {}): typeof videos.$inferInsert => ({
  videoId,
  source: "round",
  title: videoId,
  publishedAt: "2026-11-17",
  style: 4,
  tournament: "Shirley",
  seasonYear: 2027,
  ...overrides,
});

let db: Db;
let fillCollegeResults: typeof import("../fill-college-results").fillCollegeResults;
beforeEach(async () => {
  vi.resetModules();
  ({ fillCollegeResults } = await import("../fill-college-results"));
  db = await freshDb();
});

async function row(id: string) {
  const [found] = await db.select().from(videos).where(eq(videos.videoId, id));
  return found;
}

describe("fillCollegeResults", () => {
  it("saves judges, squirrels, winner and ballots for college rounds only", async () => {
    await db.insert(videos).values([
      round("final", { roundLevel: "Finals", affTeam: "Michigan BS", negTeam: "Emory GY" }),
      // Sides reversed relative to the site; winner already saved and right.
      round("semi", { roundLevel: "Semifinals", affTeam: "Northwestern JP", negTeam: "Michigan BS", affWin: false, judgeDecision: "4-1" }),
      round("hs", { style: 1, roundLevel: "Finals", affTeam: "Michigan BS", negTeam: "Emory GY" }),
      round("lecture", { source: "lecture", affTeam: null, negTeam: null }),
    ]);

    const result = await fillCollegeResults(db, { fetchImpl: stubFetch() as unknown as typeof fetch, requestDelayMs: 0, now: 1_800_000_000 });

    expect(result).toMatchObject({ checked: 2, remaining: 0, total: 2, winnersFilled: 1, decisionsFilled: 1, statuses: { verified: 2 } });
    expect(await row("final")).toMatchObject({
      affWin: false,
      judgeDecision: "3-2",
      resultsStatus: "verified",
      resultsJudges: "Jacob Wilkus, Cade Blenden, Jared Spiers, AJ Byrne, David Griffith",
      resultsSquirrels: "Cade Blenden, Jared Spiers",
      resultsTournamentId: 2014,
      resultsCheckedAt: 1_800_000_000,
      adminEdited: true,
    });
    expect(await row("semi")).toMatchObject({ affWin: false, judgeDecision: "4-1", resultsStatus: "verified", resultsSquirrels: "Gene Bressler", adminEdited: false });
    expect((await row("hs"))?.resultsCheckedAt).toBeNull();
  });

  it("flags a saved winner the site contradicts instead of overwriting it", async () => {
    await db.insert(videos).values(round("final", { roundLevel: "Finals", affTeam: "Michigan BS", negTeam: "Emory GY", affWin: true }));
    const result = await fillCollegeResults(db, { fetchImpl: stubFetch() as unknown as typeof fetch, requestDelayMs: 0 });
    expect(result.statuses).toEqual({ conflict: 1 });
    expect(await row("final")).toMatchObject({ affWin: true, resultsStatus: "conflict", judgeDecision: "3-2" });
  });

  it("records not-found rounds and resumes without rechecking, unless asked", async () => {
    await db.insert(videos).values([
      round("a", { roundLevel: "Finals", affTeam: "Kansas OU", negTeam: "Emory GY" }),
      round("b", { roundLevel: "Finals", affTeam: "Michigan BS", negTeam: "Emory GY" }),
    ]);
    const fetchImpl = stubFetch() as unknown as typeof fetch;
    const first = await fillCollegeResults(db, { fetchImpl, requestDelayMs: 0, batchSize: 1, now: 100 });
    expect(first).toMatchObject({ checked: 1, remaining: 1 });
    const second = await fillCollegeResults(db, { fetchImpl, requestDelayMs: 0, batchSize: 1, now: 101 });
    expect(second).toMatchObject({ checked: 1, remaining: 0 });
    expect((await row("a"))?.resultsStatus).toBe("not_found");

    // A recheck run revisits rows checked before it started.
    const recheck = await fillCollegeResults(db, { fetchImpl, requestDelayMs: 0, since: 200, now: 200 });
    expect(recheck).toMatchObject({ checked: 2, remaining: 0 });
  });

  it("stops a batch at its request budget and leaves the rest for the next call", async () => {
    await db.insert(videos).values([
      round("final", { roundLevel: "Finals", affTeam: "Michigan BS", negTeam: "Emory GY" }),
      round("semi", { roundLevel: "Semis", affTeam: "Michigan BS", negTeam: "Northwestern JP" }),
    ]);
    // The final takes 4 requests (season, rounds, Finals, elims); the semi's
    // Semis request would be the 5th, so it waits for the next call.
    const result = await fillCollegeResults(db, { fetchImpl: stubFetch() as unknown as typeof fetch, requestDelayMs: 0, maxRequests: 4 });
    expect(result).toMatchObject({ checked: 1, remaining: 1 });
  });
});
