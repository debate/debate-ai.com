import { describe, expect, it } from "vitest";
import {
  RANKING_DATASETS,
  RATING_DIVISOR,
  RATING_OFFSET,
  entryInitials,
  offsetEntryRatings,
  findTeamRanking,
  getRankingDatasetInfo,
  parseTeamLabel,
  type RankingEntry,
} from "../src/index";

function entry(overrides: Partial<RankingEntry>): RankingEntry {
  return { rank: 1, school: "", name: "", ...overrides } as RankingEntry;
}

describe("debate-rankings-adapter", () => {
  it("re-exports the submodule's datasets", () => {
    expect(RANKING_DATASETS.map((dataset) => dataset.id)).toContain("hspf");
    expect(getRankingDatasetInfo("cpd")?.label).toBe("College Policy");
  });

  it("splits a video team label into school and code", () => {
    expect(parseTeamLabel("William Fremd IB")).toEqual({ school: "William Fremd", code: "IB" });
    expect(parseTeamLabel("Boston College")).toBeNull();
  });

  it("takes last-name initials for a team and first/last for one debater", () => {
    expect(entryInitials("Falk & Sabnani")).toBe("FS");
    expect(entryInitials("Siddhartha Daswani")).toBe("SD");
  });

  it("finds the rankings row behind a video team label", () => {
    const rows = [
      entry({ rank: 4, school: "Harker School", name: "Lee & Liu" }),
      entry({ rank: 9, school: "Strake Jesuit", name: "Lam & Lo" }),
    ];
    expect(findTeamRanking(rows, "Harker LL")?.rank).toBe(4);
    expect(findTeamRanking(rows, "Harker QQ")).toBeNull();
  });

  it("shows Glicko-2 ratings 500 points lower and divided by 15, leaving the rest of the row alone", () => {
    expect(RATING_OFFSET).toBe(500);
    expect(RATING_DIVISOR).toBe(15);
    const row = entry({ rank: 3, rating: 1900, adjustedRating: 1700, deviation: 100 });
    expect(offsetEntryRatings(row)).toEqual({ ...row, rating: 1400 / 15, adjustedRating: 1200 / 15 });
  });
});
