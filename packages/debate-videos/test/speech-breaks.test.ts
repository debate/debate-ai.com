/**
 * @fileoverview The quiet breaks between a round's speeches, and when the
 * watch page's "Skip breaks" jumps over one.
 */

import { describe, expect, it } from "vitest";
import type { RoundSpeech } from "../src/lib/round-speeches";
import { BREAK_LEAD_IN_SECONDS, breakSkipTarget, speechBreaks } from "../src/lib/speech-breaks";

function speech(key: string, startSeconds: number | null, endSeconds: number | null = null, isSpeech = true): RoundSpeech {
  return { key, label: key, heading: key, side: "aff", isSpeech, startSeconds, endSeconds, parts: {} };
}

const cue = (start: number, duration = 3) => ({ start, duration });

describe("speechBreaks", () => {
  it("uses a detected speech end", () => {
    expect(speechBreaks([speech("1AC", 0, 480), speech("1NC", 600)], [])).toEqual([{ start: 480, end: 600 }]);
  });

  it("ends a speech with its last caption when it has no end", () => {
    const cues = [cue(5), cue(200), cue(470, 5), cue(610)];
    expect(speechBreaks([speech("1AC", 0), speech("1NC", 600)], cues)).toEqual([{ start: 475, end: 600 }]);
  });

  it("ignores gaps shorter than the minimum", () => {
    expect(speechBreaks([speech("1AC", 0, 595), speech("1NC", 600)], [])).toEqual([]);
  });

  it("finds no break without an end or captions", () => {
    expect(speechBreaks([speech("1AC", 0), speech("1NC", 600)], null)).toEqual([]);
  });

  it("orders speeches by start and skips untimed ones and the decision", () => {
    const breaks = speechBreaks(
      [speech("1NC", 600, 900), speech("1AC", 0, 480), speech("CX", null), speech("Decision", 1000, null, false)],
      [],
    );
    expect(breaks).toEqual([{ start: 480, end: 600 }]);
  });
});

describe("breakSkipTarget", () => {
  const breaks = [{ start: 480, end: 600 }];

  it("jumps when playback runs into a break", () => {
    expect(breakSkipTarget(breaks, 479.6, 480.2)).toBe(600 - BREAK_LEAD_IN_SECONDS);
  });

  it("leaves a reader who sought into the break alone", () => {
    expect(breakSkipTarget(breaks, 120, 540)).toBeNull();
    expect(breakSkipTarget(breaks, 540, 540.5)).toBeNull();
  });

  it("does nothing outside a break or on a backwards seek", () => {
    expect(breakSkipTarget(breaks, 300, 300.5)).toBeNull();
    expect(breakSkipTarget(breaks, 700, 481)).toBeNull();
  });
});
