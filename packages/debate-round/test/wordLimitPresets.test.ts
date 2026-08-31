import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORD_LIMIT_PRESETS,
  findPresetWordLimit,
  isValidPresetName,
  isValidPresetWordLimit,
  isValidWordLimitPresetsList,
  MAX_WORD_LIMIT_PRESETS,
  normalizePresetName,
  normalizeWordLimitPresetsPatch,
  parseWordLimitPresets,
  serializeWordLimitPresets,
  type WordLimitPreset,
} from "../src/state/wordLimitPresets";

describe("normalizePresetName", () => {
  it("trims and uppercases", () => {
    expect(normalizePresetName("  ac ")).toBe("AC");
  });
});

describe("isValidPresetName", () => {
  it("accepts a non-empty, reasonably short name", () => {
    expect(isValidPresetName("AC")).toBe(true);
    expect(isValidPresetName("1AR")).toBe(true);
  });

  it("rejects an empty, whitespace-only, too-long, or non-string name", () => {
    expect(isValidPresetName("")).toBe(false);
    expect(isValidPresetName("   ")).toBe(false);
    expect(isValidPresetName("a".repeat(41))).toBe(false);
    expect(isValidPresetName(5)).toBe(false);
  });
});

describe("isValidPresetWordLimit", () => {
  it("accepts a positive integer", () => {
    expect(isValidPresetWordLimit(600)).toBe(true);
    expect(isValidPresetWordLimit(1)).toBe(true);
  });

  it("rejects zero, negative, non-integer, too-large, or non-number values", () => {
    expect(isValidPresetWordLimit(0)).toBe(false);
    expect(isValidPresetWordLimit(-5)).toBe(false);
    expect(isValidPresetWordLimit(5.5)).toBe(false);
    expect(isValidPresetWordLimit(100_001)).toBe(false);
    expect(isValidPresetWordLimit("600")).toBe(false);
  });
});

describe("isValidWordLimitPresetsList", () => {
  it("accepts an empty list and a well-formed list", () => {
    expect(isValidWordLimitPresetsList([])).toBe(true);
    expect(isValidWordLimitPresetsList([{ name: "AC", wordLimit: 600 }])).toBe(true);
  });

  it("rejects a list exceeding the max size", () => {
    const tooMany = Array.from({ length: MAX_WORD_LIMIT_PRESETS + 1 }, (_, i) => ({
      name: `S${i}`,
      wordLimit: 100,
    }));
    expect(isValidWordLimitPresetsList(tooMany)).toBe(false);
  });

  it("rejects a list with a malformed entry", () => {
    expect(isValidWordLimitPresetsList([{ name: "AC", wordLimit: 0 }])).toBe(false);
    expect(isValidWordLimitPresetsList([{ name: "", wordLimit: 600 }])).toBe(false);
    expect(isValidWordLimitPresetsList([{ wordLimit: 600 }])).toBe(false);
  });

  it("rejects duplicate names, case-insensitively", () => {
    expect(
      isValidWordLimitPresetsList([
        { name: "AC", wordLimit: 600 },
        { name: "ac", wordLimit: 700 },
      ]),
    ).toBe(false);
  });

  it("rejects a non-array value", () => {
    expect(isValidWordLimitPresetsList({ name: "AC", wordLimit: 600 })).toBe(false);
  });
});

describe("normalizeWordLimitPresetsPatch", () => {
  it("accepts a valid patch", () => {
    const result = normalizeWordLimitPresetsPatch({ wordLimitPresets: [{ name: "AC", wordLimit: 600 }] });
    expect(result.valid).toEqual({ wordLimitPresets: [{ name: "AC", wordLimit: 600 }] });
    expect(result.errors).toEqual([]);
  });

  it("ignores an absent field", () => {
    const result = normalizeWordLimitPresetsPatch({});
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed field with a message instead of throwing", () => {
    const result = normalizeWordLimitPresetsPatch({ wordLimitPresets: "not-a-list" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object body", () => {
    expect(normalizeWordLimitPresetsPatch(null).errors).toHaveLength(1);
    expect(normalizeWordLimitPresetsPatch([]).errors).toHaveLength(1);
    expect(normalizeWordLimitPresetsPatch("nope").errors).toHaveLength(1);
  });
});

describe("serializeWordLimitPresets / parseWordLimitPresets", () => {
  it("round-trips a non-empty list", () => {
    const list: WordLimitPreset[] = [{ name: "AC", wordLimit: 600 }];
    expect(parseWordLimitPresets(serializeWordLimitPresets(list))).toEqual(list);
  });

  it("serializes an empty list to null", () => {
    expect(serializeWordLimitPresets([])).toBeNull();
  });

  it("parses a null/undefined/malformed/invalid-shape column back to an empty list", () => {
    expect(parseWordLimitPresets(null)).toEqual([]);
    expect(parseWordLimitPresets(undefined)).toEqual([]);
    expect(parseWordLimitPresets("{ not json")).toEqual([]);
    expect(parseWordLimitPresets(JSON.stringify([{ name: "AC", wordLimit: 0 }]))).toEqual([]);
  });
});

describe("findPresetWordLimit", () => {
  const presets: WordLimitPreset[] = [
    { name: "AC", wordLimit: 700 },
    { name: "1AR", wordLimit: 300 },
  ];

  it("finds a match case-insensitively and ignoring surrounding space", () => {
    expect(findPresetWordLimit(presets, " ac ")).toBe(700);
    expect(findPresetWordLimit(presets, "1ar")).toBe(300);
  });

  it("returns undefined for no match", () => {
    expect(findPresetWordLimit(presets, "NC")).toBeUndefined();
    expect(findPresetWordLimit([], "AC")).toBeUndefined();
  });
});

describe("DEFAULT_WORD_LIMIT_PRESETS", () => {
  it("is an empty list", () => {
    expect(DEFAULT_WORD_LIMIT_PRESETS.wordLimitPresets).toEqual([]);
  });
});
