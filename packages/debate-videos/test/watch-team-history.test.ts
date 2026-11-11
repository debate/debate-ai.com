/**
 * @fileoverview A watch page team's past seasons: college rows come from
 * debatedata's tables for the same debaters, high school rows from the
 * school's best entries, both capped at the last 15 seasons, and a past
 * round's label is matched in its own season's rows.
 */

import { describe, it, expect } from "vitest";
import type { CollegeHistoryEntry, RankingDataset, SchoolSeason } from "@debate-ai/rankings";
import {
  collegeTeamHistory,
  findCollegeRoundTeam,
  findHsRoundTeam,
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
