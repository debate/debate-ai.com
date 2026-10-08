import { describe, expect, it } from "vitest";
import {
  RANKING_DATASETS,
  RATING_DIVISOR,
  RATING_MAX,
  RATING_MIN,
  RATING_OFFSET,
  entryInitials,
  offsetEntryRatings,
  offsetFieldStatistics,
  toSiteRating,
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

  it("shows Bradley-Terry ratings 1000 points lower and divided by 8, leaving the rest of the row alone", () => {
    expect(RATING_OFFSET).toBe(1000);
    expect(RATING_DIVISOR).toBe(8);
    const row = entry({ rank: 3, rating: 1800, adjustedRating: 1700, deviation: 100 });
    expect(offsetEntryRatings(row)).toEqual({ ...row, rating: 100, adjustedRating: 87.5 });
  });

  it("caps the site rating at 110 and floors it at 0", () => {
    expect(RATING_MAX).toBe(110);
    expect(RATING_MIN).toBe(0);
    expect(toSiteRating(1954)).toBe(110);
    expect(toSiteRating(1880)).toBe(110);
    expect(toSiteRating(1000)).toBe(0);
    expect(toSiteRating(882)).toBe(0);
    expect(toSiteRating(1024)).toBe(3);
  });

  it("scales the field's aff rating advantage without offsetting it", () => {
    const field = { affWinRate: 49.3, negWinRate: 50.7, affElimWinRate: null, negElimWinRate: null, affRatingAdvantage: 30, sideWeights: null };
    expect(offsetFieldStatistics(field)).toEqual({ ...field, affRatingAdvantage: 30 / 8 });
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
    ).toEqual({ affWinRate: 49.3, negWinRate: 50.7, affElimWinRate: 55.31, negElimWinRate: 44.69, affRatingAdvantage: 0.51, sideWeights: null });
    expect(
      parseFieldStatistics("Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate\n49.19,50.81,55.4,44.6\n"),
    ).toEqual({ affWinRate: 49.19, negWinRate: 50.81, affElimWinRate: 55.4, negElimWinRate: 44.6, affRatingAdvantage: null, sideWeights: null });
    expect(
      parseFieldStatistics(
        "Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate,Aff Rating Advantage,Aff Side Weight,Neg Side Weight,Aff Elim Side Weight,Neg Elim Side Weight\n" +
          "49.3,50.7,55.31,44.69,0.51,1.0142,0.9862,0.904,1.1188\n",
      )?.sideWeights,
    ).toEqual({ aff: 1.0142, neg: 0.9862, affElim: 0.904, negElim: 1.1188 });
  });

  it("loads a bundled dataset on the site scale, sorted by adjusted rating", async () => {
    const dataset = await loadRankingDataset("hspf");
    expect(dataset.entries.length).toBeGreaterThan(0);
    // Upstream stopped emitting "Aff Rating Advantage"; the win rates remain.
    expect(dataset.field?.affWinRate).not.toBeNull();
    const [first, second] = dataset.entries;
    expect(first.rank).toBe(1);
    expect(first.adjustedRating).toBeGreaterThanOrEqual(second.adjustedRating);
    expect(first.rating).toBeLessThan(200);
  });

  it("spreads every bundled dataset from about 0 up to about 100, never past 110", async () => {
    for (const { id } of RANKING_DATASETS) {
      const ratings = (await loadRankingDataset(id)).entries.map((e) => e.adjustedRating).sort((a, b) => b - a);
      expect(ratings[0]).toBeLessThanOrEqual(RATING_MAX);
      expect(ratings[0]).toBeGreaterThan(95);
      expect(ratings[ratings.length - 1]).toBe(RATING_MIN);
    }
  });
});
