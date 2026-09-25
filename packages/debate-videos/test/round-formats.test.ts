// @vitest-environment jsdom
/**
 * @fileoverview Every round gets speeches: from its documents when they go
 * speech by speech, otherwise its format's standard order — timed by the
 * reader's marks, with the captions under each mark as its transcript.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { resolveRoundSpeeches, standardRoundSpeeches } from "../src/lib/round-formats";
import { captionText, withCaptionTranscripts, withSpeechStarts } from "../src/lib/round-speeches";
import type { VideoDocument } from "../src/lib/video-documents";
import { readSpeechStarts, writeSpeechStart } from "../src/state/speechStartMarks";

const doc = (kind: VideoDocument["kind"], body: string): VideoDocument => ({ videoId: "v", kind, body, author: "editor" });

describe("standardRoundSpeeches", () => {
  it("lays out LD with keys that match a written summary's", () => {
    const speeches = standardRoundSpeeches(3);
    expect(speeches.map((speech) => speech.label)).toEqual(["1AC", "CX · 1AC", "1NC", "CX · 1NC", "1AR", "NR", "2AR"]);
    expect(speeches.map((speech) => speech.key)).toEqual(["1AC#1", "CX#1", "1NC#1", "CX#2", "1AR#1", "NR#1", "2AR#1"]);
    expect(speeches.map((speech) => speech.side)).toEqual(["aff", "cx", "neg", "cx", "aff", "neg", "aff"]);
    expect(speeches.every((speech) => speech.startSeconds === null && speech.isSpeech)).toBe(true);
  });

  it("lays out Policy, College and PF, and nothing for a lecture", () => {
    expect(standardRoundSpeeches(1)).toHaveLength(12);
    expect(standardRoundSpeeches(4).map((speech) => speech.key)).toEqual(standardRoundSpeeches(1).map((speech) => speech.key));
    const pf = standardRoundSpeeches(2);
    expect(pf.map((speech) => speech.label)).toContain("Grand Crossfire");
    expect(pf.find((speech) => speech.label === "Con Final Focus")?.side).toBe("neg");
    expect(standardRoundSpeeches(undefined)).toEqual([]);
    expect(standardRoundSpeeches(9)).toEqual([]);
  });
});

describe("resolveRoundSpeeches", () => {
  const summary = doc("summary", "## 1AC\n\nA\n\n## 1NC\n\nB");
  const transcript = doc("transcript", "## 1AC (0:00)\n\nWords.\n\n## 1NC (6:00)\n\nMore words.");

  it("prefers the written summary", () => {
    expect(resolveRoundSpeeches([summary], 3).map((speech) => speech.label)).toEqual(["1AC", "1NC"]);
  });

  it("splits a round's transcript alone, but not a lecture's", () => {
    expect(resolveRoundSpeeches([transcript], 3).map((speech) => [speech.label, speech.startSeconds])).toEqual([
      ["1AC", 0],
      ["1NC", 360],
    ]);
    expect(resolveRoundSpeeches([transcript], "Theory")).toEqual([]);
  });

  it("falls back to the format's order for a round with nothing written", () => {
    expect(resolveRoundSpeeches([], 3)).toHaveLength(7);
    expect(resolveRoundSpeeches([], "Kritiks")).toEqual([]);
  });
});

describe("marked starts and caption transcripts", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores marks per video and clears them", () => {
    writeSpeechStart("v", "1AC#1", 12.8);
    writeSpeechStart("v", "1NC#1", 400);
    writeSpeechStart("w", "1AC#1", 5);
    expect(readSpeechStarts("v")).toEqual({ "1AC#1": 12, "1NC#1": 400 });
    writeSpeechStart("v", "1NC#1", null);
    expect(readSpeechStarts("v")).toEqual({ "1AC#1": 12 });
  });

  it("times speeches by the marks and cuts the captions between them", () => {
    const speeches = withSpeechStarts(standardRoundSpeeches(3), { "1AC#1": 10, "CX#1": 100 });
    const captions = [
      { text: "Hello judge.", start: 2 },
      { text: "I affirm.", start: 12 },
      { text: "Plan text.", start: 50 },
      { text: "First question?", start: 101 },
    ];
    const cut = withCaptionTranscripts(speeches, captions);
    expect(cut[0].parts.transcript).toBe("I affirm. Plan text.");
    expect(cut[1].parts.transcript).toBe("First question?");
    expect(cut[2].parts.transcript).toBeUndefined();
    expect(captionText(captions)).toBe("Hello judge. I affirm. Plan text. First question?");
  });

  it("leaves a written transcript alone", () => {
    const [speech] = withCaptionTranscripts(
      [{ ...standardRoundSpeeches(3)[0], startSeconds: 0, parts: { transcript: "Typed." } }],
      [{ text: "caption", start: 1 }],
    );
    expect(speech.parts.transcript).toBe("Typed.");
  });
});
