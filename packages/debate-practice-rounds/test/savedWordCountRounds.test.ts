import { describe, expect, it } from "vitest";
import { isValidWordCountRoundRecord } from "../src/state/savedWordCountRounds";
import type { WordCountRoundRecord } from "debate-round/src/state/wordCountRounds";

function makeRecord(overrides: Partial<WordCountRoundRecord> = {}): WordCountRoundRecord {
  return {
    roundId: "round-1",
    styleKey: "practicePublicForum",
    submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one is..." }],
    ...overrides,
  };
}

describe("isValidWordCountRoundRecord", () => {
  it("accepts a well-formed record with only required fields", () => {
    expect(isValidWordCountRoundRecord(makeRecord())).toBe(true);
  });

  it("accepts a record with createdAt present", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ createdAt: 1700000000000 }))).toBe(true);
  });

  it("accepts a record with updatedAt present", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ updatedAt: 1700000000000 }))).toBe(true);
  });

  it("accepts a record with no submitted speeches", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: [] }))).toBe(true);
  });

  it.each([null, undefined, "record", 42, [], true])("rejects a non-object value %p", (value) => {
    expect(isValidWordCountRoundRecord(value)).toBe(false);
  });

  it("rejects a record with a non-string roundId", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ roundId: 5 as unknown as string }))).toBe(false);
  });

  it("rejects a record with an empty/whitespace-only roundId", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ roundId: "   " }))).toBe(false);
  });

  it("rejects a record whose styleKey isn't a known debate-timer word-count style", () => {
    expect(
      isValidWordCountRoundRecord(makeRecord({ styleKey: "notARealStyle" as unknown as WordCountRoundRecord["styleKey"] })),
    ).toBe(false);
  });

  it("rejects a record whose submittedSpeeches isn't an array", () => {
    const record = makeRecord() as unknown as Record<string, unknown>;
    record.submittedSpeeches = "not an array";
    expect(isValidWordCountRoundRecord(record)).toBe(false);
  });

  it.each(["name", "speaker", "text"] as const)("rejects a submission missing field %p", (field) => {
    const submission = { name: "AC", speaker: "A1", text: "..." } as Record<string, unknown>;
    delete submission[field];
    expect(isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: [submission as never] }))).toBe(false);
  });

  it("rejects a submission whose fields aren't strings", () => {
    expect(
      isValidWordCountRoundRecord(
        makeRecord({ submittedSpeeches: [{ name: "AC", speaker: "A1", text: 5 as unknown as string }] }),
      ),
    ).toBe(false);
  });

  it("rejects a record whose createdAt is present but not a number", () => {
    expect(
      isValidWordCountRoundRecord(makeRecord({ createdAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });

  it("rejects a record whose updatedAt is present but not a number", () => {
    expect(
      isValidWordCountRoundRecord(makeRecord({ updatedAt: "yesterday" as unknown as number })),
    ).toBe(false);
  });
});
