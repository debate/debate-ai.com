import { describe, expect, it } from "vitest";
import {
  applyWordLimitPresetOp,
  buildWordLimitPresetFailureMessage,
  DEFAULT_WORD_LIMIT_PRESETS,
  findPresetWordLimit,
  isValidPresetName,
  isValidPresetWordLimit,
  isValidWordLimitPresetsList,
  MAX_WORD_LIMIT_PRESETS,
  normalizePresetName,
  normalizeWordLimitPresetOpPatch,
  normalizeWordLimitPresetsPatch,
  parseWordLimitPresets,
  serializeWordLimitPresets,
  validateNewWordLimitPreset,
  validateWordLimitPresetUpdate,
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

describe("validateNewWordLimitPreset", () => {
  const existing: WordLimitPreset[] = [{ name: "AC", wordLimit: 600 }];

  it("allows a well-formed, non-duplicate preset", () => {
    expect(validateNewWordLimitPreset(existing, "1AR", 300)).toBeNull();
  });

  it("rejects an invalid name or word limit", () => {
    expect(validateNewWordLimitPreset(existing, "", 300)).toBe("invalid-name");
    expect(validateNewWordLimitPreset(existing, "1AR", 0)).toBe("invalid-word-limit");
  });

  it("rejects a duplicate name, case-insensitively", () => {
    expect(validateNewWordLimitPreset(existing, "ac", 700)).toBe("duplicate-name");
  });

  it("rejects adding past capacity", () => {
    const full = Array.from({ length: MAX_WORD_LIMIT_PRESETS }, (_, i) => ({ name: `S${i}`, wordLimit: 100 }));
    expect(validateNewWordLimitPreset(full, "NEW", 100)).toBe("at-capacity");
  });
});

describe("validateWordLimitPresetUpdate", () => {
  const existing: WordLimitPreset[] = [{ name: "AC", wordLimit: 600 }];

  it("allows updating an existing preset's word limit", () => {
    expect(validateWordLimitPresetUpdate(existing, "ac", 700)).toBeNull();
  });

  it("rejects updating an unknown preset", () => {
    expect(validateWordLimitPresetUpdate(existing, "Missing", 700)).toBe("unknown-preset");
  });

  it("rejects an invalid word limit", () => {
    expect(validateWordLimitPresetUpdate(existing, "AC", -1)).toBe("invalid-word-limit");
  });
});

describe("buildWordLimitPresetFailureMessage", () => {
  it("returns a distinct, name-quoting message per failure", () => {
    expect(buildWordLimitPresetFailureMessage("invalid-name", "x")).toMatch(/characters/);
    expect(buildWordLimitPresetFailureMessage("invalid-word-limit", "x")).toMatch(/word limit/i);
    expect(buildWordLimitPresetFailureMessage("duplicate-name", "AC")).toContain("AC");
    expect(buildWordLimitPresetFailureMessage("at-capacity", "x")).toMatch(/remove one first/);
    expect(buildWordLimitPresetFailureMessage("unknown-preset", "AC")).toContain("AC");
  });
});

describe("normalizeWordLimitPresetOpPatch", () => {
  it("accepts a valid addWordLimitPreset op", () => {
    const result = normalizeWordLimitPresetOpPatch({ addWordLimitPreset: { name: "AC", wordLimit: 600 } });
    expect(result.valid).toEqual({ addWordLimitPreset: { name: "AC", wordLimit: 600 } });
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid updateWordLimitPreset op", () => {
    const result = normalizeWordLimitPresetOpPatch({ updateWordLimitPreset: { name: "AC", wordLimit: 700 } });
    expect(result.valid).toEqual({ updateWordLimitPreset: { name: "AC", wordLimit: 700 } });
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid removeWordLimitPreset op", () => {
    const result = normalizeWordLimitPresetOpPatch({ removeWordLimitPreset: "AC" });
    expect(result.valid).toEqual({ removeWordLimitPreset: "AC" });
    expect(result.errors).toEqual([]);
  });

  it("returns no valid op and no errors for an empty object", () => {
    const result = normalizeWordLimitPresetOpPatch({});
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it("ignores unrelated fields alongside a valid op", () => {
    const result = normalizeWordLimitPresetOpPatch({ removeWordLimitPreset: "AC", debateStyle: 1 });
    expect(result.valid).toEqual({ removeWordLimitPreset: "AC" });
    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed addWordLimitPreset value", () => {
    expect(normalizeWordLimitPresetOpPatch({ addWordLimitPreset: "nope" }).errors).toHaveLength(1);
    expect(normalizeWordLimitPresetOpPatch({ addWordLimitPreset: { name: 1, wordLimit: 600 } }).errors).toHaveLength(
      1,
    );
    expect(
      normalizeWordLimitPresetOpPatch({ addWordLimitPreset: { name: "AC", wordLimit: "600" } }).errors,
    ).toHaveLength(1);
  });

  it("rejects a malformed updateWordLimitPreset value", () => {
    expect(normalizeWordLimitPresetOpPatch({ updateWordLimitPreset: "nope" }).errors).toHaveLength(1);
  });

  it("rejects a malformed removeWordLimitPreset value", () => {
    expect(normalizeWordLimitPresetOpPatch({ removeWordLimitPreset: "" }).errors).toHaveLength(1);
    expect(normalizeWordLimitPresetOpPatch({ removeWordLimitPreset: 5 }).errors).toHaveLength(1);
  });

  it("rejects a request carrying more than one op", () => {
    const result = normalizeWordLimitPresetOpPatch({
      removeWordLimitPreset: "AC",
      addWordLimitPreset: { name: "1AR", wordLimit: 300 },
    });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object body", () => {
    expect(normalizeWordLimitPresetOpPatch(null).errors).toHaveLength(1);
    expect(normalizeWordLimitPresetOpPatch([]).errors).toHaveLength(1);
  });
});

describe("applyWordLimitPresetOp", () => {
  const existing: WordLimitPreset[] = [
    { name: "AC", wordLimit: 600 },
    { name: "1AR", wordLimit: 300 },
  ];

  it("appends a new preset on addWordLimitPreset", () => {
    const result = applyWordLimitPresetOp(existing, { addWordLimitPreset: { name: "NC", wordLimit: 800 } });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([...existing, { name: "NC", wordLimit: 800 }]);
  });

  it("trims the name of a newly added preset", () => {
    const result = applyWordLimitPresetOp(existing, { addWordLimitPreset: { name: "  NC  ", wordLimit: 800 } });
    expect(result.next.at(-1)).toEqual({ name: "NC", wordLimit: 800 });
  });

  it("refuses adding a duplicate name and leaves the list unchanged", () => {
    const result = applyWordLimitPresetOp(existing, { addWordLimitPreset: { name: "ac", wordLimit: 900 } });
    expect(result.failure).toBe("duplicate-name");
    expect(result.next).toBe(existing);
  });

  it("updates a matching preset's word limit on updateWordLimitPreset", () => {
    const result = applyWordLimitPresetOp(existing, { updateWordLimitPreset: { name: "ac", wordLimit: 750 } });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([{ name: "AC", wordLimit: 750 }, { name: "1AR", wordLimit: 300 }]);
  });

  it("refuses updating an unknown preset", () => {
    const result = applyWordLimitPresetOp(existing, { updateWordLimitPreset: { name: "Missing", wordLimit: 100 } });
    expect(result.failure).toBe("unknown-preset");
    expect(result.next).toBe(existing);
  });

  it("removes a matching preset on removeWordLimitPreset", () => {
    const result = applyWordLimitPresetOp(existing, { removeWordLimitPreset: "AC" });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([{ name: "1AR", wordLimit: 300 }]);
  });

  it("is idempotent (same reference) when removing an absent name", () => {
    const result = applyWordLimitPresetOp(existing, { removeWordLimitPreset: "Missing" });
    expect(result.failure).toBeNull();
    expect(result.next).toBe(existing);
  });

  it("returns the current list unchanged for an empty op", () => {
    const result = applyWordLimitPresetOp(existing, {});
    expect(result.failure).toBeNull();
    expect(result.next).toBe(existing);
  });

  it("resolves two different concurrent add ops onto the same starting list without dropping either", () => {
    // The scenario the whole-list-replace race used to lose: two
    // tabs/devices both read the same starting list, each adds a different
    // preset, and both ops must be applied server-side in sequence rather
    // than either PUT trusting a client-computed whole-list snapshot.
    const afterFirst = applyWordLimitPresetOp(existing, { addWordLimitPreset: { name: "2AR", wordLimit: 250 } });
    const afterSecond = applyWordLimitPresetOp(afterFirst.next, {
      addWordLimitPreset: { name: "1NR", wordLimit: 350 },
    });
    expect(afterSecond.next).toEqual([
      { name: "AC", wordLimit: 600 },
      { name: "1AR", wordLimit: 300 },
      { name: "2AR", wordLimit: 250 },
      { name: "1NR", wordLimit: 350 },
    ]);
  });
});
