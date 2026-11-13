/**
 * @fileoverview A watch page team's past seasons: college rows come from
 * debatedata's tables for the same debaters, high school rows from the
 * school's best entries, both capped at the last 15 seasons, and a past
 * round's label is matched in its own season's rows.
 */

import { describe, it, expect } from "vitest";
import type { CollegeHistoryEntry, RankingDataset, RankingEntry, SchoolSeason } from "@debate-ai/rankings";
import {
  collegeTeamHistory,
  findCollegeRoundTeam,
  findHsRoundTeam,
  findHsSeasonEntry,
  hsDatasetTeamHistory,
  hsHistorySeasons,
  mergeTeamHistory,
  hsSeasonEvent,
  hsTeamHistory,
  resolveRankedSchool,
  seasonLabel,
  TEAM_HISTORY_SEASONS,
} from "../src/lib/watch-team-history";

const row = (rank: number, school: string, name: string): CollegeHistoryEntry => ({
  rank,
  school,
  name,
  rating: 30 - rank / 10,
  mu: 34 - rank / 10,
  sigma: 1.5,
});

const history = new Map<number, CollegeHistoryEntry[]>([
  [2026, [row(2, "University of Kansas", "Larson & Schultz"), row(5, "Emory University", "Ghosh & Norris")]],
  [2025, [row(9, "University of Kansas", "Schultz & Larson")]],
  [2024, [row(40, "University of Kansas", "Larson & Smith")]],
  [2010, [row(3, "Kansas", "Larson & Schultz")]],
]);

describe("collegeTeamHistory", () => {
  it("lists the same debaters' seasons newest first, within the last 15", () => {
    const rows = collegeTeamHistory(history, { school: "Kansas", name: "Jane Larson & Sam Schultz" }, 2026);
    expect(rows.map((r) => [r.season, r.rank])).toEqual([
      [2026, 2],
      [2025, 9],
    ]);
    expect(rows[0]).toMatchObject({ fieldSize: null, rating: 29.8, sigma: 1.5 });
  });

  it("reaches back 15 seasons and no further", () => {
    expect(TEAM_HISTORY_SEASONS).toBe(15);
    const rows = collegeTeamHistory(history, { school: "Kansas", name: "Larson & Schultz" }, 2024);
    expect(rows.map((r) => r.season)).toEqual([2010]);
    expect(collegeTeamHistory(history, { school: "Kansas", name: "Larson & Schultz" }, 2025).map((r) => r.season)).toEqual([2025]);
  });

  it("finds a past round's team in its own season", () => {
    expect(findCollegeRoundTeam(history, 2024, "Kansas LS")?.name).toBe("Larson & Smith");
    expect(findCollegeRoundTeam(history, 2023, "Kansas LS")).toBeNull();
  });
});

const seasons: SchoolSeason[] = [
  { year: 2024, event: "Policy", teams: [{ rank: 12, fieldSize: 400, name: "Lee & Lin", bids: 2 }, { rank: 30, fieldSize: 400, name: "Ahn & Bo", bids: 0 }] },
  { year: 2023, event: "Policy", teams: [{ rank: 50, fieldSize: 380, name: "Lin & Lee", bids: 1 }] },
  { year: 2023, event: "Lincoln-Douglas", teams: [{ rank: 4, fieldSize: 900, name: "Amy Lee", bids: 3 }] },
];

describe("high school history", () => {
  it("maps datasets to events", () => {
    expect(hsSeasonEvent("hscx")).toBe("Policy");
    expect(hsSeasonEvent("hsld")).toBe("Lincoln-Douglas");
    expect(hsSeasonEvent("cpd")).toBeNull();
  });

  it("lists the entry's seasons in its event", () => {
    const rows = hsTeamHistory(seasons, "Policy", "Jo Lee & Max Lin", 2026);
    expect(rows.map((r) => [r.season, r.rank, r.fieldSize, r.bids])).toEqual([
      [2024, 12, 400, 2],
      [2023, 50, 380, 1],
    ]);
    expect(hsTeamHistory(seasons, "Lincoln-Douglas", "Amy Lee", 2026)).toHaveLength(1);
  });

  it("finds a past round's entry by its initials, either order", () => {
    expect(findHsRoundTeam(seasons, "Policy", 2024, "Harker LL")?.name).toBe("Lee & Lin");
    expect(findHsRoundTeam(seasons, "Policy", 2024, "Harker BA")?.name).toBe("Ahn & Bo");
    expect(findHsRoundTeam(seasons, "Policy", 2024, "Harker ZZ")).toBeNull();
    expect(findHsRoundTeam(seasons, "Policy", 2022, "Harker LL")).toBeNull();
  });

  it("resolves a label's school to the rankings' spelling, refusing ties", () => {
    const dataset = {
      entries: [{ school: "The Harker School" }, { school: "Gunn High School" }, { school: "Glenbrook North" }, { school: "Glenbrook South" }],
    } as unknown as RankingDataset;
    expect(resolveRankedSchool(dataset, "Harker")).toBe("The Harker School");
    expect(resolveRankedSchool(dataset, "Glenbrook")).toBeNull();
    expect(resolveRankedSchool(undefined, "Harker")).toBeNull();
  });
});

it("labels seasons", () => {
  expect(seasonLabel(2025)).toBe("2024-25");
  expect(seasonLabel(2010)).toBe("2009-10");
});

const hsEntry = (rank: number, school: string, name: string, debaters?: string[], bids = 0): RankingEntry => ({
  rank,
  school,
  name,
  adjustedRating: 0,
  deviation: 0,
  matches: 0,
  rating: 0,
  hash: `${school}|${name}`,
  affWinRate: null,
  negWinRate: null,
  affElimWinRate: null,
  negElimWinRate: null,
  debaters,
  tocBids: Array.from({ length: bids }, (_, i) => `t${i}`),
});

describe("high school history from each season's full rankings", () => {
  const appanBai = ["Aayush Appan", "Yang Bai"];
  const seasons = new Map<number, Pick<RankingDataset, "entries">>([
    [2026, { entries: [hsEntry(3, "Plano West", "Appan & Bai", appanBai, 4), hsEntry(97, "Plano West", "Bai & Chang", ["Yang Bai", "Ian Chang"])] }],
    [2025, { entries: [hsEntry(1, "Plano West", "Appan & Bai", appanBai, 6), hsEntry(2, "Other", "Appan & Bai", ["Raj Appan", "Li Bai"])] }],
    // The same pair the season before, at another school and below its top two.
    [2024, { entries: [hsEntry(5, "Jasper", "Kim & Lee"), hsEntry(9, "Jasper", "Ng & Ho"), hsEntry(138, "Jasper", "Appan & Bai", ["Yang Bai", "Aayush Appan"], 1)] }],
    [2023, { entries: [hsEntry(200, "Jasper", "Appan & Qian", ["Aayush Appan", "Eric Qian"])] }],
  ]);

  it("follows the same debaters across schools by full name", () => {
    const rows = hsDatasetTeamHistory(seasons, { school: "Plano West", name: "Appan & Bai", debaters: appanBai }, 2026);
    expect(rows.map((r) => [r.season, r.rank, r.fieldSize, r.bids, r.school])).toEqual([
      [2026, 3, 2, 4, "Plano West"],
      [2025, 1, 2, 6, "Plano West"],
      [2024, 138, 3, 1, "Jasper"],
    ]);
  });

  it("falls back to last names at a matching school without full names", () => {
    expect(findHsSeasonEntry(seasons.get(2025)!.entries, { school: "Plano West", name: "Bai & Appan" })?.rank).toBe(1);
    expect(findHsSeasonEntry(seasons.get(2024)!.entries, { school: "Plano West", name: "Appan & Bai" })).toBeNull();
  });

  it("loads a high school career either side of the round", () => {
    expect(hsHistorySeasons(2025, 2026)).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(hsHistorySeasons(2026, 2026)).toEqual([2026, 2025, 2024, 2023]);
    expect(hsHistorySeasons(2017, 2026)).toEqual([2020, 2019, 2018, 2017, 2016]);
  });

  it("prefers full-ranking rows and keeps the school's rows for other seasons", () => {
    const primary = [{ season: 2025, rank: 1, fieldSize: 10, name: "A & B" }];
    const fallback = [
      { season: 2025, rank: 4, fieldSize: 10, name: "A & B" },
      { season: 2022, rank: 7, fieldSize: 10, name: "A & B" },
    ];
    expect(mergeTeamHistory(primary, fallback).map((r) => [r.season, r.rank])).toEqual([
      [2025, 1],
      [2022, 7],
    ]);
  });
});
