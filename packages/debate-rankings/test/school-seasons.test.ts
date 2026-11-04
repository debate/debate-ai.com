/**
 * @fileoverview A high school's best ranked entries per season and the
 * yearly score the school page's "Historical legend" charts from them.
 */

import { describe, expect, it } from "vitest";
import {
  bestTeamsBySchool,
  combineDebateData,
  schoolRankingPoints,
  schoolSeasonKey,
  schoolSeasonScores,
  schoolSeasonsFromEntries,
  schoolSeasonYear,
  type SchoolSeason,
} from "../src/index";
import { profileSlug } from "../src/leaderboard/profile/rankingProfileHelpers";

const team = (code: string, elo: number, n1: string, n2: string) => ({
  SchoolTeamCode: code,
  FullName1: n1,
  FullName2: n2,
  OverallELO: String(elo),
});

const data = combineDebateData(
  "hspolicy",
  "24-25",
  {
    attribution: "x",
    teams: JSON.stringify([
      team("Harker AB: Ant & Bee", 2300, "A Ant", "B Bee"),
      team("Harker CD: Cat & Dog", 2100, "C Cat", "D Dog"),
      team("Harker EF: Elk & Fox", 2000, "E Elk", "F Fox"),
      team("Whitney Young BM: Boss & Mohan", 2200, "X Boss", "Y Mohan"),
    ]),
  },
  {
    generated: "",
    tournaments: [],
    pending: [],
    teams: [{ team: "Harker AB: Ant & Bee", bids: ["glen", "mbt", "glen"] }],
  },
);

describe("best teams by school", () => {
  it("keeps each school's best two entries with their rank and bids", () => {
    const best = bestTeamsBySchool(data);
    expect(best.get("harker")).toEqual([
      { rank: 1, fieldSize: 4, name: "Ant & Bee", bids: 2 },
      { rank: 3, fieldSize: 4, name: "Cat & Dog", bids: 0 },
    ]);
    expect(best.get("whitney-young")).toEqual([{ rank: 2, fieldSize: 4, name: "Boss & Mohan", bids: 0 }]);
  });

  it("keys schools the way profile handles do", () => {
    for (const name of ["Harker", "St. Mark's (TX)", "Café Prep"]) expect(schoolSeasonKey(name)).toBe(profileSlug(name));
    expect(schoolSeasonYear("24-25")).toBe(2025);
  });

  it("takes the current season from the page's rows", () => {
    const rows = [
      { datasetId: "hsld" as const, fieldSize: 900, entry: { rank: 40, name: "Jane Doe", tocBids: ["a"] } },
      { datasetId: "hsld" as const, fieldSize: 900, entry: { rank: 4, name: "Sam Roe", tocBids: ["a", "b"] } },
      { datasetId: "hsld" as const, fieldSize: 900, entry: { rank: 90, name: "Al Poe" } },
    ];
    expect(schoolSeasonsFromEntries(rows, 2027)).toEqual([
      {
        year: 2027,
        event: "Lincoln-Douglas",
        teams: [
          { rank: 4, fieldSize: 900, name: "Sam Roe", bids: 2 },
          { rank: 40, fieldSize: 900, name: "Jane Doe", bids: 1 },
        ],
      },
    ]);
  });
});

describe("school season scores", () => {
  const seasons: SchoolSeason[] = [
    { year: 2025, event: "Policy", teams: [{ rank: 1, fieldSize: 4, name: "Ant & Bee", bids: 2 }] },
    { year: 2025, event: "Public Forum", teams: [{ rank: 150, fieldSize: 900, name: "Zed & Yu", bids: 0 }] },
  ];
  const toc = {
    results: [
      { year: 2025, event: "Policy" as const, place: "Champion" as const, school: "Harker", competitors: "" },
      { year: 2025, event: "Original Oratory" as const, place: "Champion" as const, school: "Harker", competitors: "" },
    ],
  };

  it("adds ranked entries, TOC qualifiers and debate TOC finishes, zero-filling gaps", () => {
    expect(schoolRankingPoints(1)).toBe(5);
    expect(schoolRankingPoints(150)).toBe(0);
    const series = schoolSeasonScores(seasons, toc, 2024, 2025);
    expect(series.map((s) => [s.year, s.total])).toEqual([
      [2024, 0],
      [2025, 39],
    ]);
    expect(series[1]).toMatchObject({
      parts: { rankings: 5, qualified: 4, toc: 30 },
      byEvent: { Policy: 39, "Lincoln-Douglas": 0, "Public Forum": 0 },
    });
    expect(series[1].seasons.map((s) => s.event)).toEqual(["Policy", "Public Forum"]);
  });
});
