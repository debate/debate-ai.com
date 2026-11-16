import { describe, expect, it } from "vitest";
import { buildFallacyFrequency } from "../src/analysis/fallacy-frequency";

describe("buildFallacyFrequency", () => {
  it("returns zeros for no speeches, blank text and non-string text", () => {
    const stats = buildFallacyFrequency([
      { label: "a", text: "" },
      { label: "b", text: "   " },
      { label: "c", text: undefined as unknown as string },
    ]);
    expect(stats).toEqual({
      speechesScanned: 0,
      wordsScanned: 0,
      totalHints: 0,
      byKind: { "ad-hominem": 0, "straw-man": 0, "false-dichotomy": 0 },
      per1000Words: 0,
      mostCommon: null,
      speechesWithHints: [],
    });
    expect(buildFallacyFrequency([]).speechesScanned).toBe(0);
  });

  it("counts clean speeches as scanned with no hints", () => {
    const stats = buildFallacyFrequency([{ label: "AC", text: "The study found a 12% drop in emissions." }]);
    expect(stats.speechesScanned).toBe(1);
    expect(stats.wordsScanned).toBe(8);
    expect(stats.totalHints).toBe(0);
    expect(stats.mostCommon).toBeNull();
  });

  it("totals hints by kind, per 1,000 words, and ranks speeches", () => {
    const stats = buildFallacyFrequency([
      { label: "R1 · AC", text: "Either we act or we fail." },
      { label: "R1 · NC", text: "You are a liar. Either we ban it or we lose. They are biased." },
      { label: "R2 · AC", text: "Fine." },
    ]);
    expect(stats.speechesScanned).toBe(3);
    expect(stats.wordsScanned).toBe(6 + 14 + 1);
    expect(stats.byKind).toEqual({ "ad-hominem": 2, "straw-man": 0, "false-dichotomy": 2 });
    expect(stats.totalHints).toBe(4);
    // 4 / 21 words × 1000 = 190.476… → one decimal
    expect(stats.per1000Words).toBe(190.5);
    // A tie goes to the first kind in `byKind` order.
    expect(stats.mostCommon).toBe("ad-hominem");
    expect(stats.speechesWithHints).toEqual([
      { label: "R1 · NC", hints: 3 },
      { label: "R1 · AC", hints: 1 },
    ]);
  });

  it("keeps input order between speeches with the same count", () => {
    const stats = buildFallacyFrequency([
      { label: "first", text: "Either this or that." },
      { label: "second", text: "Either here or there." },
    ]);
    expect(stats.speechesWithHints.map((s) => s.label)).toEqual(["first", "second"]);
    expect(stats.mostCommon).toBe("false-dichotomy");
  });
});
