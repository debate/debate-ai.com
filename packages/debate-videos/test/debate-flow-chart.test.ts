/**
 * @fileoverview The watch page's flow chart: which speeches get summarized
 * first, the prompt, and reading the model's mind-map JSON (including a
 * reply cut off by the token limit).
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FLOW_CHART_INSTRUCTIONS,
  MAX_FLOW_CHART_NODES,
  buildFlowChartPrompt,
  flowChartOutline,
  flowChartOutlines,
  flowChartSpeechColumns,
  parseFlowChartResponse,
  speechColumnOf,
  speechShade,
  speechesToSummarize,
} from "../src/lib/debate-flow-chart";
import type { RoundSpeech, SpeechSide } from "../src/lib/round-speeches";
import { columnPositions, wrapLabel } from "../src/components/videos/watch/flow-chart/DebateFlowChartGraph";
import { requestSpeechSummary, withAiRetries, SpeechAiError } from "../src/lib/speech-ai-client";

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

describe("speech labels and columns", () => {
  it("gives sub-bubbles their parent's speech", () => {
    const chart = parseFlowChartResponse(
      JSON.stringify({
        nodes: [
          { id: "a", side: "aff", label: "Adv", speech: "1AC" },
          { id: "w", side: "aff", label: "W", parent: "a" },
        ],
      }),
    )!;
    expect(chart.nodes[1].speech).toBe("1AC");
  });

  it("orders columns by the round, matches labels loosely and shades each speech", () => {
    const chart = parseFlowChartResponse(
      JSON.stringify({
        nodes: [
          { id: "n", side: "neg", label: "DA", speech: "1nc" },
          { id: "a", side: "aff", label: "Adv", speech: "1AC" },
          { id: "b", side: "aff", label: "Ans", speech: "2 AC" },
          { id: "x", side: "neg", label: "K", speech: "Block" },
          { id: "z", side: "neg", label: "Loose" },
        ],
      }),
    )!;
    const columns = flowChartSpeechColumns(chart, round);
    expect(columns.map((c) => c.label)).toEqual(["1AC", "1NC", "2AC", "Block", ""]);
    expect(columns.map((c) => c.side)).toEqual(["aff", "neg", "aff", "neg", "aff"]);
    expect(columns[0].color).not.toBe(columns[2].color);
    expect(speechColumnOf({ speech: "2ac" }, columns)).toBe(2);
    expect(speechColumnOf({}, columns)).toBe(4);
  });

  it("keeps aff shades blue and neg shades red", () => {
    for (let i = 0; i < 4; i++) {
      const aff = Number(speechShade("aff", i, 4).color.match(/hsl\((\d+)/)![1]);
      const neg = Number(speechShade("neg", i, 4).color.match(/hsl\((\d+)/)![1]);
      expect(aff).toBeGreaterThanOrEqual(195);
      expect(aff).toBeLessThanOrEqual(245);
      expect(neg >= 345 || neg <= 15).toBe(true);
    }
  });

  it("stacks each column's arguments with their sub-bubbles under them", () => {
    const positions = columnPositions(
      [
        { id: "a", column: 0, height: 40, isMain: true },
        { id: "n", column: 1, height: 40, isMain: true },
        { id: "a2", column: 0, height: 40, isMain: true },
        { id: "w", column: 0, height: 30, isMain: false, parent: "a" },
      ],
      2,
    );
    expect(positions.get("a")!.x).toBe(positions.get("w")!.x);
    expect(positions.get("n")!.x).toBeGreaterThan(positions.get("a")!.x);
    expect(positions.get("w")!.y).toBeGreaterThan(positions.get("a")!.y);
    expect(positions.get("a2")!.y).toBeGreaterThan(positions.get("w")!.y);
  });

  it("sends a failed speech's captions in place of its outline", () => {
    const outlines = flowChartOutlines(round, { "1AC": "- x" }, new Set(["1NC"]));
    expect(outlines.map((o) => [o.label, !!o.fromTranscript])).toEqual([
      ["1AC", false],
      ["1NC", true],
    ]);
    expect(buildFlowChartPrompt({ speeches: outlines })).toContain("[1NC] (Negative / Con) — raw auto-captions");
  });
});

describe("AI retries", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("retries busy or unreadable replies, not sign-in errors", async () => {
    let calls = 0;
    const flaky = () => {
      calls++;
      return calls < 3 ? Promise.reject(new SpeechAiError("busy", { status: 429, retryable: true })) : Promise.resolve("ok");
    };
    await expect(withAiRetries(flaky, { delays: [0] })).resolves.toBe("ok");
    expect(calls).toBe(3);

    let denied = 0;
    const signIn = () => {
      denied++;
      return Promise.reject(new SpeechAiError("Sign in", { status: 401, retryable: false }));
    };
    await expect(withAiRetries(signIn, { delays: [0] })).rejects.toThrow("Sign in");
    expect(denied).toBe(1);
  });

  it("asks again when the free router is rate-limited, but not past the plan limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Rate limited upstream" }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: "No bullets here." }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: "- **Case**" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const pending = requestSpeechSummary({ heading: "1NR", side: "neg", transcript: "words" });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe("- **Case**");
    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const limited = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Daily limit", limit: 20 }), { status: 429 }));
    vi.stubGlobal("fetch", limited);
    await expect(requestSpeechSummary({ heading: "1NR", side: "neg", transcript: "w" })).rejects.toThrow("Daily limit");
    expect(limited).toHaveBeenCalledTimes(1);
  });
});
