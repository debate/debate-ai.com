/**
 * The precomputed Schools table in D1, against a real in-memory SQLite database.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it, vi } from "vitest";
import type { SchoolRankingsSnapshot } from "@debate-ai/rankings/src/leaderboard/schoolRankingsSnapshot";
import * as schema from "../../database/schema";
import {
  getSchoolRankings,
  readSavedSchoolRankings,
  refreshSchoolRankings,
  saveSchoolRankings,
} from "../school-rankings-store";

const db = drizzle(createClient({ url: ":memory:" }), { schema }) as unknown as Parameters<
  typeof readSavedSchoolRankings
>[0];

function snapshot(seasonYear: number, hash: string, schools = 1): SchoolRankingsSnapshot {
  const row = (i: number) => ({
    rank: i + 1,
    school: `School ${i}`,
    bestRating: 90,
    bestEntry: "A & B",
    bestEvent: "PF",
    avgRating: 80,
    balancedScore: 85,
    teams: 2,
    events: ["PF"],
  });
  const all = Array.from({ length: schools }, (_, i) => row(i));
  return {
    version: 1,
    seasonYear,
    builtAt: "2026-11-04T00:00:00.000Z",
    hash,
    scopes: { all, VPF: all, VLD: [], VCX: [], NDT: [] },
    ndt: {},
  };
}

describe("school rankings store", () => {
  it("returns null for a season never saved", async () => {
    expect(await readSavedSchoolRankings(db, 2019)).toBeNull();
  });

  it("round-trips a snapshot split across parts", async () => {
    const big = snapshot(2024, "aaaa", 12_000);
    await saveSchoolRankings(db, big);
    expect(await readSavedSchoolRankings(db, 2024)).toEqual(big);
  });

  it("builds and saves a season the first time it is asked for, then serves the saved copy", async () => {
    const build = vi.fn(async (year: number) => snapshot(year, "first"));
    expect((await getSchoolRankings(db, 2021, build)).hash).toBe("first");
    expect((await getSchoolRankings(db, 2021, build)).hash).toBe("first");
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("rewrites only when the hash changes", async () => {
    await saveSchoolRankings(db, snapshot(2026, "same"));
    const same = await refreshSchoolRankings(db, 2026, async (y) => ({ ...snapshot(y, "same"), builtAt: "2026-11-05T00:00:00.000Z" }));
    expect(same.changed).toBe(false);
    expect((await readSavedSchoolRankings(db, 2026))!.builtAt).toBe("2026-11-04T00:00:00.000Z");

    const changed = await refreshSchoolRankings(db, 2026, async (y) => snapshot(y, "new", 2));
    expect(changed.changed).toBe(true);
    expect((await readSavedSchoolRankings(db, 2026))!.scopes.all).toHaveLength(2);
  });
});
