/** Unit tests for `round/my-speeches` — which speeches the viewer gives. */

import { describe, expect, it } from "vitest";

import { findViewerSeat, isViewerSpeech } from "../src/round/my-speeches";
import type { Round } from "../src/types/flow";

const round = {
  id: 1,
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  debaters: { aff: ["a1@x.com", "a2@x.com"], neg: ["n1@x.com", "N2@X.com"] },
  judges: ["judge@x.com"],
  flowIds: [],
  timestamp: 0,
  status: "active",
} as Round;

describe("findViewerSeat", () => {
  it("finds the viewer's side and slot, case-insensitively", () => {
    expect(findViewerSeat(round, ["a2@x.com"])).toEqual({ side: "aff", index: 1 });
    expect(findViewerSeat(round, [" n2@x.com "])).toEqual({ side: "neg", index: 1 });
  });

  it("returns null for judges, strangers, blanks and no round", () => {
    expect(findViewerSeat(round, ["judge@x.com"])).toBeNull();
    expect(findViewerSeat(round, ["other@x.com", null, ""])).toBeNull();
    expect(findViewerSeat(undefined, ["a1@x.com"])).toBeNull();
  });

  it("checks every email given", () => {
    expect(findViewerSeat(round, [null, "n1@x.com"])).toEqual({ side: "neg", index: 0 });
  });
});

describe("isViewerSpeech", () => {
  it("matches Policy speaker codes by side and speaker number", () => {
    const seat = { side: "aff" as const, index: 0 };
    expect(isViewerSpeech({ speaker: "1A", secondary: false }, seat)).toBe(true);
    expect(isViewerSpeech({ speaker: "2A", secondary: false }, seat)).toBe(false);
    expect(isViewerSpeech({ speaker: "1N", secondary: true }, seat)).toBe(false);
  });

  it("matches PF speaker codes", () => {
    const seat = { side: "neg" as const, index: 1 };
    expect(isViewerSpeech({ speaker: "N2", secondary: true }, seat)).toBe(true);
    expect(isViewerSpeech({ speaker: "N1", secondary: true }, seat)).toBe(false);
  });

  it("gives every speech on a side to either debater when the code has no number (LD)", () => {
    expect(isViewerSpeech({ speaker: "A", secondary: false }, { side: "aff", index: 0 })).toBe(true);
    expect(isViewerSpeech({ speaker: "N", secondary: true }, { side: "aff", index: 0 })).toBe(false);
  });

  it("falls back to the speech's side without a speaker code", () => {
    expect(isViewerSpeech({ secondary: true }, { side: "neg", index: 0 })).toBe(true);
    expect(isViewerSpeech({ secondary: false }, { side: "neg", index: 0 })).toBe(false);
  });

  it("is false when the viewer has no seat", () => {
    expect(isViewerSpeech({ speaker: "1A", secondary: false }, null)).toBe(false);
  });
});
