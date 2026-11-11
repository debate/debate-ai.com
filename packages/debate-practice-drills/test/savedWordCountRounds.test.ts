import { describe, expect, it } from "vitest";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";
import {
  isValidWordCountRoundRecord,
  MAX_WORD_COUNT_ROUND_ID_LENGTH,
} from "../src/state/savedWordCountRounds";

function makeRecord(overrides: Record<string, unknown> = {}): WordCountRoundRecord {
  return {
    roundId: "round-1",
    styleKey: "practicePublicForum",
    submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one." }],
    ...overrides,
  } as WordCountRoundRecord;
}

describe("isValidWordCountRoundRecord", () => {
  it("accepts a well-formed record, with or without timestamps", () => {
    expect(isValidWordCountRoundRecord(makeRecord())).toBe(true);
    expect(isValidWordCountRoundRecord(makeRecord({ createdAt: 1, updatedAt: 2 }))).toBe(true);
    expect(isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: [] }))).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(isValidWordCountRoundRecord(null)).toBe(false);
    expect(isValidWordCountRoundRecord("round-1")).toBe(false);
    expect(isValidWordCountRoundRecord([])).toBe(false);
  });

  it("rejects a missing, blank or overlong roundId", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ roundId: undefined }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ roundId: 7 }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ roundId: "   " }))).toBe(false);
    expect(
      isValidWordCountRoundRecord(makeRecord({ roundId: "r".repeat(MAX_WORD_COUNT_ROUND_ID_LENGTH + 1) })),
    ).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ roundId: "r".repeat(MAX_WORD_COUNT_ROUND_ID_LENGTH) }))).toBe(
      true,
    );
  });

  it("rejects a style debate-timer doesn't know, including inherited keys", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ styleKey: "madeUpStyle" }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ styleKey: "toString" }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ styleKey: 3 }))).toBe(false);
  });

  it("rejects malformed speeches", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: "AC" }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: [null] }))).toBe(false);
    expect(
      isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: [{ name: "AC", speaker: "A1" }] })),
    ).toBe(false);
    expect(
      isValidWordCountRoundRecord(makeRecord({ submittedSpeeches: [{ name: "AC", speaker: 1, text: "x" }] })),
    ).toBe(false);
  });

  it("rejects non-numeric or non-finite timestamps", () => {
    expect(isValidWordCountRoundRecord(makeRecord({ createdAt: "today" }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ updatedAt: Number.NaN }))).toBe(false);
    expect(isValidWordCountRoundRecord(makeRecord({ updatedAt: Number.POSITIVE_INFINITY }))).toBe(false);
  });
});
