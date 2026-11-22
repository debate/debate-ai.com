/**
 * @fileoverview The watch page's flow chart: which speeches get summarized
 * first, the prompt, and reading the model's mind-map JSON (including a
 * reply cut off by the token limit).
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_FLOW_CHART_INSTRUCTIONS,
  MAX_FLOW_CHART_NODES,
  buildFlowChartPrompt,
  flowChartOutline,
  flowChartOutlines,
  parseFlowChartResponse,
  speechesToSummarize,
} from "../src/lib/debate-flow-chart";
import type { RoundSpeech, SpeechSide } from "../src/lib/round-speeches";
import { wrapLabel } from "../src/components/videos/watch/flow-chart/DebateFlowChartGraph";

function speech(key: string, side: SpeechSide, transcript = "words", isSpeech = true): RoundSpeech {
  return { key, label: key, heading: key, side, isSpeech, startSeconds: null, parts: transcript ? { transcript } : {} };
}

const round = [
  speech("1AC", "aff"),
  speech("CX", "cx"),
  speech("1NC", "neg"),
  speech("2AC", "aff"),
  speech("2NC", "neg"),
  speech("1NR", "neg"),
  speech("1AR", "aff"),
  speech("2NR", "neg"),
  speech("2AR", "aff", ""),
];

describe("speechesToSummarize", () => {
  it("takes the last four team speeches with a transcript that have no outline", () => {
    const keys = speechesToSummarize(round, { "1AR": "- done" }).map((s) => s.key);
    // 2AR has no transcript, so the last four with words are 2NC, 1NR, 1AR, 2NR.
    expect(keys).toEqual(["2NC", "1NR", "2NR"]);
  });

  it("considers every team speech when asked, never cross-ex", () => {
    const keys = speechesToSummarize(round, {}, { all: true }).map((s) => s.key);
    expect(keys).toEqual(["1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR"]);
  });
});

describe("buildFlowChartPrompt", () => {
  it("falls back to the default instructions and lists outlines in order", () => {
    const outlines = flowChartOutlines(round, { "1NC": "- **DA**", "1AC": "- **Adv**", CX: "- q" });
    const prompt = buildFlowChartPrompt({ instructions: "  ", speeches: outlines, format: "Policy", aff: "A" });
    expect(prompt.startsWith(DEFAULT_FLOW_CHART_INSTRUCTIONS)).toBe(true);
    expect(prompt).toContain("Format: Policy");
    expect(prompt).toContain("Affirmative / Pro: A");
    expect(prompt.indexOf("## 1AC")).toBeLessThan(prompt.indexOf("## CX"));
    expect(prompt.indexOf("## CX")).toBeLessThan(prompt.indexOf("## 1NC"));
  });

  it("uses the viewer's own instructions", () => {
    expect(buildFlowChartPrompt({ instructions: "Only the 2NR.", speeches: [] })).toMatch(/^Only the 2NR\./);
  });
});

describe("parseFlowChartResponse", () => {
  it("reads nodes, sub-bubbles and links", () => {
    const chart = parseFlowChartResponse(
      "```json\n" +
        JSON.stringify({
          summary: "Came down to the DA.",
          nodes: [
            { id: "a1", side: "Pro", label: "Adv 1 — Jobs", text: "Plan creates jobs.", speech: "1AC" },
            { id: "a1w", label: "Card: Smith 24", text: "1M jobs.", parent: "a1" },
            { id: "n1", side: "con", label: "DA — Midterms", text: "Plan costs capital." },
            { id: "x", side: "judge", label: "Dropped" },
          ],
          links: [
            { from: "n1", to: "a1", kind: "rebuts", label: "turns jobs" },
            { from: "a1", to: "n1", kind: "related" },
            { from: "a1w", to: "a1" },
            { from: "n1", to: "nope" },
          ],
        }) +
        "\n```",
    );
    expect(chart).not.toBeNull();
    expect(chart!.summary).toBe("Came down to the DA.");
    expect(chart!.nodes.map((n) => [n.id, n.side, n.parent])).toEqual([
      ["a1", "aff", undefined],
      ["a1w", "aff", "a1"],
      ["n1", "neg", undefined],
    ]);
    expect(chart!.nodes[1].explanation).toBe("1M jobs.");
    // Duplicate pair, parent link and dangling link are all dropped.
    expect(chart!.links).toEqual([{ source: "n1", target: "a1", kind: "answers", label: "turns jobs" }]);
  });

  it("salvages the complete bubbles from a reply cut off mid-way", () => {
    const cut =
      '{"summary":"Close round.","nodes":[{"id":"a1","side":"aff","label":"Adv","text":"x"},' +
      '{"id":"n1","side":"neg","label":"CP","text":"y"},{"id":"n2","side":"neg","lab';
    const chart = parseFlowChartResponse(cut);
    expect(chart?.nodes.map((n) => n.id)).toEqual(["a1", "n1"]);
    expect(chart?.summary).toBe("Close round.");
  });

  it("breaks parent cycles and caps the bubble count, keeping parents", () => {
    const nodes = [
      { id: "p", side: "aff", label: "P", parent: "q" },
      { id: "q", side: "aff", label: "Q", parent: "p" },
      ...Array.from({ length: MAX_FLOW_CHART_NODES + 5 }, (_, i) => ({
        id: `c${i}`,
        side: "neg",
        label: `C${i}`,
        parent: i === 0 ? undefined : "c0",
      })),
    ];
    const chart = parseFlowChartResponse(JSON.stringify({ nodes, links: [] }))!;
    expect(chart.nodes).toHaveLength(MAX_FLOW_CHART_NODES);
    const ids = new Set(chart.nodes.map((n) => n.id));
    for (const node of chart.nodes) if (node.parent) expect(ids.has(node.parent)).toBe(true);
  });

  it("returns null when there is nothing to draw", () => {
    expect(parseFlowChartResponse("Sorry, I can't.")).toBeNull();
    expect(parseFlowChartResponse('{"nodes":[]}')).toBeNull();
  });
});

describe("flowChartOutline", () => {
  it("nests sub-bubbles under their argument", () => {
    const text = flowChartOutline({
      summary: "DA outweighs.",
      nodes: [
        { id: "a", side: "aff", label: "Adv", explanation: "Good." },
        { id: "w", side: "aff", label: "Warrant", explanation: "", parent: "a" },
      ],
      links: [],
    });
    expect(text).toBe("- [AFF] **Adv** — Good.\n  - [AFF] **Warrant**\n\n**Bottom line:** DA outweighs.");
  });
});

describe("wrapLabel", () => {
  it("breaks at spaces and caps the line count", () => {
    expect(wrapLabel("Contention one economic growth", 14)).toEqual(["Contention one", "economic", "growth"]);
    expect(wrapLabel("a b c d e f g h", 1)).toHaveLength(4);
  });
});
