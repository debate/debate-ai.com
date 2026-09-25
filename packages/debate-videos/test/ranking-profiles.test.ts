import { describe, expect, it } from "vitest";
import type { RankingDataset, RankingEntry } from "debate-rankings";
import {
  findSchoolEntries,
  findTeamEntries,
  profileSlug,
  schoolHref,
  schoolVideoQuery,
  summarizeSchool,
  teamHref,
  teamVideoQuery,
} from "../src/panels/leaderboard/profile/rankingProfiles";

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
