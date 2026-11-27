/**
 * @fileoverview `GET /api/rankings/npdl/all-time` over a D1 database and the
 * bundled snapshot: saved seasons win, unsaved ones come from the snapshot,
 * and unfinished seasons never count.
 */
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import * as schema from "../../database/schema";
import { resetNpdlTablesForTests, saveNpdlSeason } from "../npdl-rankings-store";
import { libsqlD1Binding } from "./libsql-d1-binding";

const state = vi.hoisted(() => ({
  db: null as unknown,
  snapshot: {} as Record<string, unknown>,
}));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => state.db }));
vi.mock("@debate-ai/rankings/data/npdl-rankings.json", () => ({ default: state.snapshot }));
vi.spyOn(console, "error").mockImplementation(() => {});

const { GET } = await import("@/app/api/rankings/npdl/all-time/route");
const { currentSeasonYear } = await import("@debate-ai/rankings/src/leaderboard/leaderboardUtils");
const { NPDL_SEASONS } = await import("@debate-ai/rankings/src/sync/sync-npdl-rankings");

function season(name: string, school: string, debaters: [string, string]): NpdlSeasonRankings {
  return {
    season: name,
    pageUrl: "",
    fetchedAt: "2026-11-26T06:00:00.000Z",
    teams: [{ rank: 1, school, region: null, debater1: debaters[0], debater2: debaters[1], points: 90 }],
    schools: [],
  };
}

async function get() {
  const res = await GET();
  return { status: res.status, cache: res.headers.get("Cache-Control"), body: (await res.json()) as Record<string, any> };
}

const finished = NPDL_SEASONS.filter((s) => Number(s.slice(0, 4)) + 1 < currentSeasonYear());

beforeEach(() => {
  resetNpdlTablesForTests();
  state.db = drizzle(libsqlD1Binding() as unknown as Parameters<typeof drizzle>[0], { schema });
  for (const key of Object.keys(state.snapshot)) delete state.snapshot[key];
});

describe("GET /api/rankings/npdl/all-time", () => {
  it("scores finished seasons from D1 with the high school formula", async () => {
    for (const name of finished.slice(0, 2)) await saveNpdlSeason(state.db as never, season(name, "Nueva", ["Patel", "Rao"]));
    const { body, cache, status } = await get();
    expect(status).toBe(200);
    expect(body.source).toBe("database");
    expect(body.seasons).toEqual(finished.slice(0, 2));
    expect(body.teams[0]).toMatchObject({ rank: 1, school: "Nueva", debaters: "Patel & Rao", score: 10, seasons: 2, firstPlaces: 2 });
    expect(body.schools[0]).toMatchObject({ rank: 1, school: "Nueva", score: 10 });
    expect(cache).toContain("s-maxage=86400");
  });

  it("falls back to the snapshot for a season D1 does not have, and leaves unfinished seasons out", async () => {
    const [newest, older] = finished;
    await saveNpdlSeason(state.db as never, season(newest, "Nueva", ["Patel", "Rao"]));
    state.snapshot[older] = season(older, "Dalton", ["Gordon", "Langdon"]);
    state.snapshot[NPDL_SEASONS[0]] = season(NPDL_SEASONS[0], "Unfinished", ["Too", "Soon"]);
    const { body, cache } = await get();
    expect(body.source).toBe("snapshot");
    expect(cache).toContain("max-age=300");
    expect(body.teams.map((t: { school: string }) => t.school).sort()).toEqual(["Dalton", "Nueva"]);
  });

  it("answers 502 without caching when no season has rows", async () => {
    const { status, cache, body } = await get();
    expect(status).toBe(502);
    expect(cache).toBe("no-store");
    expect(body.teams).toEqual([]);
  });
});
