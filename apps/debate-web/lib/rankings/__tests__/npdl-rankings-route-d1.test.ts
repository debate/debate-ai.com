/**
 * @fileoverview `GET /api/rankings/npdl` over a D1 database (drizzle's D1
 * driver on the libsql-backed binding), with the scraper and the bundled
 * snapshot stubbed: a scraped season is saved and then read back, and an
 * empty answer is never cached.
 */
import { drizzle } from "drizzle-orm/d1";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import * as schema from "../../database/schema";
import { resetNpdlTablesForTests } from "../npdl-rankings-store";
import { libsqlD1Binding } from "./libsql-d1-binding";

const state = vi.hoisted(() => ({
  db: null as unknown,
  snapshot: {} as Record<string, unknown>,
  fetchNpdlSeason: null as unknown as Mock<(season: string) => Promise<NpdlSeasonRankings>>,
}));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => state.db }));
vi.mock("@debate-ai/rankings/data/npdl-rankings.json", () => ({ default: state.snapshot }));
vi.mock("@debate-ai/rankings/src/sync/sync-npdl-rankings", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchNpdlSeason: (season: string) => state.fetchNpdlSeason(season),
}));
vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("@/app/api/rankings/npdl/route");
const { NPDL_SEASONS } = await import("@debate-ai/rankings/src/sync/sync-npdl-rankings");

function season(name: string, teams = 3): NpdlSeasonRankings {
  return {
    season: name,
    pageUrl: `https://www.parliamentarydebate.org/rankings-${name}`,
    fetchedAt: "2026-11-26T06:00:00.000Z",
    teams: Array.from({ length: teams }, (_, i) => ({
      rank: i + 1,
      school: `School ${i}`,
      region: null,
      debater1: `A${i}`,
      debater2: `B${i}`,
      points: 50 - i,
    })),
    schools: [{ rank: 1, school: "Nueva", region: "CA1", debater1: null, debater2: null, points: 90 }],
  };
}

const empty = (name: string) => ({ ...season(name, 0), schools: [] });

async function get(query = "") {
  const res = await GET(new NextRequest(`https://d.ebate.app/api/rankings/npdl${query}`));
  return { cache: res.headers.get("Cache-Control"), body: (await res.json()) as Record<string, any> };
}

beforeEach(() => {
  resetNpdlTablesForTests();
  state.db = drizzle(libsqlD1Binding() as unknown as Parameters<typeof drizzle>[0], { schema });
  for (const key of Object.keys(state.snapshot)) delete state.snapshot[key];
  state.fetchNpdlSeason = vi.fn(async (name: string) => season(name));
});

describe("GET /api/rankings/npdl over D1", () => {
  it("scrapes and saves a season the first time, then serves it from D1", async () => {
    const first = await get("?season=2022-23");
    expect(first.body).toMatchObject({ source: "live", rankings: { season: "2022-23" } });
    expect(first.cache).toContain("s-maxage=3600");
    const second = await get("?season=2022-23");
    expect(second.body).toMatchObject({ source: "database", rankings: { season: "2022-23" } });
    expect(state.fetchNpdlSeason).toHaveBeenCalledTimes(1);
  });

  it("serves every season the select offers", async () => {
    for (const s of NPDL_SEASONS) {
      expect((await get(`?season=${s}`)).body.rankings.season).toBe(s);
    }
  });

  it("falls back to the snapshot when the scrape fails", async () => {
    state.snapshot["2020-21"] = season("2020-21", 5);
    state.fetchNpdlSeason = vi.fn(async () => {
      throw new Error("HTTP 503");
    });
    const { body, cache } = await get("?season=2020-21");
    expect(body).toMatchObject({ source: "snapshot", rankings: { season: "2020-21" } });
    expect(body.rankings.teams).toHaveLength(5);
    expect(cache).toContain("max-age=300");
  });

  it("never caches an answer with no rankings", async () => {
    state.fetchNpdlSeason = vi.fn(async (name: string) => empty(name));
    const { body, cache } = await get();
    expect(body.rankings).toBeNull();
    expect(cache).toBe("no-store");
  });

  it("with no season asked, prefers a newer snapshot season over an older saved one", async () => {
    state.snapshot[NPDL_SEASONS[0]] = season(NPDL_SEASONS[0]);
    await get("?season=2018-19");
    state.fetchNpdlSeason = vi.fn(async (name: string) => empty(name));
    const { body } = await get();
    expect(body).toMatchObject({ source: "snapshot", rankings: { season: NPDL_SEASONS[0] } });
  });
});
