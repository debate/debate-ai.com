// @vitest-environment jsdom
/**
 * @fileoverview The watch page's two transcript AI buttons: "Detect speeches"
 * (format and speech timing from the whole caption track) and a speech's
 * "LLM summary" (a bullet outline of its key points and warrants).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  SPEECH_SEGMENTATION_SYSTEM_PROMPT,
  applySpeechSegmentation,
  buildSpeechSegmentationPrompt,
  parseSpeechSegmentationResponse,
  parseTimestamp,
  segmentationSpeeches,
} from "../src/lib/speech-segmentation";
import {
  SPEECH_SUMMARY_SYSTEM_PROMPT,
  buildSpeechSummaryPrompt,
  parseSpeechSummaryResponse,
} from "../src/lib/speech-summary";
import { requestSpeechSegmentation, requestSpeechSummary } from "../src/lib/speech-ai-client";
import { buildRoundSpeeches, withCaptionTranscripts, withSpeechStarts } from "../src/lib/round-speeches";
import { standardRoundSpeeches } from "../src/lib/round-formats";
import {
  readSpeechSegmentation,
  readSpeechSummaries,
  writeSpeechSegmentation,
  writeSpeechSummary,
} from "../src/state/speechAiCache";
import { WatchRoundPanel } from "../src/components/watch/WatchRoundPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const policyReply = JSON.stringify({
  format: "policy",
  speeches: [
    { name: "1AC", start: "0:30", end: "8:40" },
    { name: "1AX", start: "9:00", end: "12:00" },
    { name: "1NC", start: "12:30", end: "20:30" },
    { name: "2AR", start: "1:05:00" },
  ],
});

describe("speech segmentation prompt", () => {
  it("names every policy speech, cross-exes by the speech they question", () => {
    for (const name of ["1AC", "1AX", "1NC", "1NX", "2AC", "2AX", "2NC", "2NX", "1NR", "1AR", "2NR", "2AR"]) {
      expect(SPEECH_SEGMENTATION_SYSTEM_PROMPT).toContain(name);
    }
    expect(SPEECH_SEGMENTATION_SYSTEM_PROMPT).toContain("1AX is the cross-ex of the 1AC");
  });

  it("sends the whole caption track as timestamped lines", () => {
    const prompt = buildSpeechSegmentationPrompt({
      captions: [
        { text: "Time starts now.", start: 30 },
        { text: " ", start: 31 },
        { text: "Plan text.", start: 3725 },
      ],
      videoTitle: "NDT Finals",
      formatHint: "Policy",
    });
    expect(prompt).toContain("Video title: NDT Finals");
    expect(prompt).toContain("Listed format (may be wrong): Policy");
    expect(prompt).toContain("[0:30] Time starts now.");
    expect(prompt).toContain("[1:02:05] Plan text.");
    expect(prompt).not.toContain("[0:31]");
  });
});

describe("parseTimestamp", () => {
  it("reads m:ss, h:mm:ss and bare seconds", () => {
    expect(parseTimestamp("8:40")).toBe(520);
    expect(parseTimestamp("[1:05:00]")).toBe(3900);
    expect(parseTimestamp("75")).toBe(75);
    expect(parseTimestamp(75.6)).toBe(75);
    expect(parseTimestamp("8:75")).toBeNull();
    expect(parseTimestamp("soon")).toBeNull();
  });
});

describe("parseSpeechSegmentationResponse", () => {
  it("reads a fenced reply and sorts speeches by start", () => {
    const reply = `Here you go:\n\`\`\`json\n${JSON.stringify({
      format: "LD",
      speeches: [
        { name: "1NC", start: "14:00", end: "13:00" },
        { name: "1AC", start: "0:10", end: "6:10" },
        { name: "", start: "1:00" },
        { name: "1AR", start: "never" },
      ],
    })}\n\`\`\``;
    expect(parseSpeechSegmentationResponse(reply)).toEqual({
      format: "ld",
      speeches: [
        { name: "1AC", startSeconds: 10, endSeconds: 370 },
        // An end before its start is dropped, not trusted.
        { name: "1NC", startSeconds: 840, endSeconds: null },
      ],
    });
  });

  it("falls back to other for an unknown format, and null with no speeches", () => {
    expect(parseSpeechSegmentationResponse('{"format":"parli","speeches":[{"name":"PMC","start":"0:00"}]}')?.format).toBe(
      "other",
    );
    expect(parseSpeechSegmentationResponse('{"format":"policy","speeches":[]}')).toBeNull();
    expect(parseSpeechSegmentationResponse("no idea")).toBeNull();
  });
});

describe("segmentationSpeeches", () => {
  it("times the detected format's standard speeches under the same keys", () => {
    const speeches = segmentationSpeeches(parseSpeechSegmentationResponse(policyReply)!);
    const standard = standardRoundSpeeches(1);
    expect(speeches.map((speech) => speech.key)).toEqual(standard.map((speech) => speech.key));
    const byLabel = Object.fromEntries(speeches.map((speech) => [speech.label, speech]));
    expect(byLabel["1AC"]).toMatchObject({ startSeconds: 30, endSeconds: 520 });
    expect(byLabel["1AX"]).toMatchObject({ key: "CX#1", startSeconds: 540, endSeconds: 720 });
    expect(byLabel["2AR"]).toMatchObject({ startSeconds: 3900, endSeconds: null });
    // A speech the recording doesn't have stays untimed.
    expect(byLabel["2NC"].startSeconds).toBeNull();
  });

  it("builds an unknown format's speeches from the names given", () => {
    const speeches = segmentationSpeeches({
      format: "other",
      speeches: [
        { name: "PMC", startSeconds: 0, endSeconds: 420 },
        { name: "LOC", startSeconds: 450, endSeconds: null },
      ],
    });
    expect(speeches.map((speech) => [speech.label, speech.startSeconds])).toEqual([
      ["PMC", 0],
      ["LOC", 450],
    ]);
  });
});

describe("applySpeechSegmentation", () => {
  const segmentation = parseSpeechSegmentationResponse(policyReply)!;

  it("replaces an unwritten round's standard order with the detected speeches", () => {
    const speeches = applySpeechSegmentation(standardRoundSpeeches(3), segmentation);
    expect(speeches).toHaveLength(12);
    expect(speeches[0].startSeconds).toBe(30);
  });

  it("only fills missing times on a written round", () => {
    const written = buildRoundSpeeches([
      { videoId: "v", kind: "summary", body: "## 1AC (0:05)\n\nAdvantage.\n\n## CX\n\nPins the plan.\n\n## 1NC\n\nFive off." },
    ]);
    const speeches = applySpeechSegmentation(written, segmentation);
    expect(speeches.map((speech) => [speech.label, speech.startSeconds, speech.endSeconds ?? null])).toEqual([
      ["1AC", 5, null],
      ["1AX", 540, 720],
      ["1NC", 750, 1230],
    ]);
    expect(speeches[0].parts.summary).toContain("Advantage.");
  });

  it("leaves speeches alone without a segmentation", () => {
    const base = standardRoundSpeeches(1);
    expect(applySpeechSegmentation(base, null)).toBe(base);
  });
});

describe("caption transcripts with a detected end", () => {
  const captions = [
    { text: "First constructive.", start: 30 },
    { text: "End of the 1AC.", start: 520.4 },
    { text: "Taking prep.", start: 530 },
    { text: "First question.", start: 540 },
  ];

  it("stops a speech's text at its end, keeping prep time out", () => {
    const speeches = withCaptionTranscripts(
      applySpeechSegmentation(standardRoundSpeeches(1), parseSpeechSegmentationResponse(policyReply)!),
      captions,
    );
    expect(speeches[0].parts.transcript).toBe("First constructive. End of the 1AC.");
    expect(speeches[1].parts.transcript).toBe("First question.");
  });

  it("drops the detected end once the reader re-marks the start", () => {
    const detected = applySpeechSegmentation(standardRoundSpeeches(1), parseSpeechSegmentationResponse(policyReply)!);
    const remarked = withSpeechStarts(detected, { "1AC#1": 20 });
    expect(remarked[0]).toMatchObject({ startSeconds: 20, endSeconds: null });
    expect(withCaptionTranscripts(remarked, captions)[0].parts.transcript).toContain("Taking prep.");
  });
});

describe("speech summary prompt", () => {
  it("asks for key points and warrants as bullet phrases", () => {
    expect(SPEECH_SUMMARY_SYSTEM_PROMPT).toMatch(/key points/i);
    expect(SPEECH_SUMMARY_SYSTEM_PROMPT).toMatch(/warrants/i);
    const prompt = buildSpeechSummaryPrompt({
      heading: "1NC — First Negative Constructive",
      side: "neg",
      transcript: "  Five off. First off, the politics DA.  ",
      format: "Policy",
    });
    expect(prompt).toContain("Format: Policy");
    expect(prompt).toContain("Speech: 1NC — First Negative Constructive");
    expect(prompt).toContain("Side: Negative / Con");
    expect(prompt).toContain("Five off. First off, the politics DA.");
    expect(prompt).not.toContain("Round:");
  });

  it("tidies a reply into a dash outline", () => {
    expect(parseSpeechSummaryResponse("Sure! Here's the outline:\n\n* **DA — Politics**\n  * PC key → bill\n• **Bottom line**: DA")).toBe(
      "- **DA — Politics**\n  - PC key → bill\n- **Bottom line**: DA",
    );
    expect(parseSpeechSummaryResponse("```markdown\n- **Case**\n```")).toBe("- **Case**");
    expect(parseSpeechSummaryResponse("I can't tell from this.")).toBeNull();
  });
});

describe("speech AI client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts both requests to the shared AI proxy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: policyReply }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: "- **Case**\n  - warrant" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const segmentation = await requestSpeechSegmentation({ captions: [{ text: "Hi.", start: 0 }] });
    expect(segmentation.format).toBe("policy");
    const outline = await requestSpeechSummary({ heading: "1AC", side: "aff", transcript: "Plan." });
    expect(outline).toBe("- **Case**\n  - warrant");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/reason-ai", "/api/reason-ai"]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe(SPEECH_SEGMENTATION_SYSTEM_PROMPT);
    expect(body.messages[0].content).toContain("[0:00] Hi.");
  });

  it("surfaces the proxy's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Sign in to use AI features." }), { status: 401 })),
    );
    await expect(requestSpeechSummary({ heading: "1AC", side: "aff", transcript: "Plan." })).rejects.toThrow(
      "Sign in to use AI features.",
    );
  });
});

describe("speech AI cache", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps one segmentation per video and one outline per speech", () => {
    const segmentation = parseSpeechSegmentationResponse(policyReply)!;
    writeSpeechSegmentation("v1", segmentation);
    expect(readSpeechSegmentation("v1")).toEqual(segmentation);
    expect(readSpeechSegmentation("v2")).toBeNull();
    writeSpeechSegmentation("v1", null);
    expect(readSpeechSegmentation("v1")).toBeNull();

    writeSpeechSummary("v1", "1AC#1", "- old");
    writeSpeechSummary("v1", "1AC#1", "- new");
    writeSpeechSummary("v1", "1NC#1", "- neg");
    expect(readSpeechSummaries("v1")).toEqual({ "1AC#1": "- new", "1NC#1": "- neg" });
  });
});

describe("WatchRoundPanel transcript AI controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const buttonNamed = (name: string) =>
    Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(name)) as
      | HTMLButtonElement
      | undefined;

  it("outlines a speech with its transcript and shows it in the LLM summary view", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ text: "- **Adv — Space race**\n  - warrant" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const speeches = withCaptionTranscripts(
      withSpeechStarts(standardRoundSpeeches(3), { "1AC#1": 0 }),
      [{ text: "The new space race.", start: 1 }],
    );

    act(() => {
      root.render(createElement(WatchRoundPanel, { speeches, videoId: "vid9", round: { format: "Lincoln-Douglas" } }));
    });
    const summaryButton = buttonNamed("LLM summary");
    expect(summaryButton?.disabled).toBe(false);

    await act(async () => {
      summaryButton!.click();
    });

    expect(container.querySelector("strong")?.textContent).toBe("Adv — Space race");
    expect(readSpeechSummaries("vid9")["1AC#1"]).toContain("Space race");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe(SPEECH_SUMMARY_SYSTEM_PROMPT);
    expect(body.messages[0].content).toContain("The new space race.");
    expect(body.messages[0].content).toContain("Format: Lincoln-Douglas");
  });

  it("disables LLM summary for a speech with no transcript yet", () => {
    act(() => {
      root.render(createElement(WatchRoundPanel, { speeches: standardRoundSpeeches(1), videoId: "vid9" }));
    });
    expect(buttonNamed("LLM summary")?.disabled).toBe(true);
  });

  it("shows the Detect speeches control and its result", () => {
    const onDetect = vi.fn();
    const onClear = vi.fn();
    act(() => {
      root.render(
        createElement(WatchRoundPanel, {
          speeches: standardRoundSpeeches(1),
          videoId: "vid9",
          detection: { onDetect, onClear, running: false, result: "Policy · 12 speeches found", available: true },
        }),
      );
    });
    act(() => buttonNamed("Detect again")!.click());
    expect(onDetect).toHaveBeenCalled();
    expect(container.textContent).toContain("Policy · 12 speeches found");
    act(() => buttonNamed("Clear")!.click());
    expect(onClear).toHaveBeenCalled();
  });
});
