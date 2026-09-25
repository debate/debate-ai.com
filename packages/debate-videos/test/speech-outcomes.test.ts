// @vitest-environment jsdom
/**
 * @fileoverview The watch page's alternative-response simulation: the prompt
 * it sends, the tolerant parse of what comes back, and the swing it charts.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { buildRoundSpeeches } from "../src/lib/round-speeches";
import type { VideoDocument } from "../src/lib/video-documents";
import {
  aggregatePanel,
  bestAlternativeIndex,
  majorityProbability,
  normalizePanel,
  panelKey,
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
    const prompt = buildSpeechOutcomePrompt({ videoTitle: "Space colonization", speeches, index, panel: ["lay"], count: 9 });
    expect(prompt).toContain("Round: Space colonization");
    expect(prompt).toContain('judge id "lay": Lay judge');
    expect(prompt.indexOf("Spec and a disease DA.")).toBeLessThan(prompt.indexOf("## The speech to re-imagine: 1AR"));
    expect(prompt).toContain("Transcript:\nGroup the spec debate.");
    expect(prompt).toContain("3-0 neg.");
    // The count is clamped to what the chart has room for.
    expect(prompt).toContain("exactly 4 alternative responses");
  });

  it("lists every panel judge, the round's facts and the steer", () => {
    const prompt = buildSpeechOutcomePrompt({
      speeches,
      index: 2,
      panel: ["lay", "flow", "theory"],
      steer: "go for the DA",
      round: { format: "LD", aff: "Lincoln AS", neg: "Harvard-Westlake JK", decision: "2-1 Neg" },
    });
    // Canonical order, whatever order they were picked in.
    expect(prompt.indexOf('judge id "flow"')).toBeLessThan(prompt.indexOf('judge id "lay"'));
    expect(prompt).toContain('judge id "theory": Theory-first');
    expect(prompt).toContain("(3 per option)");
    expect(prompt).toContain("Steer the alternatives this way: go for the DA.");
    expect(prompt).toContain("Format: LD");
    expect(prompt).toContain("Recorded decision: 2-1 Neg");
  });

  it("sends the whole round's captions only when the speech has nothing of its own", () => {
    const bare = speeches.map((speech) => ({ ...speech, parts: {} }));
    const withCaptions = buildSpeechOutcomePrompt({ speeches: bare, index: 1, panel: ["flow"], roundTranscript: "so the new space race" });
    expect(withCaptions).toContain("auto-caption transcript of the whole round");
    expect(withCaptions).toContain("so the new space race");
    const written = buildSpeechOutcomePrompt({ speeches, index: 1, panel: ["flow"], roundTranscript: "so the new space race" });
    expect(written).not.toContain("so the new space race");
  });

  it("says so when the speech opens the round", () => {
    expect(buildSpeechOutcomePrompt({ speeches, index: 0, panel: ["flow"] })).toContain("first speech of the round");
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
    const markdown = speechOutcomesToMarkdown(speech, parsed, ["flow"]);
    expect(markdown).toContain("## Alternative responses: 1AR");
    expect(markdown).toContain("### 1. Impact turn the DA (turn, +28 Aff)");
    expect(markdown).toContain("**Ballot:** NEG (70%) — The dropped DA outweighs.");
  });
});

describe("judge panels", () => {
  const ballots = (votes: Array<[string, number]>) =>
    votes.map(([judge, aff]) => ({
      judge,
      winner: aff >= 50 ? "aff" : "neg",
      affWinProbability: aff,
      rfd: `${judge} reasons.`,
      decisive: "the DA",
    }));

  it("normalizes a panel and keys a lone judge by its bare id", () => {
    expect(normalizePanel(["lay", "nope", "flow", "lay"])).toEqual(["flow", "lay"]);
    expect(normalizePanel([])).toEqual(["flow"]);
    expect(normalizePanel(["flow", "lay", "policymaker", "critical", "theory", "traditional"])).toHaveLength(5);
    expect(panelKey(["lay"])).toBe("lay");
    expect(panelKey(["theory", "flow"])).toBe("flow+theory");
  });

  it("computes the chance a majority votes aff", () => {
    expect(majorityProbability([0.5])).toBeCloseTo(0.5);
    expect(majorityProbability([1, 1, 0])).toBeCloseTo(1);
    expect(majorityProbability([0.8, 0.8, 0.8])).toBeCloseTo(0.896);
  });

  it("reads per-judge ballots and derives the panel decision from the votes", () => {
    const parsed = parseSpeechOutcomeResponse(
      JSON.stringify({
        actual: { assessment: "x", ballots: ballots([["flow", 30], ["lay", 70], ["theory", 20]]) },
        alternatives: [{ ...reply.alternatives[0], ballot: undefined, ballots: ballots([["flow", 80], ["Lay judge", 60], ["x", 90]]) }],
      }),
      4,
      ["flow", "lay", "theory"],
    )!;
    expect(parsed.actual.ballot.winner).toBe("neg");
    expect(parsed.actual.ballot.rfd).toBe("NEG on a 2–1; Lay judge dissents.");
    expect(parsed.actual.ballot.judges?.map((judge) => judge.judge)).toEqual(["flow", "lay", "theory"]);
    // A misnamed judge falls back to the panel seat it answered in.
    expect(parsed.alternatives[0].ballot.judges?.map((judge) => judge.judge)).toEqual(["flow", "lay", "theory"]);
    expect(parsed.alternatives[0].ballot.winner).toBe("aff");
    expect(parsed.alternatives[0].ballot.rfd).toBe("AFF on a 3–0.");
  });

  it("treats a panel of one as that judge's own ballot", () => {
    const [only] = ballots([["lay", 64]]) as Parameters<typeof aggregatePanel>[0];
    expect(aggregatePanel([only])).toMatchObject({ winner: "aff", affWinProbability: 64, rfd: "lay reasons." });
  });

  it("breaks an even split on the judges' confidence", () => {
    const decision = aggregatePanel(ballots([["flow", 90], ["lay", 45]]) as Parameters<typeof aggregatePanel>[0]);
    expect(decision.winner).toBe("aff");
    expect(decision.rfd).toContain("splits 1–1");
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
