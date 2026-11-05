/**
 * @fileoverview A high school's best ranked entries per season and the
 * yearly score the school page's "Historical legend" charts from them.
 */

import { describe, expect, it } from "vitest";
import {
  bestTeamsBySchool,
  combineDebateData,
  rankSchoolStrength,
  schoolRankingPoints,
  schoolStrengthTable,
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

describe("school strength ranks", () => {
  const records = [
    {
      school: "The Harker School (CA)",
      results: [{ year: 2001, event: "Policy" as const, place: "Champion" as const, school: "The Harker School (CA)", competitors: "" }],
      titles: 1,
      runnerUps: 0,
      topSpeakers: 0,
      events: ["Policy" as const],
    },
    {
      school: "Glenbrook North (IL)",
      results: [{ year: 1990, event: "Policy" as const, place: "Champion" as const, school: "Glenbrook North (IL)", competitors: "" }],
      titles: 1,
      runnerUps: 0,
      topSpeakers: 0,
      events: ["Policy" as const],
    },
  ];
  const table = schoolStrengthTable(
    [
      { school: "harker", year: 2020, points: 5 },
      { school: "lynbrook", year: 2020, points: 9 },
      { school: "lynbrook", year: 2021, points: 1 },
    ],
    records,
  );

  it("adds TOC finishes to the matching ranked school, and keeps TOC-only schools", () => {
    expect(table.get("harker")).toEqual(new Map([[2020, 5], [2001, 30]]));
    expect(table.get("toc:Glenbrook North (IL)")).toEqual(new Map([[1990, 30]]));
  });

  it("ranks all time and over a span", () => {
    expect(rankSchoolStrength(table, "harker")).toEqual({ rank: 1, score: 35, of: 3 });
    expect(rankSchoolStrength(table, "lynbrook")).toEqual({ rank: 3, score: 10, of: 3 });
    expect(rankSchoolStrength(table, "lynbrook", 2012, 2021)).toEqual({ rank: 1, score: 10, of: 2 });
    expect(rankSchoolStrength(table, "nowhere")).toBeNull();
  });
});
