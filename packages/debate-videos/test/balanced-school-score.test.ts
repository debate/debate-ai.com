/**
 * @fileoverview Pins the Schools table's balanced score: 70% average + 30% best,
 * times a team-count factor that dilutes schools under four teams and prefers
 * schools with 5–20 teams.
 */

import { describe, it, expect } from "vitest";
import { balancedSchoolScore, teamCountFactor } from "../src/panels/leaderboard/schoolScore";

describe("teamCountFactor", () => {
  it("dilutes schools with fewer than four teams", () => {
    expect(teamCountFactor(1)).toBeCloseTo(0.8, 6);
    expect(teamCountFactor(2)).toBeCloseTo(0.8667, 3);
    expect(teamCountFactor(3)).toBeCloseTo(0.9333, 3);
    expect(teamCountFactor(4)).toBeCloseTo(1, 6);
  });

  it("gives the full bonus to 5–20 teams", () => {
    for (const t of [5, 10, 20]) expect(teamCountFactor(t)).toBeCloseTo(1.1, 6);
  });

  it("tapers very large schools but keeps a bonus", () => {
    expect(teamCountFactor(30)).toBeCloseTo(1.075, 6);
    expect(teamCountFactor(40)).toBeCloseTo(1.05, 6);
    expect(teamCountFactor(500)).toBeCloseTo(1.05, 6);
  });
});

describe("balancedSchoolScore", () => {
  it("matches the worked examples", () => {
    expect(balancedSchoolScore(101, 101, 1)).toBeCloseTo(80.8, 2);
    expect(balancedSchoolScore(98, 76, 5)).toBeCloseTo(90.86, 2);
    expect(balancedSchoolScore(106, 59, 25)).toBeCloseTo(79.5, 2);
  });

  it("ranks a deep school that does well on average above a one- or two-team school", () => {
    const deep = balancedSchoolScore(80, 66, 5);
    expect(deep).toBeGreaterThan(balancedSchoolScore(89, 89, 1));
    expect(deep).toBeGreaterThan(balancedSchoolScore(88, 88, 1));
    expect(deep).toBeGreaterThan(balancedSchoolScore(85, 72, 3));
  });

  it("returns 0 with no teams", () => {
    expect(balancedSchoolScore(100, 100, 0)).toBe(0);
  });
});
