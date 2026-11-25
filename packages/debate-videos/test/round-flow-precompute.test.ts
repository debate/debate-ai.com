import { describe, expect, it, vi } from "vitest";
import { precomputeRoundFlow, ROUND_FLOW_SPEECH_COUNT } from "../src/lib/round-flow-precompute";
import type { PrecomputeDeps, PrecomputeVideo } from "../src/lib/watch-ai-precompute";
import { SPEECH_SEGMENTATION_SYSTEM_PROMPT } from "../src/lib/speech-segmentation";
import { SPEECH_SUMMARY_SYSTEM_PROMPT } from "../src/lib/speech-summary";
import { FLOW_CHART_SYSTEM_PROMPT, type DebateFlowChart } from "../src/lib/debate-flow-chart";
import {
  EMPTY_SHARED_VIDEO_AI,
  collectSharedVideoAi,
  parseSharedVideoAiWrite,
  type SharedVideoAi,
  type SharedVideoAiItem,
} from "../src/lib/shared-video-ai";
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

const chartReply = JSON.stringify({
  summary: "The DA outweighed case.",
  nodes: [
    { id: "a1", side: "aff", label: "Plan solves", text: "The plan colonizes space.", speech: "1AC" },
    { id: "n1", side: "neg", label: "DA — Politics", text: "The plan costs capital.", speech: "1NC" },
  ],
  links: [{ from: "n1", to: "a1", kind: "answers" }],
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
      if (system === FLOW_CHART_SYSTEM_PROMPT) return chartReply;
      throw new Error(`unexpected prompt: ${system.slice(0, 40)}`);
    }),
    share: vi.fn(async (item: SharedVideoAiItem) => {
      shared.push(item);
    }),
    loadCaptions: vi.fn(async () => captions),
    ...overrides,
  };
  return { deps, shared };
}

describe("precomputeRoundFlow", () => {
  it("summarizes the last four team speeches, then saves the flow chart", async () => {
    const { deps, shared } = fakeDeps();
    const result = await precomputeRoundFlow(video, documents, EMPTY_SHARED_VIDEO_AI, deps);
    expect(ROUND_FLOW_SPEECH_COUNT).toBe(4);
    expect(result.status).toBe("done");
    expect(result.summaries).toEqual(["1NC", "1AR", "2NR", "2AR"]);
    expect(result.flowChart).toBe(true);
    expect(result.nodes).toBe(2);
    expect(shared.filter((item) => item.kind === "summary").map((item) => item.key)).toEqual([
      "1NC#1",
      "1AR#1",
      "2NR#1",
      "2AR#1",
    ]);
    const chart = shared.find((item) => item.kind === "flowchart");
    expect(chart?.data).toMatchObject({ summary: "The DA outweighed case." });
  });

  it("keeps outlines a round already has and only writes the missing ones", async () => {
    const { deps, shared } = fakeDeps();
    const partial: SharedVideoAi = { ...EMPTY_SHARED_VIDEO_AI, summaries: { "2NR#1": "- a", "2AR#1": "- b" } };
    const result = await precomputeRoundFlow(video, documents, partial, deps);
    expect(result.summaries).toEqual(["1NC", "1AR"]);
    expect(shared.map((item) => item.kind)).toEqual(["summary", "summary", "flowchart"]);
  });

  it("skips a round that already has a flow chart, without loading captions", async () => {
    const { deps } = fakeDeps();
    const chart = { nodes: [{ id: "a", side: "aff", label: "x", explanation: "" }], links: [] } as DebateFlowChart;
    const result = await precomputeRoundFlow(video, documents, { ...EMPTY_SHARED_VIDEO_AI, flowChart: chart }, deps);
    expect(result.status).toBe("skipped");
    expect(deps.loadCaptions).not.toHaveBeenCalled();
    expect(deps.ask).not.toHaveBeenCalled();
  });

  it("detects speeches first when nothing times the round", async () => {
    const { deps, shared } = fakeDeps();
    const result = await precomputeRoundFlow(video, [], EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.detected).toBe(true);
    expect(shared[0]?.kind).toBe("segmentation");
    expect(result.flowChart).toBe(true);
  });

  it("fails when the chart reply can't be read, keeping the summaries it wrote", async () => {
    const { deps, shared } = fakeDeps();
    const ask = deps.ask;
    deps.ask = vi.fn(async (system: string, prompt: string, maxTokens: number) =>
      system === FLOW_CHART_SYSTEM_PROMPT ? "no json here" : ask(system, prompt, maxTokens),
    );
    const result = await precomputeRoundFlow(video, documents, EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.status).toBe("failed");
    expect(result.reason).toMatch(/Flow chart/);
    expect(shared.filter((item) => item.kind === "summary")).toHaveLength(4);
    expect(shared.some((item) => item.kind === "flowchart")).toBe(false);
  });

  it("skips a round with no captions and no written speeches", async () => {
    const { deps } = fakeDeps({ loadCaptions: vi.fn(async () => []) });
    const result = await precomputeRoundFlow(video, [], EMPTY_SHARED_VIDEO_AI, deps);
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("No captions.");
  });
});

describe("shared flow charts", () => {
  const chart = {
    summary: "Close round.",
    nodes: [
      { id: "a1", side: "aff", label: "Plan", explanation: "Does it." },
      { id: "n1", side: "neg", label: "DA", explanation: "Bad." },
    ],
    links: [{ source: "n1", target: "a1", kind: "answers" }],
  };

  it("accepts a saved chart and reads it back", () => {
    const parsed = parseSharedVideoAiWrite({ videoId: "abcdefghijk", kind: "flowchart", key: "", data: chart });
    expect(parsed.ok).toBe(true);
    const shared = collectSharedVideoAi([{ kind: "flowchart", key: "", data: JSON.stringify(chart) }]);
    expect(shared.flowChart?.nodes.map((node) => node.id)).toEqual(["a1", "n1"]);
    expect(shared.flowChart?.links[0]).toMatchObject({ source: "n1", target: "a1", kind: "answers" });
  });

  it("refuses something that isn't a chart", () => {
    const parsed = parseSharedVideoAiWrite({ videoId: "abcdefghijk", kind: "flowchart", key: "", data: { nodes: [] } });
    expect(parsed.ok).toBe(false);
    expect(collectSharedVideoAi([]).flowChart).toBeNull();
  });
});
