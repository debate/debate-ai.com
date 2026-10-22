// @vitest-environment jsdom
/**
 * @fileoverview Results a browser ran before (or without) sharing are
 * offered to the shared store once the video's shared copy has loaded, so
 * nothing stays private to the reader who ran it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSharedVideoAi, resetSharedVideoAi } from "../src/state/sharedVideoAi";
import { writeSpeechSegmentation, writeSpeechSummary } from "../src/state/speechAiCache";
import { writeCachedSpeechOutcome } from "../src/state/speechOutcomeCache";
import { aggregatePanel } from "../src/lib/speech-outcomes";

const videoId = "dQw4w9WgXcQ";
const ballot = aggregatePanel([{ judge: "flow", winner: "neg", affWinProbability: 30, rfd: "Neg.", decisive: "DA" }]);
const simulation = {
  actual: { assessment: "Dropped the DA.", ballot },
  alternatives: [{ title: "Turn it", approach: "turn", outline: [], tradeoff: "", ballot }],
  keyClash: [],
};
const segmentation = { format: "policy" as const, speeches: [{ name: "1AC", startSeconds: 30, endSeconds: null }] };

let posts: Array<Record<string, unknown>>;
let postStatus: number;

function stubFetch(shared: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ stored: true }), { status: postStatus });
      }
      return new Response(JSON.stringify(shared), { status: 200 });
    }),
  );
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("backfilling the shared store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSharedVideoAi();
    posts = [];
    postStatus = 200;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("offers every local result the shared store lacks", async () => {
    writeSpeechSegmentation(videoId, segmentation);
    writeSpeechSummary(videoId, "1AC#1", "- Inherency");
    writeSpeechSummary(videoId, "1NC#1", "- Already shared");
    writeCachedSpeechOutcome({ videoId, speechKey: "1AR#1", lens: "flow", simulation, savedAt: 1 });
    stubFetch({ segmentation: null, summaries: { "1NC#1": "- Theirs" }, outcomes: {} });

    await loadSharedVideoAi(videoId);
    await settle();

    expect(posts.map((post) => [post.kind, post.key, post.replace])).toEqual([
      ["segmentation", "", false],
      ["summary", "1AC#1", false],
      ["outcome", "1AR#1::flow", false],
    ]);
  });

  it("keeps a caption-pause placement local, and stops when signed out", async () => {
    writeSpeechSegmentation(videoId, segmentation, "pauses");
    writeSpeechSummary(videoId, "1AC#1", "- One");
    writeSpeechSummary(videoId, "2AC#1", "- Two");
    postStatus = 401;
    stubFetch({ segmentation: null, summaries: {}, outcomes: {} });

    await loadSharedVideoAi(videoId);
    await settle();

    expect(posts).toHaveLength(1);
    expect(posts[0].kind).toBe("summary");
  });
});
