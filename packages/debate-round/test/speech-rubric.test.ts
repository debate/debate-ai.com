/** Unit tests for `round/speech-rubric` — scoring math and scorecard text. */

import { describe, expect, it } from "vitest";

import {
  RUBRIC_CATEGORIES,
  clampScore,
  defaultScores,
  normalizeScores,
  radarPoints,
  scorecardText,
  totalLabel,
  totalScore,
} from "../src/round/speech-rubric";

describe("speech rubric", () => {
  it("has five categories and defaults every one to 3 (15/25)", () => {
    expect(RUBRIC_CATEGORIES).toHaveLength(5);
    expect(totalScore(defaultScores())).toBe(15);
  });

  it("clamps and rounds scores, defaulting garbage to 3", () => {
    expect(clampScore(9)).toBe(5);
    expect(clampScore(0)).toBe(1);
    expect(clampScore("4")).toBe(4);
    expect(clampScore(2.6)).toBe(3);
    expect(clampScore("x")).toBe(3);
    expect(clampScore(undefined)).toBe(3);
  });

  it("repairs partial or corrupt stored scores", () => {
    expect(normalizeScores(undefined)).toEqual(defaultScores());
    expect(normalizeScores({ evidence: 5, clash: "nope", analysis: 99 })).toEqual({
      ...defaultScores(),
      evidence: 5,
      clash: 3,
      analysis: 5,
    });
  });

  it("labels totals at the documented thresholds", () => {
    expect(totalLabel(25)).toBe("Exceptional");
    expect(totalLabel(23)).toBe("Exceptional");
    expect(totalLabel(22)).toBe("Strong");
    expect(totalLabel(19)).toBe("Strong");
    expect(totalLabel(18)).toBe("Competent");
    expect(totalLabel(14)).toBe("Competent");
    expect(totalLabel(13)).toBe("Weak");
    expect(totalLabel(9)).toBe("Weak");
    expect(totalLabel(8)).toBe("Deficient");
    expect(totalLabel(5)).toBe("Deficient");
  });

  it("scores categories independently — a 5 in Evidence and 2 in Analysis", () => {
    const scores = { ...defaultScores(), evidence: 5, analysis: 2 };
    expect(radarPoints(scores).map((p) => p.score)).toEqual([3, 5, 2, 3, 3]);
    expect(totalScore(scores)).toBe(16);
  });

  it("writes a copyable scorecard with optional notes", () => {
    const text = scorecardText("1AC", { ...defaultScores(), evidence: 5 }, "  Slow down on tags  ");
    expect(text).toContain("Debate Speech Rubric — 1AC");
    expect(text).toContain("Total: 17/25 — Competent");
    expect(text).toContain("Evidence Quality: 5/5 — Exceptional");
    expect(text).toContain("Judge notes: Slow down on tags");
    expect(scorecardText("1AC", defaultScores())).not.toContain("Judge notes");
  });
});
