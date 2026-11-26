/**
 * The Parli tab's NPDL rankings cached in D1, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import { NPDL_SEASONS, type NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import * as schema from "../../database/schema";
import {
  EMPTY_RETRY_SECONDS,
  getNpdlRankings,
  listSavedNpdlSeasons,
  readSavedNpdlSeason,
  refreshNpdlSeason,
  REFRESH_SEASONS,
  resetNpdlTablesForTests,
  runDailyNpdlRankingsRefresh,
  saveNpdlSeason,
} from "../npdl-rankings-store";
import { libsqlD1Binding } from "./libsql-d1-binding";

type Db = Parameters<typeof readSavedNpdlSeason>[0];

const DRIVERS: Array<[string, () => Db]> = [
  ["libsql", () => drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Db],
  ["D1", () => drizzleD1(libsqlD1Binding() as unknown as Parameters<typeof drizzleD1>[0], { schema }) as unknown as Db],
];

function season(name: string, teams = 30, points = 10): NpdlSeasonRankings {
  return {
    season: name,
    pageUrl: `https://www.parliamentarydebate.org/rankings-${name}`,
    fetchedAt: "2026-11-25T06:00:00.000Z",
    teams: Array.from({ length: teams }, (_, i) => ({
      rank: i < 2 ? 1 : i + 1, // a published tie
      school: `School ${i}`,
      region: i % 2 ? "CA" : null,
      debater1: `A${i}`,
      debater2: i % 3 ? `B${i}` : null,
      points: points + i / 10,
    })),
    schools: [{ rank: 1, school: "Dalton", region: "NY", debater1: null, debater2: null, points: 86.7 }],
  };
}

describe.each(DRIVERS)("NPDL rankings store (%s)", (_driver, open) => {
  function freshDb() {
    resetNpdlTablesForTests();
    return open();
  }

  it("round-trips a season, ties and nulls included, across many INSERTs", async () => {
    const db = freshDb();
    const s = season("2024-25", 300);
    await saveNpdlSeason(db, s);
    expect(await readSavedNpdlSeason(db, "2024-25")).toEqual(s);
    expect(await listSavedNpdlSeasons(db)).toEqual(["2024-25"]);
  });

  it("replaces a season's rows on a second save", async () => {
    const db = freshDb();
    await saveNpdlSeason(db, season("2024-25", 40));
    await saveNpdlSeason(db, season("2024-25", 5, 50));
    const saved = await readSavedNpdlSeason(db, "2024-25");
    expect(saved?.teams).toHaveLength(5);
    expect(saved?.teams[0]?.points).toBe(50);
  });

  it("rewrites only when the rows changed, and keeps the old copy when a scrape fails", async () => {
    const db = freshDb();
    expect(await refreshNpdlSeason(db, "2024-25", async () => season("2024-25"))).toBe("updated");
    expect(await refreshNpdlSeason(db, "2024-25", async () => season("2024-25"))).toBe("unchanged");
    expect(await refreshNpdlSeason(db, "2024-25", async () => season("2024-25", 31))).toBe("updated");
    expect(
      await refreshNpdlSeason(db, "2024-25", async () => {
        throw new Error("HTTP 503");
      }),
    ).toBe("empty");
    expect((await readSavedNpdlSeason(db, "2024-25"))?.teams).toHaveLength(31);
  });

  it("serves the database without scraping once a season is saved", async () => {
    const db = freshDb();
    await saveNpdlSeason(db, season("2024-25"));
    await saveNpdlSeason(db, season(NPDL_SEASONS[0]));
    const fetchSeason = vi.fn(async (name: string) => season(name));
    const asked = await getNpdlRankings(db, "2024-25", fetchSeason);
    const newest = await getNpdlRankings(db, null, fetchSeason);
    expect(asked.source).toBe("database");
    expect(newest).toMatchObject({ source: "database", rankings: { season: NPDL_SEASONS[0] } });
    expect(fetchSeason).not.toHaveBeenCalled();
  });

  it("scrapes and saves a season the first time it is asked for", async () => {
    const db = freshDb();
    const fetchSeason = vi.fn(async (name: string) => season(name));
    expect((await getNpdlRankings(db, "2022-23", fetchSeason)).source).toBe("live");
    expect((await getNpdlRankings(db, "2022-23", fetchSeason)).source).toBe("database");
    expect(fetchSeason).toHaveBeenCalledTimes(1);
  });

  it("with nothing saved, takes the newest season that has rows and remembers empty ones for a day", async () => {
    const db = freshDb();
    const fetchSeason = vi.fn(async (name: string) =>
      name === "2024-25" ? season(name) : { ...season(name, 0), schools: [] },
    );
    const now = Math.floor(Date.now() / 1000);
    const first = await getNpdlRankings(db, null, fetchSeason, now);
    expect(first).toMatchObject({ source: "live", rankings: { season: "2024-25" } });
    expect(fetchSeason).toHaveBeenCalledTimes(3);

    // The empty newer season is not scraped again inside the retry window…
    expect((await getNpdlRankings(db, "2026-27", fetchSeason, now + 60)).rankings).toBeNull();
    expect(fetchSeason).toHaveBeenCalledTimes(3);
    // …but is once the window has passed.
    await getNpdlRankings(db, "2026-27", fetchSeason, now + EMPTY_RETRY_SECONDS + 60);
    expect(fetchSeason).toHaveBeenCalledTimes(4);
  });

  it("the daily run refreshes the newest seasons and backfills every older one once", async () => {
    const db = freshDb();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSeason = vi.fn(async (name: string) => season(name, 3));
    const now = Math.floor(Date.now() / 1000);
    await runDailyNpdlRankingsRefresh(db, fetchSeason, now);
    expect(fetchSeason).toHaveBeenCalledTimes(NPDL_SEASONS.length);
    expect(await listSavedNpdlSeasons(db)).toEqual(NPDL_SEASONS);

    // The next day only the newest seasons are scraped again: saved past seasons are final.
    fetchSeason.mockClear();
    await runDailyNpdlRankingsRefresh(db, fetchSeason, now + 86_400);
    expect(fetchSeason.mock.calls.map((c) => c[0])).toEqual(NPDL_SEASONS.slice(0, REFRESH_SEASONS));
  });

  it("saves a full-size season (891 rows) in one batch", async () => {
    const db = freshDb();
    const s = { ...season("2025-26", 835), schools: season("x", 56).teams.map((r) => ({ ...r, debater1: null, debater2: null })) };
    expect(await refreshNpdlSeason(db, "2025-26", async () => s)).toBe("updated");
    const saved = await readSavedNpdlSeason(db, "2025-26");
    expect(saved?.teams).toHaveLength(835);
    expect(saved?.schools).toHaveLength(56);
  });

  it("serves a fresh scrape even when the save fails, and scrapes again next time", async () => {
    const db = freshDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.assign(db, { batch: async () => Promise.reject(new Error("D1_ERROR: write refused")) });
    const fetchSeason = vi.fn(async (name: string) => season(name));
    const first = await getNpdlRankings(db, "2023-24", fetchSeason);
    expect(first.source).toBe("live");
    expect(first.rankings?.teams).toHaveLength(30);
    expect(await refreshNpdlSeason(db, "2023-24", fetchSeason)).toBe("unsaved");
    expect((await getNpdlRankings(db, "2023-24", fetchSeason)).rankings?.season).toBe("2023-24");
    expect(fetchSeason).toHaveBeenCalledTimes(3);
  });

  it("with no season asked, prefers the newest seasons over an older one saved first", async () => {
    const db = freshDb();
    await saveNpdlSeason(db, season("2017-18"));
    const fetchSeason = vi.fn(async (name: string) => season(name));
    const lookup = await getNpdlRankings(db, null, fetchSeason);
    expect(lookup).toMatchObject({ source: "live", rankings: { season: NPDL_SEASONS[0] } });
    expect((await getNpdlRankings(db, null, fetchSeason)).source).toBe("database");
    expect(fetchSeason).toHaveBeenCalledTimes(1);
  });

  it("falls back to the newest saved season when the newest seasons have no rows", async () => {
    const db = freshDb();
    await saveNpdlSeason(db, season("2019-20"));
    const fetchSeason = vi.fn(async (name: string) => ({ ...season(name, 0), schools: [] }));
    expect((await getNpdlRankings(db, null, fetchSeason)).rankings?.season).toBe("2019-20");
  });

  it("the daily run keeps going when one season fails", async () => {
    const db = freshDb();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSeason = vi.fn(async (name: string) => {
      if (name === NPDL_SEASONS[1]) throw new Error("HTTP 503");
      return season(name, 3);
    });
    await runDailyNpdlRankingsRefresh(db, fetchSeason);
    expect(await listSavedNpdlSeasons(db)).toEqual(NPDL_SEASONS.filter((s) => s !== NPDL_SEASONS[1]));
    expect(String(log.mock.calls.at(-1)?.[0])).toContain(`${NPDL_SEASONS[1]} empty`);
  });
});
