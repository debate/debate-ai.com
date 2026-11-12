import { describe, expect, it, vi } from "vitest";
import {
  buildWatchSpeeches,
  closingSpeeches,
  precomputeNeeded,
  precomputeWatchAi,
  type PrecomputeDeps,
  type PrecomputeVideo,
} from "../src/lib/watch-ai-precompute";
import { SPEECH_SEGMENTATION_SYSTEM_PROMPT } from "../src/lib/speech-segmentation";
import { SPEECH_SUMMARY_SYSTEM_PROMPT } from "../src/lib/speech-summary";
import { EMPTY_SHARED_VIDEO_AI, type SharedVideoAi, type SharedVideoAiItem } from "../src/lib/shared-video-ai";
import type { VideoDocument } from "../src/lib/video-documents";

const video: PrecomputeVideo = {
  videoId: "abcdefghijk",
  title: "Space colonization",
  style: 1,
  affTeam: "Michigan",
  negTeam: "Kansas",
  judgeDecision: "2-1 Neg",
};

/** A written-up policy round with timed headings, so no detection is needed. */
const documents = [
  {
    kind: "summary",
    title: "Summary",
    author: "editor",
    body: [
      "## 1AC (0:00)\n\nThe plan.",
      "## 1NC (1:00)\n\nFive off.",
      "## 1AR (2:00)\n\nGroup spec.",
      "## 2NR (3:00)\n\nThe DA.",
      "## 2AR (4:00)\n\nCase outweighs.",
    ].join("\n\n"),
  },
] as unknown as VideoDocument[];

const captions = [0, 60, 120, 180, 240].map((start, index) => ({
  text: `Speech ${index + 1} says something about the plan.`,
  start: start + 5,
  duration: 20,
}));

const outcomeReply = JSON.stringify({
  actual: { assessment: "Fine.", ballot: { winner: "neg", affWinProbability: 40, rfd: "DA." } },
  alternatives: [
    { title: "Impact turn", approach: "turn", outline: ["Turn it"], tradeoff: "Time.", ballot: { winner: "aff", affWinProbability: 60, rfd: "Turn." } },
    { title: "Collapse", approach: "collapse", outline: ["Case"], tradeoff: "DA live.", ballot: { winner: "neg", affWinProbability: 30, rfd: "DA." } },
  ],
  keyClash: ["The DA"],
});

function fakeDeps(overrides: Partial<PrecomputeDeps> = {}) {
  const shared: SharedVideoAiItem[] = [];
  const deps: PrecomputeDeps = {
    ask: vi.fn(async (system: string) => {
      if (system === SPEECH_SEGMENTATION_SYSTEM_PROMPT) {
        return JSON.stringify({
          format: "policy",
          speeches: [
            { name: "1AC", start: "0:00", end: "0:50" },
            { name: "1NC", start: "1:00", end: "1:50" },
            { name: "1AR", start: "2:00", end: "2:50" },
            { name: "2NR", start: "3:00", end: "3:50" },
            { name: "2AR", start: "4:00", end: "4:50" },
          ],
        });
      }
      if (system === SPEECH_SUMMARY_SYSTEM_PROMPT) return "- Extends the plan\n- Weighs case";
      return outcomeReply;
    }),
    share: vi.fn(async (item: SharedVideoAiItem) => {
      shared.push(item);
    }),
    loadCaptions: vi.fn(async () => captions),
    ...overrides,
  };
  return { deps, shared };
}

describe("closingSpeeches", () => {
  it("takes the last three speeches, leaving out cross-ex", () => {
    const speeches = buildWatchSpeeches({ documents: [], style: 1, segmentation: null, starts: {} });
    const labels = closingSpeeches(speeches).map((speech) => speech.label);
    expect(labels).toEqual(["1AR", "2NR", "2AR"]);
    expect(closingSpeeches(speeches, 0)).toEqual([]);
  });
});

describe("precomputeWatchAi", () => {
  it("writes a summary and an Alternatives run for each of the last three speeches", async () => {
    const { deps, shared } = fakeDeps();
    const result = await precomputeWatchAi(video, documents, EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.status).toBe("done");
    expect(result.speeches).toEqual(["1AR", "2NR", "2AR"]);
    expect(result.detected).toBe(false);
    expect(result.summaries).toEqual(["1AR", "2NR", "2AR"]);
    expect(result.outcomes).toEqual(["1AR", "2NR", "2AR"]);
    expect(shared.filter((item) => item.kind === "summary").map((item) => item.key)).toEqual(["1AR#1", "2NR#1", "2AR#1"]);
    expect(shared.filter((item) => item.kind === "outcome").map((item) => item.key)).toEqual([
      "1AR#1::flow",
      "2NR#1::flow",
      "2AR#1::flow",
    ]);
  });

  it("skips a round that already has everything, without loading captions", async () => {
    const done: SharedVideoAi = {
      ...EMPTY_SHARED_VIDEO_AI,
      summaries: { "1AR#1": "- a", "2NR#1": "- b", "2AR#1": "- c" },
      outcomes: Object.fromEntries(["1AR#1", "2NR#1", "2AR#1"].map((key) => [`${key}::flow`, {} as never])),
    };
    expect(precomputeNeeded(video, documents, done)).toBe(false);
    const { deps } = fakeDeps();
    const result = await precomputeWatchAi(video, documents, done, deps);
    expect(result.status).toBe("skipped");
    expect(deps.loadCaptions).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("only fills what is missing", async () => {
    const partial: SharedVideoAi = { ...EMPTY_SHARED_VIDEO_AI, summaries: { "1AR#1": "- a", "2NR#1": "- b", "2AR#1": "- c" } };
    const { deps, shared } = fakeDeps();
    const result = await precomputeWatchAi(video, documents, partial, deps);
    expect(result.summaries).toEqual([]);
    expect(result.outcomes).toEqual(["1AR", "2NR", "2AR"]);
    expect(shared.every((item) => item.kind === "outcome")).toBe(true);
  });

  it("detects the speeches of an untimed round first and shares the detection", async () => {
    const { deps, shared } = fakeDeps();
    const result = await precomputeWatchAi(video, [], EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.detected).toBe(true);
    expect(shared[0].kind).toBe("segmentation");
    expect(result.speeches).toEqual(["1AR", "2NR", "2AR"]);
    expect(result.outcomes).toHaveLength(3);
  });

  it("keeps going when one speech fails, and reports it", async () => {
    let calls = 0;
    const { deps } = fakeDeps({
      ask: vi.fn(async (system: string) => {
        if (system === SPEECH_SUMMARY_SYSTEM_PROMPT) return "- point";
        calls += 1;
        if (calls === 1) throw new Error("rate limited");
        return outcomeReply;
      }),
    });
    const result = await precomputeWatchAi(video, documents, EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.status).toBe("done");
    expect(result.outcomes).toEqual(["2NR", "2AR"]);
    expect(result.errors).toEqual(["1AR alternatives: rate limited"]);
  });

  it("fails a round when every step fails", async () => {
    const { deps } = fakeDeps({ ask: vi.fn(async () => Promise.reject(new Error("no key"))) });
    const result = await precomputeWatchAi(video, documents, EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("no key");
  });

  it("skips a lecture", async () => {
    const { deps } = fakeDeps();
    const result = await precomputeWatchAi({ ...video, style: null }, [], EMPTY_SHARED_VIDEO_AI, deps);
    expect(result).toMatchObject({ status: "skipped", reason: "Not a round." });
  });
});
