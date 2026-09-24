/**
 * @fileoverview Lining a round's documents up speech by speech, and the
 * timeline segments built from the result.
 */

import { describe, expect, it } from "vitest";
import { buildRoundSpeeches, identifySpeech, playingSpeechIndex } from "../src/lib/round-speeches";
import { parseDocumentSections, type VideoDocument } from "../src/lib/video-documents";
import { speechTimelineSegments } from "../src/components/watch/WatchSpeechTimeline";

function doc(kind: VideoDocument["kind"], body: string, author = "ai"): VideoDocument {
  return { videoId: "v", kind, body, author };
}

const transcript = doc(
  "transcript",
  [
    "## 1AC — Michigan (0:00)",
    "Plan text.",
    "## CX (6:00)",
    "Questions.",
    "## 1NC — Emory (9:00)",
    "Five off.",
    "## CX (16:00)",
    "More questions.",
    "## 1AR (19:00)",
    "Answers.",
  ].join("\n\n"),
  "editor",
);

const summary = doc(
  "summary",
  [
    "The aff won on the spec shell.",
    "## 1AC",
    "Frames the new space race.\n\n### Plan\n\nPublic trust settlements.",
    "## CX of the 1AC",
    "Pins the mechanism.",
    "## 1NC",
    "Extra-T, spec, disease DA.",
    "## Cross-Examination of the First Negative Constructive",
    "Status of the advocacies.",
    "## 2NR",
    "Collapses to spec.",
    "## Decision",
    "3-0 aff.",
  ].join("\n\n"),
);

describe("identifySpeech", () => {
  it("reads LD/Policy codes, spelled-out names and PF speeches", () => {
    expect(identifySpeech("1AC — Michigan")).toMatchObject({ base: "1AC", side: "aff", isSpeech: true });
    expect(identifySpeech("2nr")).toMatchObject({ base: "2NR", side: "neg" });
    expect(identifySpeech("First Negative Constructive")).toMatchObject({ base: "1NC", side: "neg" });
    expect(identifySpeech("Con Final Focus")).toMatchObject({ label: "Con Final Focus", side: "neg" });
    expect(identifySpeech("Grand Crossfire")).toMatchObject({ side: "cx" });
  });

  it("names the speech a cross-ex questions", () => {
    expect(identifySpeech("CX of the 1AC")).toMatchObject({ base: "CX", side: "cx", target: "1AC" });
    expect(identifySpeech("Cross-Examination of the First Negative Constructive")).toMatchObject({
      base: "CX",
      target: "1NC",
    });
  });

  it("matches a heading that names no speech on its lead text", () => {
    expect(identifySpeech("Decision — 2-1 Aff")).toMatchObject({ base: "decision", side: "neutral", isSpeech: false });
  });
});

describe("parseDocumentSections depth", () => {
  it("keeps deeper headings in the body when asked to", () => {
    const sections = parseDocumentSections("## 1AC\n\nText\n\n### Plan\n\nMore", { depth: 2 });
    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain("### Plan");
  });
});

describe("buildRoundSpeeches", () => {
  const speeches = buildRoundSpeeches([summary, transcript]);

  it("merges every document's section for a speech into one entry", () => {
    const ac = speeches.find((speech) => speech.key === "1AC#1")!;
    expect(ac.heading).toBe("1AC — Michigan");
    expect(ac.startSeconds).toBe(0);
    expect(ac.parts.transcript).toBe("Plan text.");
    expect(ac.parts.summary).toContain("### Plan");
  });

  it("matches repeated cross-exes by order and labels them by their target", () => {
    const cxs = speeches.filter((speech) => speech.side === "cx");
    expect(cxs.map((speech) => [speech.label, speech.startSeconds, speech.parts.summary])).toEqual([
      ["CX · 1AC", 360, "Pins the mechanism."],
      ["CX · 1NC", 960, "Status of the advocacies."],
    ]);
  });

  it("keeps round order, slotting in what only the summary has", () => {
    expect(speeches.map((speech) => speech.label)).toEqual([
      "Overview",
      "1AC",
      "CX · 1AC",
      "1NC",
      "CX · 1NC",
      "1AR",
      "2NR",
      "Decision",
    ]);
  });

  it("needs a summary or analysis that covers two speeches", () => {
    expect(buildRoundSpeeches([transcript])).toEqual([]);
    expect(buildRoundSpeeches([transcript, doc("summary", "One paragraph about the round.")])).toEqual([]);
    expect(buildRoundSpeeches([doc("analysis", "## 1AC\n\nGood.\n\n## 1NC\n\nBetter.")])).toHaveLength(2);
  });
});

describe("playingSpeechIndex", () => {
  const speeches = buildRoundSpeeches([summary, transcript]);

  it("finds the latest timed speech that has started, skipping untimed ones", () => {
    const at = (seconds: number) => speeches[playingSpeechIndex(speeches, seconds)]?.label;
    expect(at(10)).toBe("1AC");
    expect(at(17 * 60)).toBe("CX · 1NC");
    expect(at(99 * 60)).toBe("1AR");
  });
});

describe("speechTimelineSegments", () => {
  const speeches = buildRoundSpeeches([
    doc("summary", "## 1AC (1:00)\n\nA\n\n## 1NC (7:00)\n\nB\n\n## 2NR\n\nC"),
  ]);

  it("is even until the duration is known", () => {
    const { segments, proportional } = speechTimelineSegments(speeches, 0);
    expect(proportional).toBe(false);
    expect(segments.map((segment) => segment.weight)).toEqual([1, 1, 1]);
  });

  it("sizes timed speeches by how long they ran, after a pre-roll gap", () => {
    const { segments, proportional } = speechTimelineSegments(speeches, 600);
    expect(proportional).toBe(true);
    expect(segments.map((segment) => [segment.speech?.label ?? null, segment.weight])).toEqual([
      [null, 60],
      ["1AC", 360],
      ["1NC", 180],
    ]);
  });
});
