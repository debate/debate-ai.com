/**
 * @fileoverview Pins the output contract of the "Select YouTube Start" AI
 * prompt: the user prompt carries the speeches, the spoken blocks and the
 * length-only guess; the parser only accepts a reply that places every
 * speech, in order, without overlaps.
 */

import { describe, expect, it } from "vitest";

import {
  buildYouTubeSpeechTimestampsUserPrompt,
  condenseBlocks,
  parseYouTubeSpeechTimestampsResponse,
} from "../src/prompts/youtube-speech-timestamps";

const keys = ["AC", "CX after AC", "NC"];

describe("buildYouTubeSpeechTimestampsUserPrompt", () => {
  it("lists speeches, blocks and the first guess", () => {
    const prompt = buildYouTubeSpeechTimestampsUserPrompt({
      formatName: "Lincoln Douglas",
      prepMinutes: 4,
      speeches: [
        { key: "AC", expectedSeconds: 360 },
        { key: "CX after AC", expectedSeconds: 180 },
      ],
      blocks: [{ start: 12.4, end: 370, text: "I affirm the resolution" }],
      baseline: [{ key: "AC", start: 12, end: 370 }],
      firstStart: 12,
    });
    expect(prompt).toContain("Format: Lincoln Douglas");
    expect(prompt).toContain("1. AC — 6 min");
    expect(prompt).toContain("2. CX after AC — 3 min");
    expect(prompt).toContain("[12–370] I affirm the resolution");
    expect(prompt).toContain("AC: 12–370");
    expect(prompt).toContain("starting at 12s");
  });
});

describe("condenseBlocks", () => {
  it("merges the closest neighbours down to the limit", () => {
    const merged = condenseBlocks(
      [
        { start: 0, end: 10, text: "a" },
        { start: 11, end: 20, text: "b" },
        { start: 60, end: 70, text: "c" },
      ],
      2,
    );
    expect(merged).toEqual([
      { start: 0, end: 20, text: "a b" },
      { start: 60, end: 70, text: "c" },
    ]);
  });
});

describe("parseYouTubeSpeechTimestampsResponse", () => {
  const reply = {
    segments: [
      { key: "AC", start: 10, end: 370 },
      { key: "CX after AC", start: 380, end: 560 },
      { key: "NC", start: 600, end: 1020 },
    ],
    notes: "The NC opens with a roadmap.",
  };

  it("reads plain and fenced JSON", () => {
    expect(parseYouTubeSpeechTimestampsResponse(JSON.stringify(reply), keys)).toEqual(reply);
    expect(parseYouTubeSpeechTimestampsResponse("```json\n" + JSON.stringify(reply) + "\n```", keys)?.segments).toHaveLength(3);
  });

  it("rejects a reply missing a speech or out of order", () => {
    expect(parseYouTubeSpeechTimestampsResponse(JSON.stringify({ segments: reply.segments.slice(0, 2) }), keys)).toBeNull();
    const overlapping = { segments: [reply.segments[0], { key: "CX after AC", start: 100, end: 200 }, reply.segments[2]] };
    expect(parseYouTubeSpeechTimestampsResponse(JSON.stringify(overlapping), keys)).toBeNull();
    expect(parseYouTubeSpeechTimestampsResponse("not json", keys)).toBeNull();
  });
});
