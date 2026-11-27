/**
 * @fileoverview `/api/videos/decision` against a real SQLite `videos` table:
 * the stored decision, a live College Debate Results lookup, the unknown
 * answer for a round nothing can settle, and the caching around them.
 */
import { drizzle } from "drizzle-orm/libsql";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLEGE_RESULTS_API } from "@debate-ai/videos-admin/src/lib/college-results";
import shirley from "../../../../../packages/debate-videos-admin/test/fixtures/college-results-shirley-2026.json";
import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";
import { videos } from "@/lib/database/schema";

let db: ReturnType<typeof drizzle<typeof schema>>;
let dbFails = false;

vi.mock("@/lib/database/context", () => ({
  getDBFromContext: async () => {
    if (dbFails) throw new Error("D1 unavailable");
    return db;
  },
}));
vi.mock("@/lib/judge-paradigms/tabroom", () => ({
  tabroomFetch: () => async () => new Response("{}", { status: 401 }),
}));

const { GET } = await import("@/app/api/videos/decision/route");
const { resetDecisionCache } = await import("@/lib/videos/round-decision");

const COLLEGE: Record<string, unknown> = {
  "/tournaments?season=2026-2027&page=1": shirley.season,
  "/tournaments/2014/rounds": shirley.rounds,
  "/tournaments/2014/rounds/Finals": shirley.finals,
  "/tournaments/2014/elims": shirley.elims,
};
const collegeFetch = vi.fn(async (url: string | URL | Request) => {
  const path = String(url).slice(COLLEGE_RESULTS_API.length);
  if (path in COLLEGE) return new Response(JSON.stringify(COLLEGE[path]), { status: 200 });
  return new Response("{}", { status: 404 });
});

const get = (id?: string) => GET(new NextRequest(`https://debate-ai.com/api/videos/decision${id === undefined ? "" : `?id=${id}`}`));

const round = (videoId: string, overrides: Partial<typeof videos.$inferInsert> = {}): typeof videos.$inferInsert => ({
  videoId,
  source: "round",
  title: videoId,
  publishedAt: "2026-11-17",
  style: 4,
  tournament: "Shirley",
  seasonYear: 2027,
  roundLevel: "Finals",
  affTeam: "Michigan BS",
  negTeam: "Emory GY",
  ...overrides,
});

beforeEach(async () => {
  dbFails = false;
  collegeFetch.mockClear();
  vi.stubGlobal("fetch", collegeFetch);
  resetDecisionCache();
  db = drizzle(await freshSchemaClient(), { schema });
});

describe("GET /api/videos/decision", () => {
  it("answers a stored decision with its judges, without any lookup", async () => {
    await db.insert(videos).values(
      round("stored", { affWin: true, judgeDecision: "2-1", resultsJudges: "Ann Lee, Bo Kim*", resultsSquirrels: "Bo Kim" }),
    );
    const res = await get("stored");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "known",
      source: "stored",
      affWin: true,
      decision: "2-1",
      judges: [
        { name: "Ann Lee", side: "aff", squirreled: false },
        { name: "Bo Kim", side: "neg", squirreled: true },
      ],
    });
    expect(collegeFetch).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("looks up a round with no decision, then answers a repeat from its cache", async () => {
    await db.insert(videos).values(round("final"));
    const first = await (await get("final")).json();
    expect(first).toMatchObject({ status: "known", source: "college-debate-results", affWin: false, decision: "3-2" });
    expect(first.judges).toHaveLength(5);
    const requests = collegeFetch.mock.calls.length;
    expect(requests).toBeGreaterThan(0);

    expect(await (await get("final")).json()).toEqual(first);
    expect(collegeFetch).toHaveBeenCalledTimes(requests);
  });

  it("answers unknown, not an error, when the results sites have nothing", async () => {
    await db.insert(videos).values(round("missing", { affTeam: "Kansas OU" }));
    const res = await get("missing");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "unknown", affWin: null, decision: null, judges: [] });
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("answers unknown for an unlisted video, a missing id, and a lecture", async () => {
    await db.insert(videos).values(round("lecture", { source: "lecture", style: null, tournament: null, affTeam: null, negTeam: null }));
    for (const id of ["nope", "", undefined, "lecture"]) {
      const res = await get(id);
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("unknown");
    }
  });

  it("answers unknown but does not cache it when the results site is unreachable", async () => {
    await db.insert(videos).values(round("flaky"));
    collegeFetch.mockRejectedValue(new Error("network down"));
    const res = await get("flaky");
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("unknown");
    expect(res.headers.get("cache-control")).toBe("no-store");

    collegeFetch.mockImplementation(async (url: string | URL | Request) => {
      const path = String(url).slice(COLLEGE_RESULTS_API.length);
      return path in COLLEGE ? new Response(JSON.stringify(COLLEGE[path]), { status: 200 }) : new Response("{}", { status: 404 });
    });
    expect((await (await get("flaky")).json()).status).toBe("known");
  });

  it("is a 500 only when the database is down", async () => {
    dbFails = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await get("any")).status).toBe(500);
  });
});
