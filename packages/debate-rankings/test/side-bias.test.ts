import { describe, expect, it } from "vitest";
import {
  SIDE_BIAS_CHAMPIONSHIPS,
  championshipSideBias,
  championshipTournament,
  countRounds,
  hasSideBiasData,
  sideBiasRates,
  sideBiasSeries,
  sideBiasYearRange,
  type SideBiasDataset,
} from "../src/side-bias";

const round = (winner: "aff" | "neg", elim = false) => ({ winner, elim });

const dataset: SideBiasDataset = {
  generatedAt: "2026-05-01T00:00:00.000Z",
  records: [
    { format: "pf", year: 2025, tabroomId: 34644, rounds: 100, affWins: 48, elimRounds: 20, elimAffWins: 12 },
    { format: "pf", year: 2026, tabroomId: 36156, rounds: 100, affWins: 52, elimRounds: 20, elimAffWins: 8 },
    { format: "pf", year: 2010, tabroomId: 1, rounds: 50, affWins: 50, elimRounds: 5, elimAffWins: 5 },
    { format: "ld", year: 2026, tabroomId: 36156, rounds: 0, affWins: 0, elimRounds: 0, elimAffWins: 0 },
  ],
};

describe("countRounds / sideBiasRates", () => {
  it("counts overall and elim rounds separately", () => {
    const counts = countRounds([round("aff"), round("neg"), round("aff", true), round("neg", true), round("neg", true)]);
    expect(counts).toEqual({ rounds: 5, affWins: 2, elimRounds: 3, elimAffWins: 1 });
  });

  it("turns counts into win rates in percent to two decimals", () => {
    expect(sideBiasRates({ rounds: 3, affWins: 1, elimRounds: 3, elimAffWins: 2 })).toMatchObject({
      affWinRate: 33.33,
      negWinRate: 66.67,
      elimAffWinRate: 66.67,
      negElimWinRate: 33.33,
    });
  });

  it("has null rates where there were no rounds", () => {
    const rates = sideBiasRates({ rounds: 4, affWins: 2, elimRounds: 0, elimAffWins: 0 });
    expect(rates.affWinRate).toBe(50);
    expect(rates.elimAffWinRate).toBeNull();
    expect(rates.negElimWinRate).toBeNull();
  });
});

describe("championshipSideBias", () => {
  it("returns the season's rates", () => {
    expect(championshipSideBias("pf", 2026, dataset)).toMatchObject({ affWinRate: 52, elimAffWinRate: 40, tabroomId: 36156 });
  });

  it("is null for a season or format without synced rounds", () => {
    expect(championshipSideBias("pf", 2024, dataset)).toBeNull();
    expect(championshipSideBias("ld", 2026, dataset)).toBeNull();
    expect(championshipSideBias("college", 2026, dataset)).toBeNull();
  });

  it("is null against the bundled (not yet synced) file", () => {
    expect(championshipSideBias("pf", 2026)).toBeNull();
  });
});

describe("sideBiasSeries", () => {
  it("covers ten seasons ending at the given year", () => {
    expect(sideBiasYearRange(2026)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  it("pools rounds for the average and drops seasons outside the window", () => {
    const pf = sideBiasSeries(2026, dataset).find((s) => s.format === "pf")!;
    expect(pf.points.map((p) => p.year)).toEqual([2025, 2026]);
    expect(pf.average).toMatchObject({ rounds: 200, affWinRate: 50, elimAffWinRate: 50 });
  });

  it("returns every format, empty ones with a null average", () => {
    const series = sideBiasSeries(2026, dataset);
    expect(series.map((s) => s.format)).toEqual(["pf", "ld", "policy", "college"]);
    expect(series.find((s) => s.format === "ld")).toMatchObject({ points: [], average: null });
    expect(hasSideBiasData(series)).toBe(true);
    expect(hasSideBiasData(sideBiasSeries(2026, { generatedAt: null, records: [] }))).toBe(false);
  });
});

describe("championship registry", () => {
  it("lists ten seasons for the TOC and the NDT", () => {
    expect(Object.keys(SIDE_BIAS_CHAMPIONSHIPS.toc)).toHaveLength(10);
    expect(Object.keys(SIDE_BIAS_CHAMPIONSHIPS.ndt)).toHaveLength(10);
  });

  it("maps college to the NDT and the high school formats to the TOC", () => {
    expect(championshipTournament("college", 2026)?.tabroomId).toBe(39306);
    expect(championshipTournament("pf", 2026)?.tabroomId).toBe(36156);
    expect(championshipTournament("ld", 2016)).toBeUndefined();
  });
});
