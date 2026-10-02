import { describe, expect, it } from "vitest";
import type { RankingDataset, RankingEntry } from "@debate/rankings-adapter";
import {
  findSchoolEntries,
  findTeamEntries,
  profileSlug,
  schoolDivisionRadarData,
  schoolHref,
  schoolVideoQuery,
  summarizeSchool,
  teamHref,
  teamRadarData,
  teamVideoQuery,
  type ProfileEntry,
} from "../src/panels/leaderboard/profile/rankingProfileHelpers";

function entry(rank: number, school: string, name: string, extra: Partial<RankingEntry> = {}): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: 1800 - rank * 10,
    deviation: 50,
    matches: 10,
    rating: 1900,
    hash: `${school}-${name}`,
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
    ...extra,
  };
}

function dataset(id: RankingDataset["id"], label: string, entries: RankingEntry[]): RankingDataset {
  return { id, label, tournaments: [], majors: [], entries, field: null };
}

const datasets = [
  dataset("hspf", "HS Public Forum", [
    entry(1, "College Prep", "Falk & Sabnani"),
    entry(2, "University", "Chan & Chhabra"),
    entry(5, "College Prep", "Lee & Park", { matches: 6 }),
  ]),
  dataset("hsld", "HS Lincoln-Douglas", [entry(3, "College Prep", "Jane Doe")]),
];

describe("ranking profile links", () => {
  it("slugifies schools and teams", () => {
    expect(profileSlug("St. Mark's School")).toBe("st-mark-s-school");
    expect(schoolHref("College Prep")).toBe("/schools/college-prep");
    expect(teamHref({ school: "College Prep", name: "Falk & Sabnani" })).toBe(
      "/teams/college-prep-falk-sabnani",
    );
  });

  it("finds a team from its slug, including percent-encoded params", () => {
    const found = findTeamEntries(datasets, "college-prep-falk-sabnani");
    expect(found).toHaveLength(1);
    expect(found[0].entry.name).toBe("Falk & Sabnani");
    expect(found[0].fieldSize).toBe(3);
    expect(findTeamEntries(datasets, "College%20Prep%20Falk%20Sabnani")).toHaveLength(1);
    expect(findTeamEntries(datasets, "nobody")).toEqual([]);
  });

  it("finds and summarizes every entry of a school across divisions", () => {
    const found = findSchoolEntries(datasets, "college-prep");
    expect(found.map((f) => f.entry.name)).toEqual(["Jane Doe", "Falk & Sabnani", "Lee & Park"]);
    const summary = summarizeSchool(found);
    expect(summary.school).toBe("College Prep");
    expect(summary.teams).toBe(3);
    expect(summary.bestRank).toBe(1);
    expect(summary.totalMatches).toBe(26);
    expect(summary.divisions.find((d) => d.datasetId === "hspf")).toMatchObject({ teams: 2, bestRank: 1 });
  });

  it("builds video searches without separators", () => {
    expect(teamVideoQuery({ name: "Falk & Sabnani" })).toBe("Falk Sabnani");
    expect(schoolVideoQuery("Harvard-Westlake")).toBe("Harvard-Westlake");
  });
});

describe("teamRadarData", () => {
  const item = (over: Partial<RankingEntry>, fieldSize = 11, maxMatches = 40) => ({
    datasetId: "hspf" as const,
    datasetLabel: "HS Public Forum",
    fieldSize,
    maxMatches,
    entry: entry(1, "Alpha", "Kim & Lee", over),
  });

  it("plots win rates, rank percentile and relative matches on 0–100 spokes", () => {
    const data = teamRadarData(
      item({ rank: 3, matches: 30, affWinRate: 80, negWinRate: 62.5, affElimWinRate: 100, negElimWinRate: null }),
    );
    expect(Object.fromEntries(data.map((d) => [d.metric, d.score]))).toEqual({
      "Aff win": 80,
      "Neg win": 62.5,
      "Elim neg": 0,
      "Elim aff": 100,
      Ranking: 80,
      Matches: 75,
    });
    expect(data.find((d) => d.metric === "Elim neg")?.display).toBe("no rounds");
    expect(data.find((d) => d.metric === "Ranking")?.display).toBe("#3 of 11");
    expect(data.find((d) => d.metric === "Matches")?.display).toBe("30 of 40 max");
  });

  it("puts a lone entry at the edge and survives an empty field", () => {
    const data = teamRadarData(item({ rank: 1, matches: 0 }, 1, 0));
    expect(data.find((d) => d.metric === "Ranking")?.score).toBe(100);
    expect(data.find((d) => d.metric === "Matches")?.score).toBe(0);
  });

  it("records each division's most-played entry on the profile row", () => {
    const datasets = [
      {
        id: "hspf",
        label: "HS Public Forum",
        entries: [entry(1, "Alpha", "Kim & Lee", { matches: 12 }), entry(2, "Beta", "Doe", { matches: 30 })],
      },
    ] as unknown as RankingDataset[];
    expect(findSchoolEntries(datasets, "alpha")[0].maxMatches).toBe(30);
  });
});

describe("schoolDivisionRadarData", () => {
  function profileItem(rank: number, name: string, over: Partial<RankingEntry> = {}): ProfileEntry {
    return {
      datasetId: "hspf",
      datasetLabel: "HS Public Forum",
      fieldSize: 11,
      maxMatches: 40,
      entry: entry(rank, "College Prep", name, over),
    };
  }

  it("averages win rates, rank percentiles and matches across teams", () => {
    const items = [
      profileItem(1, "Team A", { affWinRate: 70, negWinRate: 60, affElimWinRate: 80, negElimWinRate: 70, matches: 20 }),
      profileItem(5, "Team B", { affWinRate: 50, negWinRate: 40, affElimWinRate: 60, negElimWinRate: 50, matches: 30 }),
    ];
    const data = schoolDivisionRadarData(items);
    expect(Object.fromEntries(data.map((d) => [d.metric, d.score]))).toEqual({
      "Aff win": 60,
      "Neg win": 50,
      "Elim neg": 60,
      "Elim aff": 70,
      Ranking: 80,
      Matches: 62.5,
    });
    expect(data.find((d) => d.metric === "Ranking")?.display).toBe("#1 of 11");
    expect(data.find((d) => d.metric === "Matches")?.display).toBe("25 of 40 max");
  });

  it("matches a lone entry's individual radar", () => {
    const item = profileItem(3, "Team A", { affWinRate: 80, negWinRate: 62.5, affElimWinRate: 100, negElimWinRate: null, matches: 30 });
    const schoolData = schoolDivisionRadarData([item]);
    const teamData = teamRadarData(item);
    expect(schoolData.map((d) => d.score)).toEqual(teamData.map((d) => d.score));
    expect(schoolData.map((d) => d.display)).toEqual(teamData.map((d) => d.display));
  });

  it("shows 'no rounds' when every team has null for a spoke", () => {
    const items = [
      profileItem(1, "Team A", { affElimWinRate: null, negElimWinRate: null }),
      profileItem(2, "Team B", { affElimWinRate: null, negElimWinRate: null }),
    ];
    const data = schoolDivisionRadarData(items);
    expect(data.find((d) => d.metric === "Elim aff")?.display).toBe("no rounds");
    expect(data.find((d) => d.metric === "Elim neg")?.display).toBe("no rounds");
    expect(data.find((d) => d.metric === "Elim aff")?.score).toBe(0);
  });

  it("treats a single null team as 0, not 'no rounds'", () => {
    const items = [
      profileItem(1, "Team A", { affWinRate: 80 }),
      profileItem(2, "Team B", { affWinRate: null }),
    ];
    const data = schoolDivisionRadarData(items);
    expect(data.find((d) => d.metric === "Aff win")?.score).toBe(40);
    expect(data.find((d) => d.metric === "Aff win")?.display).toBe("40%");
  });

  it("returns an empty array for no entries", () => {
    expect(schoolDivisionRadarData([])).toEqual([]);
  });
});
