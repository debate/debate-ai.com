/**
 * The Parli tab's NPDL rankings cached in D1, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import type { NpdlSeasonRankings } from "@debate-ai/rankings/src/sync/sync-npdl-rankings";
import * as schema from "../../database/schema";
import {
  EMPTY_RETRY_SECONDS,
  getNpdlRankings,
  listSavedNpdlSeasons,
  readSavedNpdlSeason,
  refreshNpdlSeason,
  resetNpdlTablesForTests,
  saveNpdlSeason,
} from "../npdl-rankings-store";

function freshDb() {
  resetNpdlTablesForTests();
  return drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
    typeof readSavedNpdlSeason
  >[0];
}

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

describe("NPDL rankings store", () => {
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
    const fetchSeason = vi.fn(async (name: string) => season(name));
    const asked = await getNpdlRankings(db, "2024-25", fetchSeason);
    const newest = await getNpdlRankings(db, null, fetchSeason);
    expect(asked.source).toBe("database");
    expect(newest.rankings?.season).toBe("2024-25");
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
});
