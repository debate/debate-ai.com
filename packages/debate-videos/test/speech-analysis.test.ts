import { describe, expect, it } from "vitest";

import {
  DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS,
  buildSpeechAnalysisPrompt,
  parseSpeechAnalysisResponse,
  speechAnalysisDocuments,
  speechAnalysisSystemPrompt,
  speechTranscripts,
} from "../src/lib/speech-analysis";
import type { SpeechSegmentation } from "../src/lib/speech-segmentation";
import { buildRoundSpeeches } from "../src/lib/round-speeches";
import { parseDocumentSections } from "../src/lib/video-documents";

const segmentation: SpeechSegmentation = {
  format: "policy",
  speeches: [
    { name: "1AX", startSeconds: 500, endSeconds: 680 },
    { name: "1AC", startSeconds: 20, endSeconds: 480 },
    { name: "1NC", startSeconds: 700, endSeconds: null },
  ],
};

const captions = [
  { text: "Timer ready?", start: 5 },
  { text: "We affirm the plan.", start: 20 },
  { text: "Solvency is clear.", start: 300 },
  { text: "Prep chatter.", start: 490 },
  { text: "Why does the plan solve?", start: 510 },
  { text: "Two off.", start: 705 },
];

describe("speech analysis", () => {
  it("cuts the captions into each speech, in time order", () => {
    const speeches = speechTranscripts(segmentation, captions);
    expect(speeches.map((speech) => speech.name)).toEqual(["1AC", "1AX", "1NC"]);
    expect(speeches[0].transcript).toBe("We affirm the plan. Solvency is clear.");
    expect(speeches[1].transcript).toBe("Why does the plan solve?");
    expect(speeches[2].transcript).toBe("Two off.");
  });

  it("puts each speech under a timed heading in the prompt", () => {
    const prompt = buildSpeechAnalysisPrompt({
      speeches: speechTranscripts(segmentation, captions),
      videoTitle: "Finals",
      format: "policy",
      aff: "Iowa LR",
    });
    expect(prompt).toContain("Format: Policy");
    expect(prompt).toContain("Affirmative / Pro: Iowa LR");
    expect(prompt).toContain("### 1AC [0:20–8:00]\nWe affirm the plan. Solvency is clear.");
    expect(prompt).toContain("### 1NC [11:40]");
  });

  it("always appends the reply format to the admin's instructions", () => {
    expect(speechAnalysisSystemPrompt("Be brief.")).toMatch(/^Be brief\.\n\nReply with ONLY a JSON object/);
    expect(speechAnalysisSystemPrompt("  ")).toContain(DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS);
  });

  it("reads the reply, tolerating a fence and bullet arrays", () => {
    const reply = "```json\n" + JSON.stringify({
      overview: "Aff won on solvency.",
      speeches: [
        { name: "1AC", summary: "- **Plan** — solves", alternative: ["Read a second advantage"] },
        { name: "", summary: "dropped" },
        { name: "1NC", summary: "", alternative: "" },
      ],
    }) + "\n```";
    expect(parseSpeechAnalysisResponse(reply)).toEqual({
      overview: "Aff won on solvency.",
      speeches: [{ name: "1AC", summary: "- **Plan** — solves", alternative: "- Read a second advantage" }],
    });
    expect(parseSpeechAnalysisResponse("no json")).toBeNull();
  });

  it("builds summary and analysis documents the watch page lines up per speech", () => {
    const documents = speechAnalysisDocuments(segmentation, {
      overview: "Aff won.",
      speeches: [
        { name: "1ac", summary: "- Plan", alternative: "- Add an advantage" },
        { name: "1AX", summary: "- Solvency questions", alternative: "- Press the CP" },
      ],
    });
    expect(documents.speechCount).toBe(3);
    expect(documents.summary).toMatch(/^Aff won\.\n\n## 1AC \(0:20–8:00\)\n\n- Plan/);
    expect(documents.summary).toContain("## CX of the 1AC (8:20–11:20)\n\n- Solvency questions");
    expect(documents.analysis).toContain("## 1NC (11:40)\n\n_No alternative suggested for this speech._");

    const sections = parseDocumentSections(documents.summary, { depth: 2 });
    expect(sections[1]).toMatchObject({ heading: "1AC", startSeconds: 20, endSeconds: 480 });

    const speeches = buildRoundSpeeches([
      { videoId: "v", kind: "summary", body: documents.summary },
      { videoId: "v", kind: "analysis", body: documents.analysis },
    ]);
    expect(speeches.map((speech) => [speech.key, speech.startSeconds, speech.endSeconds ?? null])).toEqual([
      ["1AC#1", 20, 480],
      ["CX#1", 500, 680],
      ["1NC#1", 700, null],
    ]);
    expect(speeches[0].parts).toEqual({ summary: "- Plan", analysis: "- Add an advantage" });
  });
});
