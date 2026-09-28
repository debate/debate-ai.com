import { describe, expect, it } from "vitest";
import {
  applyOutlineFilterPresetOp,
  buildOutlineFilterPresetFailureMessage,
  DEFAULT_OUTLINE_FILTER_PRESETS,
  isValidArgumentTreeFilter,
  isValidOutlineFilterPresetName,
  isValidOutlineFilterPresetsList,
  MAX_OUTLINE_FILTER_PRESETS,
  normalizeOutlineFilterPresetName,
  normalizeOutlineFilterPresetOpPatch,
  normalizeOutlineFilterPresetsPatch,
  parseOutlineFilterPresets,
  serializeOutlineFilterPresets,
  validateNewOutlineFilterPreset,
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

  it("accepts an entry with a roundId and one without", () => {
    expect(
      isValidOutlineFilterPresetsList([
        { name: "Unanswered", filter: {}, roundId: "round-1" },
        { name: "Cited only", filter: {} },
      ]),
    ).toBe(true);
  });

  it("rejects an entry with a non-string roundId", () => {
    expect(isValidOutlineFilterPresetsList([{ name: "X", filter: {}, roundId: 5 }])).toBe(false);
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

  it("round-trips a preset's roundId", () => {
    const list: OutlineFilterPreset[] = [{ name: "Unanswered", filter: {}, roundId: "round-42" }];
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

describe("validateNewOutlineFilterPreset", () => {
  const existing: OutlineFilterPreset[] = [{ name: "Unanswered", filter: { onlyUnanswered: true } }];

  it("allows a well-formed, non-duplicate preset", () => {
    expect(validateNewOutlineFilterPreset(existing, "Cited only", { evidenceStatus: "cited" })).toBeNull();
  });

  it("rejects an invalid name or filter", () => {
    expect(validateNewOutlineFilterPreset(existing, "", { onlyUnanswered: true })).toBe("invalid-name");
    expect(validateNewOutlineFilterPreset(existing, "New", { kind: "bogus" } as never)).toBe("invalid-filter");
  });

  it("rejects a duplicate name, case-insensitively", () => {
    expect(validateNewOutlineFilterPreset(existing, "unanswered", {})).toBe("duplicate-name");
  });

  it("rejects adding past capacity", () => {
    const full: OutlineFilterPreset[] = Array.from({ length: MAX_OUTLINE_FILTER_PRESETS }, (_, i) => ({
      name: `Preset ${i}`,
      filter: {},
    }));
    expect(validateNewOutlineFilterPreset(full, "One more", {})).toBe("at-capacity");
  });
});

describe("buildOutlineFilterPresetFailureMessage", () => {
  it("returns a distinct, name-quoting message per failure", () => {
    expect(buildOutlineFilterPresetFailureMessage("invalid-name", "x")).toMatch(/characters/);
    expect(buildOutlineFilterPresetFailureMessage("invalid-filter", "x")).toMatch(/filter/i);
    expect(buildOutlineFilterPresetFailureMessage("duplicate-name", "Unanswered")).toContain("Unanswered");
    expect(buildOutlineFilterPresetFailureMessage("at-capacity", "x")).toMatch(/remove one first/);
  });
});

describe("normalizeOutlineFilterPresetOpPatch", () => {
  it("accepts a valid addOutlineFilterPreset op", () => {
    const result = normalizeOutlineFilterPresetOpPatch({
      addOutlineFilterPreset: { name: "Unanswered", filter: { onlyUnanswered: true } },
    });
    expect(result.valid).toEqual({ addOutlineFilterPreset: { name: "Unanswered", filter: { onlyUnanswered: true } } });
    expect(result.errors).toEqual([]);
  });

  it("accepts an addOutlineFilterPreset op carrying a roundId", () => {
    const result = normalizeOutlineFilterPresetOpPatch({
      addOutlineFilterPreset: { name: "Unanswered", filter: {}, roundId: "round-1" },
    });
    expect(result.valid).toEqual({
      addOutlineFilterPreset: { name: "Unanswered", filter: {}, roundId: "round-1" },
    });
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid removeOutlineFilterPreset op", () => {
    const result = normalizeOutlineFilterPresetOpPatch({ removeOutlineFilterPreset: "Unanswered" });
    expect(result.valid).toEqual({ removeOutlineFilterPreset: "Unanswered" });
    expect(result.errors).toEqual([]);
  });

  it("returns no valid op and no errors for an empty object", () => {
    const result = normalizeOutlineFilterPresetOpPatch({});
    expect(result.valid).toEqual({});
    expect(result.errors).toEqual([]);
  });

  it("ignores unrelated fields alongside a valid op", () => {
    const result = normalizeOutlineFilterPresetOpPatch({ removeOutlineFilterPreset: "Unanswered", debateStyle: 1 });
    expect(result.valid).toEqual({ removeOutlineFilterPreset: "Unanswered" });
    expect(result.errors).toEqual([]);
  });

  it("rejects a malformed addOutlineFilterPreset value", () => {
    expect(normalizeOutlineFilterPresetOpPatch({ addOutlineFilterPreset: "nope" }).errors).toHaveLength(1);
    expect(
      normalizeOutlineFilterPresetOpPatch({ addOutlineFilterPreset: { name: 1, filter: {} } }).errors,
    ).toHaveLength(1);
    expect(
      normalizeOutlineFilterPresetOpPatch({ addOutlineFilterPreset: { name: "X", filter: { kind: "bogus" } } })
        .errors,
    ).toHaveLength(1);
  });

  it("rejects a malformed removeOutlineFilterPreset value", () => {
    expect(normalizeOutlineFilterPresetOpPatch({ removeOutlineFilterPreset: "" }).errors).toHaveLength(1);
    expect(normalizeOutlineFilterPresetOpPatch({ removeOutlineFilterPreset: 5 }).errors).toHaveLength(1);
  });

  it("rejects a request carrying more than one op", () => {
    const result = normalizeOutlineFilterPresetOpPatch({
      removeOutlineFilterPreset: "Unanswered",
      addOutlineFilterPreset: { name: "Cited only", filter: {} },
    });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("rejects a non-object body", () => {
    expect(normalizeOutlineFilterPresetOpPatch(null).errors).toHaveLength(1);
    expect(normalizeOutlineFilterPresetOpPatch([]).errors).toHaveLength(1);
  });
});

describe("applyOutlineFilterPresetOp", () => {
  const existing: OutlineFilterPreset[] = [
    { name: "Unanswered", filter: { onlyUnanswered: true } },
    { name: "Cited only", filter: { evidenceStatus: "cited" }, roundId: "round-1" },
  ];

  it("appends a new preset on addOutlineFilterPreset", () => {
    const result = applyOutlineFilterPresetOp(existing, {
      addOutlineFilterPreset: { name: "Turns", filter: { argumentType: "turn" } },
    });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([...existing, { name: "Turns", filter: { argumentType: "turn" } }]);
  });

  it("keeps a newly added preset's roundId", () => {
    const result = applyOutlineFilterPresetOp(existing, {
      addOutlineFilterPreset: { name: "Turns", filter: {}, roundId: "round-2" },
    });
    expect(result.next.at(-1)).toEqual({ name: "Turns", filter: {}, roundId: "round-2" });
  });

  it("trims the name of a newly added preset", () => {
    const result = applyOutlineFilterPresetOp(existing, {
      addOutlineFilterPreset: { name: "  Turns  ", filter: {} },
    });
    expect(result.next.at(-1)?.name).toBe("Turns");
  });

  it("refuses adding a duplicate name and leaves the list unchanged", () => {
    const result = applyOutlineFilterPresetOp(existing, {
      addOutlineFilterPreset: { name: "unanswered", filter: {} },
    });
    expect(result.failure).toBe("duplicate-name");
    expect(result.next).toBe(existing);
  });

  it("removes a matching preset on removeOutlineFilterPreset", () => {
    const result = applyOutlineFilterPresetOp(existing, { removeOutlineFilterPreset: "Unanswered" });
    expect(result.failure).toBeNull();
    expect(result.next).toEqual([existing[1]]);
  });

  it("is idempotent (same reference) when removing an absent name", () => {
    const result = applyOutlineFilterPresetOp(existing, { removeOutlineFilterPreset: "Missing" });
    expect(result.failure).toBeNull();
    expect(result.next).toBe(existing);
  });

  it("returns the current list unchanged for an empty op", () => {
    const result = applyOutlineFilterPresetOp(existing, {});
    expect(result.failure).toBeNull();
    expect(result.next).toBe(existing);
  });

  it("resolves two different concurrent add ops onto the same starting list without dropping either", () => {
    // The scenario the whole-list-replace race used to lose: two
    // tabs/devices both read the same starting list, each adds a different
    // preset, and both ops must be applied server-side in sequence rather
    // than either PUT trusting a client-computed whole-list snapshot.
    const afterFirst = applyOutlineFilterPresetOp(existing, {
      addOutlineFilterPreset: { name: "Turns", filter: { argumentType: "turn" } },
    });
    const afterSecond = applyOutlineFilterPresetOp(afterFirst.next, {
      addOutlineFilterPreset: { name: "Extensions", filter: { argumentType: "extension" } },
    });
    expect(afterSecond.next).toEqual([
      ...existing,
      { name: "Turns", filter: { argumentType: "turn" } },
      { name: "Extensions", filter: { argumentType: "extension" } },
    ]);
  });
});
