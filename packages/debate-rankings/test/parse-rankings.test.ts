import { describe, expect, it } from "vitest";
import {
  RANKING_DATASETS,
  loadRankingDataset,
  parseCsv,
  parseFieldStatistics,
  parseFullRankings,
} from "../js/index";

const HEADER =
  "Rank,School,Name,Adjusted Rating,Deviation,Matches,Rating,Hash,Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate";

describe("parseCsv", () => {
  it("keeps quoted commas and doubled quotes inside one cell", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("parseFullRankings", () => {
  it("maps every column and turns empty win rates into null", () => {
    const [row] = parseFullRankings(
      `${HEADER}\n128,"Russellville HS - Russellville, AR",Madison Mckown,1386.89,148.51,7,1683.92,55eb,33.33,75.0,,0.0\n`,
    );
    expect(row).toEqual({
      rank: 128,
      school: "Russellville HS - Russellville, AR",
      name: "Madison Mckown",
      adjustedRating: 1386.89,
      deviation: 148.51,
      matches: 7,
      rating: 1683.92,
      hash: "55eb",
      affWinRate: 33.33,
      negWinRate: 75,
      affElimWinRate: null,
      negElimWinRate: 0,
    });
  });

  it("reads the trimmed rankings.csv, whose Rating is the adjusted rating", () => {
    const [row] = parseFullRankings(
      "Rank,School,Name,Rating,Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate\n1,Emory,Gallagher & Young,1911.83,85.71,100.0,100.0,100.0\n",
    );
    expect(row.adjustedRating).toBe(1911.83);
    expect(row.hash).toBe("");
  });
});

describe("parseFieldStatistics", () => {
  it("parses the single data row", () => {
    expect(
      parseFieldStatistics(
        "Aff Win Rate,Neg Win Rate,Aff Elim Win Rate,Neg Elim Win Rate\n51.8,48.2,70.37,29.63\n",
      ),
    ).toEqual({ affWinRate: 51.8, negWinRate: 48.2, affElimWinRate: 70.37, negElimWinRate: 29.63 });
  });
});

describe("loadRankingDataset", () => {
  it.each(RANKING_DATASETS.map((d) => d.id))("loads the generated %s output", async (id) => {
    const dataset = await loadRankingDataset(id);
    expect(dataset.entries.length).toBeGreaterThan(0);
    expect(dataset.entries[0].rank).toBe(1);
    expect(dataset.field).not.toBeNull();
    const ratings = dataset.entries.map((e) => e.adjustedRating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  it("slices the LD Sep–Oct tournaments at the topic boundary", () => {
    const sepoct = RANKING_DATASETS.find((d) => d.id === "hsld_sepoct")!;
    expect(sepoct.tournaments.length).toBeGreaterThan(0);
  });
});
