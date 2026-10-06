/**
 * @fileoverview Pins the Schools table's balanced score: 60% average + 40% best,
 * times a team-count bonus that grows with diminishing returns and stays under 15%.
 */

import { describe, it, expect } from "vitest";
import { balancedSchoolScore } from "../src/panels/leaderboard/schoolScore";

describe("balancedSchoolScore", () => {
  it("gives a one-team school no depth bonus", () => {
    expect(balancedSchoolScore(101, 101, 1)).toBeCloseTo(101, 6);
  });

  it("matches the worked examples", () => {
    expect(balancedSchoolScore(98, 76, 5)).toBeCloseTo(90.45, 2);
    expect(balancedSchoolScore(106, 59, 25)).toBeCloseTo(87.46, 2);
    expect(balancedSchoolScore(97, 61, 7)).toBeCloseTo(81.57, 2);
  });

  it("caps the depth bonus below 15%", () => {
    expect(balancedSchoolScore(100, 100, 10_000)).toBeLessThan(115);
    expect(balancedSchoolScore(100, 100, 10)).toBeGreaterThan(balancedSchoolScore(100, 100, 5));
  });

  it("returns 0 with no teams", () => {
    expect(balancedSchoolScore(100, 100, 0)).toBe(0);
  });
});
