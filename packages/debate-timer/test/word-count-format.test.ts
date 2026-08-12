import { describe, expect, it } from "vitest";
import {
  countWords,
  estimateWordLimit,
  getWordCountStatus,
  wordCountStyleMap,
  wordCountStyleNames,
  wordCountStyles,
} from "../src/formats/word-count-format";

describe("countWords", () => {
  it("counts space-separated words", () => {
    expect(countWords("the quick brown fox")).toBe(4);
  });

  it("treats runs of whitespace, tabs and newlines as one separator", () => {
    expect(countWords("one  two\tthree\nfour")).toBe(4);
  });

  it("returns 0 for empty or whitespace-only input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t  ")).toBe(0);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });
});

describe("estimateWordLimit", () => {
  it("scales by the default speaking pace", () => {
    expect(estimateWordLimit(4)).toBe(4 * 150);
  });

  it("accepts a custom words-per-minute pace", () => {
    expect(estimateWordLimit(2, 120)).toBe(240);
  });

  it("rounds to the nearest whole word", () => {
    expect(estimateWordLimit(1, 125.4)).toBe(125);
  });
});

describe("getWordCountStatus", () => {
  it("reports remaining words under the limit", () => {
    const status = getWordCountStatus("one two three", 10);
    expect(status.count).toBe(3);
    expect(status.remaining).toBe(7);
    expect(status.overLimit).toBe(false);
    expect(status.percentUsed).toBeCloseTo(0.3);
  });

  it("flags submissions over the limit with negative remaining", () => {
    const status = getWordCountStatus("one two three four", 2);
    expect(status.count).toBe(4);
    expect(status.remaining).toBe(-2);
    expect(status.overLimit).toBe(true);
    expect(status.percentUsed).toBe(1);
  });

  it("treats a submission exactly at the limit as not over", () => {
    const status = getWordCountStatus("one two", 2);
    expect(status.remaining).toBe(0);
    expect(status.overLimit).toBe(false);
    expect(status.percentUsed).toBe(1);
  });

  it("handles a zero word limit without dividing by zero", () => {
    const status = getWordCountStatus("one", 0);
    expect(status.percentUsed).toBe(0);
    expect(status.overLimit).toBe(true);
  });
});

describe("word-count style registry", () => {
  it("defines a config for every style key", () => {
    for (const key of wordCountStyleMap) {
      expect(wordCountStyles[key], `missing config for ${key}`).toBeDefined();
    }
  });

  it("names every style", () => {
    expect(wordCountStyleNames).toHaveLength(wordCountStyleMap.length);
    expect(wordCountStyleNames.every((name) => name.trim().length > 0)).toBe(true);
  });

  it("keeps style keys unique", () => {
    expect(new Set(wordCountStyleMap).size).toBe(wordCountStyleMap.length);
  });

  it("inverts the secondary side relative to the primary", () => {
    for (const key of wordCountStyleMap) {
      const style = wordCountStyles[key];
      if (!style.secondary) continue;
      expect(style.primary.invert, key).toBe(false);
      expect(style.secondary.invert, key).toBe(true);
    }
  });

  it("gives every speech a positive word limit and a speaker", () => {
    for (const key of wordCountStyleMap) {
      for (const speech of wordCountStyles[key].speeches) {
        expect(speech.wordLimit, `${key} ${speech.name}`).toBeGreaterThan(0);
        expect(speech.name.length, key).toBeGreaterThan(0);
      }
    }
  });
});
