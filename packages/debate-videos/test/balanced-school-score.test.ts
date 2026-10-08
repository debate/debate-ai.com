/**
 * @fileoverview Pins the Schools table's balanced score: 70% the average of
 * the top three entries, 30% average rating and depth, scaled ×1.1, diluted
 * under four teams and capped at 109.
 */

import { describe, it, expect } from "vitest";
import {
  balancedSchoolScore,
  depthScore,
  smallSchoolFactor,
  topThreeAverage,
} from "../src/panels/leaderboard/schoolScore";

describe("smallSchoolFactor", () => {
  it("dilutes schools with fewer than four teams", () => {
    expect(smallSchoolFactor(1)).toBeCloseTo(0.8, 6);
    expect(smallSchoolFactor(2)).toBeCloseTo(0.8667, 3);
    expect(smallSchoolFactor(3)).toBeCloseTo(0.9333, 3);
    for (const t of [4, 10, 500]) expect(smallSchoolFactor(t)).toBe(1);
  });
});

describe("depthScore", () => {
  it("grows with team count and tops out at 15 teams", () => {
    expect(depthScore(1)).toBeCloseTo(25, 6);
    expect(depthScore(5)).toBeCloseTo(64.62, 2);
    expect(depthScore(15)).toBeCloseTo(100, 6);
    expect(depthScore(40)).toBe(100);
    expect(depthScore(0)).toBe(0);
  });
});

describe("topThreeAverage", () => {
  it("averages the three highest ratings, or fewer when that's all there is", () => {
    expect(topThreeAverage([10, 90, 50, 80, 70])).toBeCloseTo(80, 6);
    expect(topThreeAverage([60, 80])).toBe(70);
    expect(topThreeAverage([])).toBe(0);
  });
});

describe("balancedSchoolScore", () => {
  it("matches the worked examples", () => {
    expect(balancedSchoolScore([101])).toBeCloseTo(78.85, 2);
    expect(balancedSchoolScore([98, 90, 85, 60, 40])).toBeCloseTo(93.04, 2);
  });

  it("weighs the top three entries most", () => {
    const strongTop = balancedSchoolScore([95, 92, 90, 30, 30, 30]);
    const evenMiddle = balancedSchoolScore([70, 70, 70, 70, 70, 70]);
    expect(strongTop).toBeGreaterThan(evenMiddle);
  });

  it("ranks a deep school above a one- or two-team school with the same top", () => {
    const deep = balancedSchoolScore([95, 90, 88, 60, 55, 50, 45, 40]);
    expect(deep).toBeGreaterThan(balancedSchoolScore([95]));
    expect(deep).toBeGreaterThan(balancedSchoolScore([95, 90]));
  });

  it("never goes past 109", () => {
    expect(balancedSchoolScore([109, 109, 109, ...Array(20).fill(109)])).toBe(109);
  });

  it("returns 0 with no teams", () => {
    expect(balancedSchoolScore([])).toBe(0);
  });
});

describe("balanced scores on the bundled rankings", () => {
  it("puts a few dozen schools in the 70s–90s and none past 109", async () => {
    const { loadRankingDataset } = await import("@debate/rankings-adapter");
    const { schoolRankingsFor } = await import("../src/panels/leaderboard/leaderboardUtils");
    const datasets = {
      VPF: await loadRankingDataset("hspf"),
      VLD: await loadRankingDataset("hsld"),
      VCX: await loadRankingDataset("hscx"),
      NDT: await loadRankingDataset("cpd"),
    };
    const scores = schoolRankingsFor(datasets, "all").map((r) => Math.round(r.balancedScore));
    expect(Math.max(...scores)).toBeLessThanOrEqual(109);
    expect(scores.filter((s) => s >= 70).length).toBeGreaterThanOrEqual(25);
    expect(scores.filter((s) => s >= 80).length).toBeGreaterThanOrEqual(10);
  });
});
