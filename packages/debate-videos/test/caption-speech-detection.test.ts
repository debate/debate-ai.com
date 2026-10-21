/**
 * @fileoverview "Detect speeches" reading the captions: the pause-marked
 * transcript the model gets, the pause guess it corrects, the checks on its
 * reply, and the pause-only fallback when the model can't be asked.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SPEECH_SEGMENTATION_SYSTEM_PROMPT,
  buildSpeechSegmentationPrompt,
  parseSpeechSegmentationResponse,
  segmentationTranscript,
  type SegmentationCaption,
} from "../src/lib/speech-segmentation";
import { captionPauseSegmentation } from "../src/lib/caption-speech-split";
import { detectRoundSpeeches } from "../src/lib/speech-ai-client";

/** Captions for `minutes` of steady talking from `from`, one 4-second cue every 4 seconds. */
function talk(from: number, minutes: number, words = "and the next argument is"): SegmentationCaption[] {
  const cues: SegmentationCaption[] = [];
  for (let t = from; t < from + minutes * 60; t += 4) cues.push({ text: words, start: t, duration: 4 });
  return cues;
}

/** An LD round: each speech at its rule length, a minute of prep between speeches. */
function ldRound(): { captions: SegmentationCaption[]; starts: number[] } {
  const minutes = [6, 3, 7, 3, 4, 6, 3];
  const captions: SegmentationCaption[] = [];
  const starts: number[] = [];
  let at = 20;
  for (const length of minutes) {
    starts.push(at);
    captions.push(...talk(at, length));
    at += length * 60 + 60;
  }
  return { captions, starts };
}

describe("segmentation transcript", () => {
  it("joins cues of one unfinished sentence and marks long pauses", () => {
    const { text } = segmentationTranscript([
      { text: "so the", start: 10, duration: 1 },
      { text: "plan text is", start: 11.2, duration: 1 },
      { text: "resolved.", start: 12.4, duration: 1 },
      { text: "Okay ready?", start: 13.5, duration: 1 },
      { text: "Time starts now", start: 95, duration: 2 },
    ]);
    expect(text.split("\n")).toEqual([
      "[0:10] so the plan text is resolved.",
      "[0:13] Okay ready?",
      "[0:14] (pause 1:20)",
      "[1:35] Time starts now",
    ]);
  });

  it("marks no pause after a line with no duration", () => {
    const { text } = segmentationTranscript([
      { text: "One.", start: 10 },
      { text: "Two.", start: 200 },
    ]);
    expect(text).not.toContain("pause");
  });

  it("explains pauses, rule lengths and confidence to the model", () => {
    expect(SPEECH_SEGMENTATION_SYSTEM_PROMPT).toContain("(pause 1:20)");
    expect(SPEECH_SEGMENTATION_SYSTEM_PROMPT).toContain("1AC (8)");
    expect(SPEECH_SEGMENTATION_SYSTEM_PROMPT).toContain("Pro Final Focus (2)");
    expect(SPEECH_SEGMENTATION_SYSTEM_PROMPT).toContain('"confidence"');
  });

  it("puts the recording length and the pause guess in the user turn", () => {
    const prompt = buildSpeechSegmentationPrompt({
      captions: [{ text: "Hi.", start: 0, duration: 3725 }],
      pauseGuess: [{ name: "1AC", startSeconds: 30, endSeconds: 510 }],
    });
    expect(prompt).toContain("Captions run to: 1:02:05");
    expect(prompt).toContain("- 1AC: 0:30–8:30");
  });
});

describe("checking the model's reply", () => {
  const reply = (speeches: unknown[]) => JSON.stringify({ format: "ld", speeches });

  it("drops speeches past the recording and pulls a late end back", () => {
    const result = parseSpeechSegmentationResponse(
      reply([
        { name: "1AC", start: "0:20", end: "12:00" },
        { name: "2AR", start: "20:00", end: "23:00" },
      ]),
      { durationSeconds: 600 },
    );
    expect(result?.speeches).toEqual([{ name: "1AC", startSeconds: 20, endSeconds: 600 }]);
  });

  it("cuts an end that runs into the next speech", () => {
    const result = parseSpeechSegmentationResponse(
      reply([
        { name: "1AC", start: "0:20", end: "7:00" },
        { name: "1AX", start: "6:30", end: "9:30" },
      ]),
    );
    expect(result?.speeches[0].endSeconds).toBe(390);
  });

  it("drops low-confidence guesses and keeps the surer of two speeches at one time", () => {
    const result = parseSpeechSegmentationResponse(
      reply([
        { name: "1AC", start: "0:20", confidence: 0.9 },
        { name: "1AX", start: "0:22", confidence: 0.4 },
        { name: "1NC", start: "10:00", confidence: "85" },
        { name: "NR", start: "30:00", confidence: 0.1 },
      ]),
    );
    expect(result?.speeches).toEqual([
      { name: "1AC", startSeconds: 20, endSeconds: null, confidence: 0.9 },
      { name: "1NC", startSeconds: 600, endSeconds: null, confidence: 0.85 },
    ]);
  });
});

describe("captionPauseSegmentation", () => {
  it("places every LD speech at the pause before it", () => {
    const { captions, starts } = ldRound();
    const result = captionPauseSegmentation(captions, 3);
    expect(result?.format).toBe("ld");
    expect(result?.speeches.map((speech) => speech.name)).toEqual(["1AC", "1AX", "1NC", "1NX", "1AR", "NR", "2AR"]);
    expect(result?.speeches.map((speech) => speech.startSeconds)).toEqual(starts);
  });

  it("gives up on captions with too few spoken stretches", () => {
    expect(captionPauseSegmentation(talk(0, 2), 3)).toBeNull();
  });
});

describe("detectRoundSpeeches", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the pause guess and uses the model's answer", async () => {
    const { captions } = ldRound();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: '{"format":"ld","speeches":[{"name":"1AC","start":"0:25","confidence":0.9}]}' })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await detectRoundSpeeches({ captions }, 3);
    expect(result.source).toBe("ai");
    expect(result.segmentation.speeches[0].startSeconds).toBe(25);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Length-only guess from the caption pauses");
    expect(body.messages[0].content).toContain("- 1AC: 0:20");
  });

  it("falls back to the pause placement when the AI is unavailable", async () => {
    const { captions, starts } = ldRound();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Sign in to use AI features." }), { status: 401 })),
    );
    const result = await detectRoundSpeeches({ captions }, 3);
    expect(result.source).toBe("pauses");
    expect(result.aiError).toBe("Sign in to use AI features.");
    expect(result.segmentation.speeches[0].startSeconds).toBe(starts[0]);
  });

  it("still throws when neither the AI nor the pauses found speeches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "no idea" }))));
    await expect(detectRoundSpeeches({ captions: talk(0, 1) }, 3)).rejects.toThrow(/couldn't find any speeches/);
  });
});
