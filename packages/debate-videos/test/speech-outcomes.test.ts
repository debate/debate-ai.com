// @vitest-environment jsdom
/**
 * @fileoverview The watch page's alternative-response simulation: the prompt
 * it sends, the tolerant parse of what comes back, and the swing it charts.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildRoundSpeeches } from "../src/lib/round-speeches";
import type { VideoDocument } from "../src/lib/video-documents";
import {
  bestAlternativeIndex,
  buildSpeechOutcomePrompt,
  clampAlternativeCount,
  parseSpeechOutcomeResponse,
  speakerSwing,
  speechOutcomesToMarkdown,
} from "../src/lib/speech-outcomes";
import {
  MAX_CACHED_RUNS,
  cachedSpeechKeys,
  readCachedSpeechOutcome,
  writeCachedSpeechOutcome,
} from "../src/state/speechOutcomeCache";

const speeches = buildRoundSpeeches([
  {
    videoId: "v",
    kind: "summary",
    author: "ai",
    body: "## 1AC\n\nPublic trust settlements.\n\n## 1NC\n\nSpec and a disease DA.\n\n## 1AR\n\nDrops the DA.\n\n## Decision\n\n3-0 neg.",
  },
  {
    videoId: "v",
    kind: "transcript",
    author: "editor",
    body: "## 1AC (0:00)\n\nThe new space race.\n\n## 1NC (6:00)\n\nFive off.\n\n## 1AR (13:00)\n\nGroup the spec debate.",
  },
] satisfies VideoDocument[]);

const reply = {
  actual: {
    assessment: "Covers spec but concedes the DA.",
    ballot: { winner: "neg", affWinProbability: 30, rfd: "The dropped DA outweighs." },
  },
  alternatives: [
    {
      title: "Impact turn the DA",
      approach: "Turn",
      outline: ["Disease spread is slowed by off-world research", "Weigh on timeframe"],
      tradeoff: "Less time on spec.",
      ballot: { winner: "aff", affWinProbability: 58, rfd: "The turn is conceded in the 2NR." },
    },
    {
      title: "Collapse to case",
      approach: "collapse",
      outline: ["Extend the advantage"],
      tradeoff: "Leaves the DA live.",
      ballot: { winner: "neg", affWinProbability: 25, rfd: "Still loses to the DA." },
    },
  ],
  keyClash: ["Is the DA dropped?", "Spec interpretation"],
};

describe("buildSpeechOutcomePrompt", () => {
  it("sends the round before, the speech itself, and what followed", () => {
    const index = speeches.findIndex((speech) => speech.label === "1AR");
    const prompt = buildSpeechOutcomePrompt({ videoTitle: "Space colonization", speeches, index, lens: "lay", count: 9 });
    expect(prompt).toContain("Round: Space colonization");
    expect(prompt).toContain("Judge: Lay judge");
    expect(prompt.indexOf("Spec and a disease DA.")).toBeLessThan(prompt.indexOf("## The speech to re-imagine: 1AR"));
    expect(prompt).toContain("Transcript:\nGroup the spec debate.");
    expect(prompt).toContain("3-0 neg.");
    // The count is clamped to what the chart has room for.
    expect(prompt).toContain("exactly 4 alternative responses");
  });

  it("says so when the speech opens the round", () => {
    expect(buildSpeechOutcomePrompt({ speeches, index: 0, lens: "flow" })).toContain("first speech of the round");
  });

  it("clamps the alternative count", () => {
    expect(clampAlternativeCount(1)).toBe(2);
    expect(clampAlternativeCount(undefined)).toBe(3);
    expect(clampAlternativeCount(Number.NaN)).toBe(3);
  });
});

describe("parseSpeechOutcomeResponse", () => {
  it("reads strict JSON and normalizes tags", () => {
    const parsed = parseSpeechOutcomeResponse(JSON.stringify(reply));
    expect(parsed?.alternatives).toHaveLength(2);
    expect(parsed?.alternatives[0].approach).toBe("turn");
    expect(parsed?.keyClash).toEqual(["Is the DA dropped?", "Spec interpretation"]);
  });

  it("reads a fenced reply and caps the alternatives", () => {
    const parsed = parseSpeechOutcomeResponse("Here you go:\n```json\n" + JSON.stringify(reply) + "\n```", 1);
    expect(parsed?.alternatives.map((alternative) => alternative.title)).toEqual(["Impact turn the DA"]);
  });

  it("trusts the probability over a contradicting winner, and scales fractions", () => {
    const parsed = parseSpeechOutcomeResponse(
      JSON.stringify({
        ...reply,
        actual: { assessment: "x", ballot: { winner: "aff", affWinProbability: 0.3, rfd: "r" } },
      }),
    );
    expect(parsed?.actual.ballot).toEqual({ winner: "neg", affWinProbability: 30, rfd: "r" });
  });

  it("accepts PF sides and drops malformed alternatives", () => {
    const parsed = parseSpeechOutcomeResponse(
      JSON.stringify({
        ...reply,
        alternatives: [{ title: "No ballot" }, { ...reply.alternatives[0], ballot: { winner: "Pro", rfd: "r" } }],
      }),
    );
    expect(parsed?.alternatives).toHaveLength(1);
    expect(parsed?.alternatives[0].ballot.winner).toBe("aff");
  });

  it("returns null for nothing usable", () => {
    expect(parseSpeechOutcomeResponse("")).toBeNull();
    expect(parseSpeechOutcomeResponse("I can't help with that.")).toBeNull();
    expect(parseSpeechOutcomeResponse(JSON.stringify({ ...reply, alternatives: [] }))).toBeNull();
  });
});

describe("swing", () => {
  const parsed = parseSpeechOutcomeResponse(JSON.stringify(reply))!;

  it("is measured for the side that gave the speech", () => {
    expect(speakerSwing("aff", parsed.actual.ballot, parsed.alternatives[0].ballot)).toBe(28);
    expect(speakerSwing("neg", parsed.actual.ballot, parsed.alternatives[0].ballot)).toBe(-28);
  });

  it("picks the alternative that helps the speaker most, if any does", () => {
    expect(bestAlternativeIndex("aff", parsed)).toBe(0);
    expect(bestAlternativeIndex("neg", parsed)).toBe(1);
    expect(bestAlternativeIndex("neg", { ...parsed, alternatives: [parsed.alternatives[0]] })).toBe(-1);
  });

  it("exports as Markdown with the ballots and the swing", () => {
    const speech = speeches.find((candidate) => candidate.label === "1AR")!;
    const markdown = speechOutcomesToMarkdown(speech, parsed, "flow");
    expect(markdown).toContain("## Alternative responses: 1AR");
    expect(markdown).toContain("### 1. Impact turn the DA (turn, +28 Aff)");
    expect(markdown).toContain("**Ballot:** NEG (70%) — The dropped DA outweighs.");
  });
});

describe("speechOutcomeCache", () => {
  beforeEach(() => localStorage.clear());
  const simulation = parseSpeechOutcomeResponse(JSON.stringify(reply))!;

  it("keeps one run per video, speech and lens", () => {
    writeCachedSpeechOutcome({ videoId: "v", speechKey: "1AR#1", lens: "flow", simulation, savedAt: 1 });
    writeCachedSpeechOutcome({ videoId: "v", speechKey: "1AR#1", lens: "flow", simulation, savedAt: 2 });
    writeCachedSpeechOutcome({ videoId: "v", speechKey: "1NC#1", lens: "lay", simulation, savedAt: 3 });
    expect(readCachedSpeechOutcome("v", "1AR#1", "flow")?.savedAt).toBe(2);
    expect(readCachedSpeechOutcome("v", "1AR#1", "lay")).toBeNull();
    expect(cachedSpeechKeys("v")).toEqual(new Set(["1AR#1", "1NC#1"]));
  });

  it("drops the oldest runs past the cap, and ignores junk", () => {
    for (let i = 0; i <= MAX_CACHED_RUNS; i++) {
      writeCachedSpeechOutcome({ videoId: `v${i}`, speechKey: "1AC#1", lens: "flow", simulation, savedAt: i });
    }
    expect(readCachedSpeechOutcome("v0", "1AC#1", "flow")).toBeNull();
    expect(readCachedSpeechOutcome(`v${MAX_CACHED_RUNS}`, "1AC#1", "flow")).not.toBeNull();
    localStorage.setItem("debate-videos:speech-outcomes", "{not json");
    expect(cachedSpeechKeys("v")).toEqual(new Set());
  });
});
