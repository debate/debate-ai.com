import { describe, expect, it } from "vitest";
import {
  debaterKeys,
  individualRating,
  modelMatchup,
  recommendSide,
  recommendWeights,
  schoolRating,
  teamSideTilt,
  winProbability,
  type FieldStatistics,
  type ModelDataset,
  type RankingEntry,
} from "../src/index";

function entry(over: Partial<RankingEntry>): RankingEntry {
  return {
    rank: 1,
    school: "Harker",
    name: "Lee & Lin",
    adjustedRating: 0,
    deviation: 30,
    matches: 40,
    rating: 100,
    hash: Math.random().toString(36),
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
    ...over,
  };
}

const neutralField: FieldStatistics = {
  affWinRate: 50,
  negWinRate: 50,
  affElimWinRate: 50,
  negElimWinRate: 50,
  affRatingAdvantage: 0,
  sideWeights: null,
};

const zero = { school: 0, individual: 0 };

describe("matchup model", () => {
  it("parses debater surnames from team codes and LD names", () => {
    expect(debaterKeys("Nahm & Tarnas")).toEqual(["nahm", "tarnas"]);
    expect(debaterKeys("Jane Q Doe")).toEqual(["doe"]);
  });

  it("matches plain Glicko-2 when weights are zero and sides are neutral", () => {
    const a = entry({ rating: 110 });
    const b = entry({ rating: 90, school: "Lynbrook", name: "Ng & Wu" });
    const ds: ModelDataset = { id: "hspf", entries: [a, b], field: neutralField };
    const result = modelMatchup(a, b, ds, [ds], zero);
    const plain = winProbability(a, b);
    expect(result.sides[0].prelim).toBeCloseTo(plain, 6);
    expect(result.sides[1].prelim).toBeCloseTo(plain, 6);
    expect(recommendSide(result, "prelim")).toBeNull();
  });

  it("favors the aff when the field's aff advantage is positive", () => {
    const a = entry({});
    const b = entry({ school: "Lynbrook", name: "Ng & Wu" });
    const ds: ModelDataset = { id: "hspf", entries: [a, b], field: { ...neutralField, affRatingAdvantage: 2 } };
    const result = modelMatchup(a, b, ds, [ds], zero);
    expect(result.sides[0].prelim).toBeGreaterThan(0.5);
    expect(result.sides[1].prelim).toBeLessThan(0.5);
    expect(recommendSide(result, "prelim")?.side).toBe("aff");
  });

  it("recommends the side a team wins more on, beyond the field", () => {
    const negHeavy = entry({ affWinRate: 40, negWinRate: 75, matches: 60 });
    expect(teamSideTilt(negHeavy, neutralField)).toBeLessThan(0);
    const b = entry({ school: "Lynbrook", name: "Ng & Wu" });
    const ds: ModelDataset = { id: "hspf", entries: [negHeavy, b], field: neutralField };
    expect(recommendSide(modelMatchup(negHeavy, b, ds, [ds], zero), "prelim")?.side).toBe("neg");
  });

  it("shrinks a side tilt drawn from few rounds", () => {
    const few = teamSideTilt(entry({ affWinRate: 80, negWinRate: 20, matches: 4 }), neutralField);
    const many = teamSideTilt(entry({ affWinRate: 80, negWinRate: 20, matches: 80 }), neutralField);
    expect(Math.abs(few)).toBeLessThan(Math.abs(many));
  });

  it("blends toward the school mean with the school weight", () => {
    const a = entry({ rating: 50 });
    const mate = entry({ name: "Ra & Su", rating: 150 });
    const b = entry({ school: "Lynbrook", name: "Ng & Wu", rating: 100 });
    const ds: ModelDataset = { id: "hspf", entries: [a, mate, b], field: neutralField };
    expect(schoolRating(a, ds)).toEqual({ rating: 100, entries: 2 });
    const none = modelMatchup(a, b, ds, [ds], zero);
    const full = modelMatchup(a, b, ds, [ds], { school: 1, individual: 0 });
    expect(full.a.blended).toBe(100);
    expect(full.sides[0].prelim).toBeGreaterThan(none.sides[0].prelim);
  });

  it("rates debaters from their other entries at the same school only", () => {
    const team = entry({ name: "Nahm & Tarnas", rating: 100 });
    const nahmOther = entry({ name: "Nahm & Park", rating: 160 });
    const strangerSameName = entry({ school: "Elsewhere", name: "Nahm & Kim", rating: 0 });
    const filler = entry({ school: "Lynbrook", name: "Ng & Wu", rating: 100 });
    const ds: ModelDataset = { id: "hspf", entries: [team, nahmOther, strangerSameName, filler], field: neutralField };
    const indiv = individualRating(team, ds, [ds]);
    expect(indiv.sources).toBe(1);
    expect(indiv.rating).toBeCloseTo(160, 6);
    expect(individualRating(filler, ds, [ds]).rating).toBeNull();
  });

  it("recommends leaning on the school for teams with few rounds", () => {
    const a = entry({ matches: 5 });
    const mate = entry({ name: "Ra & Su" });
    const ds: ModelDataset = { id: "hspf", entries: [a, mate], field: neutralField };
    const fewRounds = recommendWeights(a, modelMatchup(a, mate, ds, [ds], zero).a);
    const veteran = entry({ matches: 90 });
    const ds2: ModelDataset = { id: "hspf", entries: [veteran, mate], field: neutralField };
    const manyRounds = recommendWeights(veteran, modelMatchup(veteran, mate, ds2, [ds2], zero).a);
    expect(fewRounds.school).toBeGreaterThan(manyRounds.school);
  });
});
