/**
 * @fileoverview All-time Parli teams and schools: the high school program-strength
 * formula (`(101 - rank) / 20` per entry, a school's two best entries a
 * season, summed and ranked with ties sharing a rank) over the NPDL's
 * published team ranks.
 */

import { describe, expect, it } from "vitest";
import bundled from "../data/npdl-rankings.json";
import { rankAllSchoolStrengths, schoolRankingPoints } from "../src/school-seasons";
import { buildNpdlAllTime } from "../src/sync/npdl-all-time";
import type { NpdlRankingRow, NpdlSeasonRankings } from "../src/sync/sync-npdl-rankings";

const row = (rank: number, school: string, debater1: string | null, debater2: string | null): NpdlRankingRow => ({
  rank,
  school,
  region: null,
  debater1,
  debater2,
  points: 100 - rank,
});

const season = (name: string, teams: NpdlRankingRow[]): NpdlSeasonRankings => ({
  season: name,
  pageUrl: "",
  fetchedAt: "",
  teams,
  schools: [],
});

describe("buildNpdlAllTime", () => {
  const seasons = {
    "2024-25": season("2024-25", [
      row(1, "Nueva", "Patel", "Rao"),
      row(2, "Nueva", "Lee", "Kim"),
      row(3, "Nueva", "Third", "Team"),
      row(4, "Dalton", "Gordon", "Langdon"),
    ]),
    "2023-24": season("2023-24", [
      row(1, "Dalton", "Langdon", "Gordon"),
      row(2, "Nueva", "Patel", "Rao"),
      row(150, "Far Away", "A", "B"),
    ]),
    "2026-27": season("2026-27", [row(1, "Unfinished", "Too", "Soon")]),
    "2022-23": season("2022-23", []),
  };

  it("scores schools with the high school formula: two best entries a season, top 100 only", () => {
    const { schools, seasons: counted } = buildNpdlAllTime(seasons, { lastYear: 2025 });
    expect(counted).toEqual(["2024-25", "2023-24"]);
    const nueva = schoolRankingPoints(1) + schoolRankingPoints(2) + schoolRankingPoints(2);
    const dalton = schoolRankingPoints(4) + schoolRankingPoints(1);
    expect(schools.map((s) => [s.rank, s.school, s.score])).toEqual([
      [1, "Nueva", Math.round(nueva * 10) / 10],
      [2, "Dalton", Math.round(dalton * 10) / 10],
    ]);
    expect(schools[0]).toMatchObject({ seasons: 2, bestRank: 1, firstPlaces: 1 });
    expect(schools[1]).toMatchObject({ seasons: 2, bestRank: 1, firstPlaces: 1 });
  });

  it("ranks schools through the shared program-strength ranker, equal scores sharing a rank", () => {
    const tied = {
      "2024-25": season("2024-25", [row(1, "Alpha", "A", "B"), row(1, "Beta", "C", "D")]),
    };
    const { schools } = buildNpdlAllTime(tied);
    expect(schools.map((s) => [s.rank, s.school])).toEqual([
      [1, "Alpha"],
      [1, "Beta"],
    ]);
    const table = new Map([
      ["alpha", new Map([[2025, schoolRankingPoints(1)]])],
      ["beta", new Map([[2025, schoolRankingPoints(1)]])],
    ]);
    expect([...rankAllSchoolStrengths(table).values()].map((r) => r.rank)).toEqual([1, 1]);
  });

  it("joins a team across seasons whatever the debaters' order and sums its entry points", () => {
    const { teams } = buildNpdlAllTime(seasons, { lastYear: 2025 });
    const round1 = (n: number) => Math.round(n * 10) / 10;
    expect(teams[0]).toMatchObject({ rank: 1, school: "Nueva", debaters: "Patel & Rao", seasons: 2, firstYear: 2024, lastYear: 2025, bestRank: 1, firstPlaces: 1 });
    expect(teams[0].score).toBe(round1(schoolRankingPoints(1) + schoolRankingPoints(2)));
    const dalton = teams.find((t) => t.school === "Dalton")!;
    expect(dalton).toMatchObject({ debaters: "Gordon & Langdon", seasons: 2, bestRank: 1, firstPlaces: 1 });
    expect(dalton.score).toBe(round1(schoolRankingPoints(4) + schoolRankingPoints(1)));
    expect(teams.map((t) => t.rank)).toEqual([...teams.map((_, i) => i + 1)]);
    expect(teams.some((t) => t.school === "Far Away")).toBe(false);
  });

  it("leaves unfinished seasons out unless asked for", () => {
    expect(buildNpdlAllTime(seasons, { lastYear: 2025 }).teams.some((t) => t.school === "Unfinished")).toBe(false);
    expect(buildNpdlAllTime(seasons).teams.some((t) => t.school === "Unfinished")).toBe(true);
  });

  it("keeps the newest season's spelling and trims to the requested count", () => {
    const { schools, teams } = buildNpdlAllTime(
      {
        "2023-24": season("2023-24", [row(1, "St. Mary", "Old", "Spell")]),
        "2024-25": season("2024-25", [row(2, "St Mary", "New", "Spell")]),
      },
      { count: 1 },
    );
    expect(schools).toHaveLength(1);
    expect(schools[0]).toMatchObject({ school: "St Mary", seasons: 2 });
    expect(teams).toHaveLength(1);
  });

  it("builds from the bundled snapshot", () => {
    const { schools, teams, seasons: counted } = buildNpdlAllTime(bundled as unknown as Record<string, NpdlSeasonRankings>, { lastYear: 2026 });
    expect(counted[0]).toBe("2025-26");
    expect(counted).toContain("2017-18");
    expect(counted).not.toContain("2026-27");
    expect(schools).toHaveLength(100);
    expect(teams).toHaveLength(100);
    expect(schools[0].rank).toBe(1);
    expect(schools.every((s, i) => i === 0 || schools[i - 1].score >= s.score)).toBe(true);
    expect(teams.every((t, i) => i === 0 || teams[i - 1].score >= t.score)).toBe(true);
  });
});
