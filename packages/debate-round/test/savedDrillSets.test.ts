import { describe, expect, it } from "vitest";
import { isValidDrillSetRecord } from "../src/state/savedDrillSets";
import type { DrillSetRecord } from "../src/state/drillSets";

function makeRecord(overrides: Partial<DrillSetRecord> = {}): DrillSetRecord {
  return {
    roundId: "round-1",
    sideKey: "aff",
    drills: [
      { kind: "overview", rowIndex: null, prompt: "Weigh the round.", difficulty: "medium" },
      { kind: "frontline", rowIndex: 2, prompt: "Respond to the disad.", difficulty: "hard" },
    ],
    ...overrides,
  };
}

describe("isValidDrillSetRecord", () => {
  it("accepts a well-formed record with only required fields", () => {
    expect(isValidDrillSetRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with no drills", () => {
    expect(isValidDrillSetRecord(makeRecord({ drills: [] }))).toBe(true);
  });

  it("accepts a record with aiScripts present", () => {
    expect(isValidDrillSetRecord(makeRecord({ aiScripts: { 0: "Script text." } }))).toBe(true);
  });

  it("accepts a record with completedDrillIndexes present", () => {
    expect(isValidDrillSetRecord(makeRecord({ completedDrillIndexes: [0, 1] }))).toBe(true);
  });

  it("accepts a record with scheduledReviewAt present", () => {
    expect(isValidDrillSetRecord(makeRecord({ scheduledReviewAt: { 0: "2026-09-10" } }))).toBe(true);
  });

  it("accepts a record with updatedAt present", () => {
    expect(isValidDrillSetRecord(makeRecord({ updatedAt: 1700000000000 }))).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidDrillSetRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string roundId", () => {
    expect(isValidDrillSetRecord(makeRecord({ roundId: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only roundId", () => {
    expect(isValidDrillSetRecord(makeRecord({ roundId: "   " }))).toBe(false);
  });

  it("rejects a record with a non-string sideKey", () => {
    expect(isValidDrillSetRecord(makeRecord({ sideKey: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record whose drills isn't an array", () => {
    const record = makeRecord() as unknown as Record<string, unknown>;
    record.drills = "not an array";
    expect(isValidDrillSetRecord(record)).toBe(false);
  });

  it("rejects a record with an unknown drill kind", () => {
    expect(
      isValidDrillSetRecord(
        makeRecord({ drills: [{ kind: "bogus" as never, rowIndex: null, prompt: "x", difficulty: "easy" }] }),
      ),
    ).toBe(false);
  });

  it("rejects a record with an unknown drill difficulty", () => {
    expect(
      isValidDrillSetRecord(
        makeRecord({ drills: [{ kind: "overview", rowIndex: null, prompt: "x", difficulty: "impossible" as never }] }),
      ),
    ).toBe(false);
  });

  it("rejects a drill whose rowIndex is neither null nor a number", () => {
    expect(
      isValidDrillSetRecord(
        makeRecord({ drills: [{ kind: "overview", rowIndex: "2" as unknown as number, prompt: "x", difficulty: "easy" }] }),
      ),
    ).toBe(false);
  });

  it("rejects a drill whose prompt isn't a string", () => {
    expect(
      isValidDrillSetRecord(
        makeRecord({ drills: [{ kind: "overview", rowIndex: null, prompt: 5 as unknown as string, difficulty: "easy" }] }),
      ),
    ).toBe(false);
  });

  it("rejects a record whose aiScripts values aren't strings", () => {
    expect(
      isValidDrillSetRecord(makeRecord({ aiScripts: { 0: 5 as unknown as string } })),
    ).toBe(false);
  });

  it("rejects a record whose completedDrillIndexes isn't a number array", () => {
    expect(
      isValidDrillSetRecord(makeRecord({ completedDrillIndexes: ["0"] as unknown as number[] })),
    ).toBe(false);
  });

  it("rejects a record whose scheduledReviewAt values aren't strings", () => {
    expect(
      isValidDrillSetRecord(makeRecord({ scheduledReviewAt: { 0: 5 as unknown as string } })),
    ).toBe(false);
  });

  it("rejects a record whose updatedAt is present but not a number", () => {
    expect(
      isValidDrillSetRecord(makeRecord({ updatedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });
});
