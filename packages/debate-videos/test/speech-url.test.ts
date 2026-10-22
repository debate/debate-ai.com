/**
 * @fileoverview URL words for the watch page's "By speech" selection.
 */

import { describe, expect, it } from "vitest";
import { findSpeechBySlug, speechSlug } from "../src/lib/speech-url";
import type { RoundSpeech } from "../src/lib/round-speeches";

const speech = (key: string, label: string): RoundSpeech => ({
  key,
  label,
  heading: label,
  side: "neutral",
  isSpeech: true,
  startSeconds: null,
  parts: {},
});

const round = [
  speech("1AC#1", "1AC"),
  speech("CX#1", "CX"),
  speech("CX#2", "CX"),
  speech("PRO SUMMARY#1", "Pro Summary"),
  speech("2AR#1", "2AR"),
];

describe("speechSlug", () => {
  it("lower-cases the tab label and dashes its spaces", () => {
    expect(speechSlug(round, "2AR#1")).toBe("2ar");
    expect(speechSlug(round, "PRO SUMMARY#1")).toBe("pro-summary");
  });

  it("counts a label the round repeats", () => {
    expect(speechSlug(round, "CX#1")).toBe("cx");
    expect(speechSlug(round, "CX#2")).toBe("cx-2");
  });

  it("is empty for a speech the round lacks", () => {
    expect(speechSlug(round, "1NR#1")).toBe("");
  });
});

describe("findSpeechBySlug", () => {
  it("finds a speech by its word, in any case", () => {
    expect(findSpeechBySlug(round, "2AR")?.key).toBe("2AR#1");
    expect(findSpeechBySlug(round, "cx-2")?.key).toBe("CX#2");
  });

  it("finds nothing for a missing or unknown word", () => {
    expect(findSpeechBySlug(round, null)).toBeUndefined();
    expect(findSpeechBySlug(round, "1nr")).toBeUndefined();
  });
});
