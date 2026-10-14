// @vitest-environment jsdom
/**
 * @fileoverview Covers the pure half of the speech menu's "Select YouTube
 * Start": parsing YouTube links and timestamps, splitting captions into
 * spoken blocks at silences, placing a format's speeches on a recorded round
 * from those blocks, and saving each speech's clip.
 */

import { afterEach, describe, expect, it } from "vitest";

import { debateStyles } from "../src/formats/debate-format-times";
import {
  buildSpokenBlocks,
  formatTimestamp,
  loadSpeechMediaClip,
  parseTimestamp,
  parseYouTubeInput,
  saveSpeechMediaClip,
  scheduleSpeechSegments,
  speechSegmentKeys,
  suggestSpeechSegments,
  type CaptionSnippet,
} from "../src/recorder/youtube-speech-segments";

/** Captions every 4s from `start` for `seconds`, as continuous talking. */
function talk(start: number, seconds: number, word = "words"): CaptionSnippet[] {
  const out: CaptionSnippet[] = [];
  for (let t = start; t < start + seconds; t += 4) {
    out.push({ text: `${word} at ${t}`, start: t, duration: Math.min(4, start + seconds - t) });
  }
  return out;
}

describe("parseTimestamp / formatTimestamp", () => {
  it("reads clock and unit forms", () => {
    expect(parseTimestamp("75")).toBe(75);
    expect(parseTimestamp("1:15")).toBe(75);
    expect(parseTimestamp("1:02:03")).toBe(3723);
    expect(parseTimestamp("1h2m3s")).toBe(3723);
    expect(parseTimestamp("90s")).toBe(90);
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("")).toBeNull();
  });

  it("formats with hours only past an hour", () => {
    expect(formatTimestamp(75)).toBe("1:15");
    expect(formatTimestamp(3723)).toBe("1:02:03");
  });
});

describe("parseYouTubeInput", () => {
  it("takes the id from every link shape", () => {
    for (const link of [
      "dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "youtube.com/watch?v=dQw4w9WgXcQ&list=x",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/live/dQw4w9WgXcQ",
    ]) {
      expect(parseYouTubeInput(link)?.videoId).toBe("dQw4w9WgXcQ");
    }
  });

  it("keeps a t= start", () => {
    expect(parseYouTubeInput("https://youtu.be/dQw4w9WgXcQ?t=95")).toEqual({ videoId: "dQw4w9WgXcQ", start: 95 });
    expect(parseYouTubeInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s")?.start).toBe(65);
  });

  it("rejects search text and other sites", () => {
    expect(parseYouTubeInput("glenbrooks finals")).toBeNull();
    expect(parseYouTubeInput("https://vimeo.com/123456")).toBeNull();
  });
});

describe("buildSpokenBlocks", () => {
  it("splits captions at silences of at least the gap", () => {
    const blocks = buildSpokenBlocks([...talk(0, 20), ...talk(30, 10)], 3);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ start: 0, end: 20 });
    expect(blocks[1]).toMatchObject({ start: 30, end: 40 });
  });
});

describe("speechSegmentKeys", () => {
  it("names cross-examinations after the speech they follow", () => {
    expect(speechSegmentKeys(debateStyles.policy.timerSpeeches)).toEqual([
      "1AC",
      "CX after 1AC",
      "1NC",
      "CX after 1NC",
      "2AC",
      "CX after 2AC",
      "2NC",
      "CX after 2NC",
      "1NR",
      "1AR",
      "2NR",
      "2AR",
    ]);
  });
});

describe("suggestSpeechSegments", () => {
  it("finds every speech of a policy round, with prep time and intro talk between them", () => {
    const speeches = debateStyles.policy.timerSpeeches;
    const captions: CaptionSnippet[] = [];
    // Two minutes of introductions, then a pause.
    captions.push(...talk(0, 120, "intro"));
    let cursor = 150;
    const truth: Array<[number, number]> = [];
    speeches.forEach((speech, i) => {
      // Speeches run a little short or over; prep time (silence) between them varies.
      const length = speech.time * 60 + (i % 3 === 0 ? -25 : i % 3 === 1 ? 10 : 0);
      // Pauses inside a speech (a card change) are shorter than the gaps between speeches.
      captions.push(...talk(cursor, length / 2), ...talk(cursor + length / 2 + 2, length / 2 - 2));
      truth.push([cursor, cursor + length]);
      cursor += length + (i % 2 === 0 ? 45 : 120);
    });

    const segments = suggestSpeechSegments(captions, speeches);
    expect(segments).not.toBeNull();
    expect(segments).toHaveLength(speeches.length);
    segments!.forEach((segment, i) => {
      expect(Math.abs(segment.start - truth[i][0])).toBeLessThanOrEqual(5);
      expect(Math.abs(segment.end - truth[i][1])).toBeLessThanOrEqual(5);
    });
    expect(segments![1].key).toBe("CX after 1AC");
  });

  it("returns null when there are fewer spoken blocks than speeches", () => {
    expect(suggestSpeechSegments(talk(0, 60), debateStyles.policy.timerSpeeches)).toBeNull();
  });
});

describe("scheduleSpeechSegments", () => {
  it("lays speeches end to end from the start with prep between", () => {
    const segments = scheduleSpeechSegments(debateStyles.lincolnDouglas.timerSpeeches, 100, 4);
    expect(segments[0]).toMatchObject({ key: "AC", start: 100, end: 100 + 6 * 60 });
    expect(segments[1].start).toBeGreaterThan(segments[0].end);
    expect(segments).toHaveLength(debateStyles.lincolnDouglas.timerSpeeches.length);
  });
});

describe("speech clip storage", () => {
  afterEach(() => localStorage.clear());

  it("saves, loads and clears a YouTube or audio clip", () => {
    saveSpeechMediaClip("1AC", { source: { kind: "youtube", videoId: "dQw4w9WgXcQ" }, start: 10, end: 490 });
    expect(loadSpeechMediaClip("1AC")).toMatchObject({ source: { videoId: "dQw4w9WgXcQ" }, start: 10, end: 490 });
    saveSpeechMediaClip("1NC", { source: { kind: "audio", url: "https://r2.example/round.mp3" }, start: 500, end: 980 });
    expect(loadSpeechMediaClip("1NC")?.source).toEqual({ kind: "audio", url: "https://r2.example/round.mp3" });
    saveSpeechMediaClip("1AC", null);
    expect(loadSpeechMediaClip("1AC")).toBeNull();
  });
});
