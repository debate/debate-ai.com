import { describe, expect, it } from "vitest";
import {
  DEFAULT_OUTLINE_FILTER_PRESETS,
  isValidArgumentTreeFilter,
  isValidOutlineFilterPresetName,
  isValidOutlineFilterPresetsList,
  MAX_OUTLINE_FILTER_PRESETS,
  normalizeOutlineFilterPresetName,
  normalizeOutlineFilterPresetsPatch,
  parseOutlineFilterPresets,
  serializeOutlineFilterPresets,
  type OutlineFilterPreset,
} from "../src/state/outlineFilterPresets";

describe("normalizeOutlineFilterPresetName", () => {
  it("trims and uppercases", () => {
    expect(normalizeOutlineFilterPresetName("  unanswered ac turns ")).toBe("UNANSWERED AC TURNS");
  });
});

describe("isValidOutlineFilterPresetName", () => {
  it("accepts a non-empty, reasonably short name", () => {
    expect(isValidOutlineFilterPresetName("Unanswered turns")).toBe(true);
  });

  it("rejects an empty, whitespace-only, too-long, or non-string name", () => {
    expect(isValidOutlineFilterPresetName("")).toBe(false);
    expect(isValidOutlineFilterPresetName("   ")).toBe(false);
    expect(isValidOutlineFilterPresetName("a".repeat(61))).toBe(false);
    expect(isValidOutlineFilterPresetName(5)).toBe(false);
  });
});

describe("isValidArgumentTreeFilter", () => {
  it("accepts an empty filter and a fully-populated filter", () => {
    expect(isValidArgumentTreeFilter({})).toBe(true);
    expect(
      isValidArgumentTreeFilter({
        speech: "1AC",
        sideKey: "A",
        onlyUnanswered: true,
        kind: "argument",
        argumentType: "turn",
        authorId: "coach1",
        evidenceStatus: "contested",
      }),
    ).toBe(true);
  });

  it("rejects an invalid literal-union value", () => {
    expect(isValidArgumentTreeFilter({ kind: "bogus" })).toBe(false);
    expect(isValidArgumentTreeFilter({ argumentType: "bogus" })).toBe(false);
    expect(isValidArgumentTreeFilter({ evidenceStatus: "bogus" })).toBe(false);
  });

  it("rejects a wrong-typed field", () => {
    expect(isValidArgumentTreeFilter({ speech: 5 })).toBe(false);
    expect(isValidArgumentTreeFilter({ onlyUnanswered: "yes" })).toBe(false);
  });

  it("rejects an unknown key", () => {
    expect(isValidArgumentTreeFilter({ notARealField: "x" })).toBe(false);
  });

  it("rejects a non-object value", () => {
    expect(isValidArgumentTreeFilter(null)).toBe(false);
    expect(isValidArgumentTreeFilter([])).toBe(false);
    expect(isValidArgumentTreeFilter("nope")).toBe(false);
  });
});

describe("isValidOutlineFilterPresetsList", () => {
  it("accepts an empty list and a well-formed list", () => {
    expect(isValidOutlineFilterPresetsList([])).toBe(true);
    expect(isValidOutlineFilterPresetsList([{ name: "Unanswered", filter: { onlyUnanswered: true } }])).toBe(true);
  });

  it("rejects a list exceeding the max size", () => {
    const tooMany = Array.from({ length: MAX_OUTLINE_FILTER_PRESETS + 1 }, (_, i) => ({
      name: `Preset ${i}`,
      filter: {},
    }));
    expect(isValidOutlineFilterPresetsList(tooMany)).toBe(false);
  });

  it("rejects a list with a malformed entry", () => {
    expect(isValidOutlineFilterPresetsList([{ name: "", filter: {} }])).toBe(false);
    expect(isValidOutlineFilterPresetsList([{ name: "X", filter: { kind: "bogus" } }])).toBe(false);
    expect(isValidOutlineFilterPresetsList([{ filter: {} }])).toBe(false);
  });

  it("rejects duplicate names, case-insensitively", () => {
    expect(
      isValidOutlineFilterPresetsList([
        { name: "Unanswered", filter: {} },
        { name: "unanswered", filter: {} },
      ]),
    ).toBe(false);
  });

  it("rejects a non-array value", () => {
    expect(isValidOutlineFilterPresetsList({ name: "X", filter: {} })).toBe(false);
  });
});

describe("normalizeOutlineFilterPresetsPatch", () => {
  it("accepts a valid patch", () => {
    const result = normalizeOutlineFilterPresetsPatch({
      outlineFilterPresets: [{ name: "Unanswered", filter: { onlyUnanswered: true } }],
    });
    expect(result.valid).toEqual({ outlineFilterPresets: [{ name: "Unanswered", filter: { onlyUnanswered: true } }] });
    expect(result.errors).toEqual([]);
  });

  it("ignores an absent field", () => {
    const result = normalizeOutlineFilterPresetsPatch({});
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed field with a message instead of throwing", () => {
    const result = normalizeOutlineFilterPresetsPatch({ outlineFilterPresets: "not-a-list" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object body", () => {
    expect(normalizeOutlineFilterPresetsPatch(null).errors).toHaveLength(1);
    expect(normalizeOutlineFilterPresetsPatch([]).errors).toHaveLength(1);
    expect(normalizeOutlineFilterPresetsPatch("nope").errors).toHaveLength(1);
  });
});

describe("serializeOutlineFilterPresets / parseOutlineFilterPresets", () => {
  it("round-trips a non-empty list", () => {
    const list: OutlineFilterPreset[] = [{ name: "Unanswered", filter: { onlyUnanswered: true, kind: "argument" } }];
    expect(parseOutlineFilterPresets(serializeOutlineFilterPresets(list))).toEqual(list);
  });

  it("serializes an empty list to null", () => {
    expect(serializeOutlineFilterPresets([])).toBeNull();
  });

  it("parses a null/undefined/malformed/invalid-shape column back to an empty list", () => {
    expect(parseOutlineFilterPresets(null)).toEqual([]);
    expect(parseOutlineFilterPresets(undefined)).toEqual([]);
    expect(parseOutlineFilterPresets("{ not json")).toEqual([]);
    expect(parseOutlineFilterPresets(JSON.stringify([{ name: "X", filter: { kind: "bogus" } }]))).toEqual([]);
  });
});

describe("DEFAULT_OUTLINE_FILTER_PRESETS", () => {
  it("is an empty list", () => {
    expect(DEFAULT_OUTLINE_FILTER_PRESETS.outlineFilterPresets).toEqual([]);
  });
});
