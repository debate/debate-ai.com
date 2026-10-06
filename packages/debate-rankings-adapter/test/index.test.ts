import { describe, expect, it } from "vitest";
import {
  RANKING_DATASETS,
  RATING_DIVISOR,
  RATING_OFFSET,
  entryInitials,
  offsetEntryRatings,
  offsetFieldStatistics,
  findTeamRanking,
  getRankingDatasetInfo,
  loadRankingDataset,
  parseFieldStatistics,
  parseFullRankings,
  parseTeamLabel,
  type RankingEntry,
} from "../src/index";

function entry(overrides: Partial<RankingEntry>): RankingEntry {
  return { rank: 1, school: "", name: "", ...overrides } as RankingEntry;
}

describe("@debate/rankings-adapter", () => {
  it("lists the submodule's datasets", () => {
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

  it("shows Bradley-Terry ratings 500 points lower and divided by 15, leaving the rest of the row alone", () => {
    expect(RATING_OFFSET).toBe(500);
    expect(RATING_DIVISOR).toBe(15);
    const row = entry({ rank: 3, rating: 1900, adjustedRating: 1700, deviation: 100 });
    expect(offsetEntryRatings(row)).toEqual({ ...row, rating: 1400 / 15, adjustedRating: 1200 / 15 });
  });

  it("scales the field's aff rating advantage without offsetting it", () => {
    const field = { affWinRate: 49.3, negWinRate: 50.7, affElimWinRate: null, negElimWinRate: null, affRatingAdvantage: 30 };
    expect(offsetFieldStatistics(field)).toEqual({ ...field, affRatingAdvantage: 2 });
    expect(offsetFieldStatistics({ ...field, affRatingAdvantage: null }).affRatingAdvantage).toBeNull();
  });

  it("parses the Bradley-Terry full rankings and field statistics CSVs", () => {
    const [row] = parseFullRankings(
      "Rank,School,Name,Adjusted Rating,Deviation,Matches,Rating,Hash,Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate\n" +
        "1,College Prep,Falk & Sabnani,1806.05,79.66,13,1965.36,abc,100.0,90.0,100.0,\n",
    );
    expect(row).toMatchObject({ rank: 1, school: "College Prep", matches: 13, rating: 1965.36, deviation: 79.66, negElimWinRate: null });
    expect(
      parseFieldStatistics(
        "Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate,Aff Rating Advantage\n49.3,50.7,55.31,44.69,0.51\n",
      ),
    ).toEqual({ affWinRate: 49.3, negWinRate: 50.7, affElimWinRate: 55.31, negElimWinRate: 44.69, affRatingAdvantage: 0.51 });
  });

  it("loads a bundled dataset on the site scale, sorted by adjusted rating", async () => {
    const dataset = await loadRankingDataset("hspf");
    expect(dataset.entries.length).toBeGreaterThan(0);
    expect(dataset.field?.affRatingAdvantage).not.toBeNull();
    const [first, second] = dataset.entries;
    expect(first.rank).toBe(1);
    expect(first.adjustedRating).toBeGreaterThanOrEqual(second.adjustedRating);
    expect(first.rating).toBeLessThan(200);
  });
});
