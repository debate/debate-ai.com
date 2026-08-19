import { describe, expect, it } from "vitest";
import {
  buildFlowRowSummariesFromExtraction,
  buildTranscriptExtractionAiUserPrompt,
  parseTranscriptExtractionAiResponse,
  renderExtractedArgumentContent,
  type ExtractedArgument,
  type TranscriptExtractionAiInput,
} from "../src/round/transcript-extraction-ai";

const INPUT: TranscriptExtractionAiInput = {
  speech: "1AC",
  transcriptText: "The plan solves warming. Unchecked emissions cause extinction, so we must act now.",
};

describe("buildTranscriptExtractionAiUserPrompt", () => {
  it("includes the speech label, transcript text, and JSON reply shape", () => {
    const prompt = buildTranscriptExtractionAiUserPrompt(INPUT);

    expect(prompt).toContain("Speech: 1AC");
    expect(prompt).toContain("The plan solves warming.");
    expect(prompt).toContain('"arguments"');
    expect(prompt).toContain('"claim"');
  });
});

describe("parseTranscriptExtractionAiResponse", () => {
  it("parses a well-formed JSON reply with full fields", () => {
    const raw = JSON.stringify({
      arguments: [
        {
          claim: "The plan solves warming.",
          warrant: "Reduced emissions curb warming.",
          impact: "Prevents extinction.",
          evidence: "IPCC 2023 report.",
        },
      ],
    });

    expect(parseTranscriptExtractionAiResponse(raw)).toEqual([
      {
        claim: "The plan solves warming.",
        warrant: "Reduced emissions curb warming.",
        impact: "Prevents extinction.",
        evidence: "IPCC 2023 report.",
      },
    ]);
  });

  it("parses an argument with only a claim, omitting absent optional fields", () => {
    const raw = JSON.stringify({ arguments: [{ claim: "Bare claim only." }] });
    expect(parseTranscriptExtractionAiResponse(raw)).toEqual([{ claim: "Bare claim only." }]);
  });

  it("extracts JSON wrapped in a markdown code fence", () => {
    const raw =
      "```json\n" + JSON.stringify({ arguments: [{ claim: "Fenced claim." }] }) + "\n```";

    const result = parseTranscriptExtractionAiResponse(raw);
    expect(result).toEqual([{ claim: "Fenced claim." }]);
  });

  it("extracts JSON wrapped in prose", () => {
    const raw =
      "Here are the arguments:\n" +
      JSON.stringify({ arguments: [{ claim: "Prose-wrapped claim." }] }) +
      "\nLet me know if you need more.";

    const result = parseTranscriptExtractionAiResponse(raw);
    expect(result).toEqual([{ claim: "Prose-wrapped claim." }]);
  });

  it("returns null for an empty string", () => {
    expect(parseTranscriptExtractionAiResponse("")).toBeNull();
    expect(parseTranscriptExtractionAiResponse("   ")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseTranscriptExtractionAiResponse("not json at all")).toBeNull();
  });

  it("returns null when arguments is missing or not an array", () => {
    expect(parseTranscriptExtractionAiResponse(JSON.stringify({}))).toBeNull();
    expect(parseTranscriptExtractionAiResponse(JSON.stringify({ arguments: "nope" }))).toBeNull();
  });

  it("returns null when arguments is empty", () => {
    expect(parseTranscriptExtractionAiResponse(JSON.stringify({ arguments: [] }))).toBeNull();
  });

  it("drops entries missing a claim but keeps valid ones", () => {
    const raw = JSON.stringify({
      arguments: [{ warrant: "No claim here." }, { claim: "Valid claim." }],
    });
    expect(parseTranscriptExtractionAiResponse(raw)).toEqual([{ claim: "Valid claim." }]);
  });

  it("returns null when every entry fails validation", () => {
    const raw = JSON.stringify({ arguments: [{ claim: "" }, { claim: "   " }] });
    expect(parseTranscriptExtractionAiResponse(raw)).toBeNull();
  });

  it("treats blank optional fields as absent", () => {
    const raw = JSON.stringify({ arguments: [{ claim: "Claim.", warrant: "  ", impact: 42 }] });
    expect(parseTranscriptExtractionAiResponse(raw)).toEqual([{ claim: "Claim." }]);
  });
});

describe("renderExtractedArgumentContent", () => {
  it("renders a claim-only argument as just the claim", () => {
    expect(renderExtractedArgumentContent({ claim: "Bare claim." })).toBe("Bare claim.");
  });

  it("joins present fields with an em dash separator, in claim/warrant/impact/evidence order", () => {
    const argument: ExtractedArgument = {
      claim: "The plan solves warming.",
      warrant: "Reduced emissions curb warming.",
      impact: "Prevents extinction.",
      evidence: "IPCC 2023 report.",
    };
    expect(renderExtractedArgumentContent(argument)).toBe(
      "The plan solves warming. — Warrant: Reduced emissions curb warming. — " +
        "Impact: Prevents extinction. — Evidence: IPCC 2023 report.",
    );
  });
});

describe("buildFlowRowSummariesFromExtraction", () => {
  const ARGS: ExtractedArgument[] = [
    { claim: "First argument.", warrant: "Because reasons." },
    { claim: "Second argument." },
  ];

  it("builds one unanswered FlowRowSummary row per extracted argument", () => {
    const rows = buildFlowRowSummariesFromExtraction("1AC", ARGS);

    expect(rows).toEqual([
      {
        rowIndex: 0,
        isHeading: false,
        argument: "First argument. — Warrant: Because reasons.",
        originSpeech: "1AC",
        entries: [{ speech: "1AC", content: "First argument. — Warrant: Because reasons." }],
        lastSpeech: "1AC",
        isUnanswered: true,
      },
      {
        rowIndex: 1,
        isHeading: false,
        argument: "Second argument.",
        originSpeech: "1AC",
        entries: [{ speech: "1AC", content: "Second argument." }],
        lastSpeech: "1AC",
        isUnanswered: true,
      },
    ]);
  });

  it("offsets rowIndex by startIndex so rows can append to an existing summary", () => {
    const rows = buildFlowRowSummariesFromExtraction("2AC", ARGS, 5);
    expect(rows.map((row) => row.rowIndex)).toEqual([5, 6]);
  });

  it("returns an empty array for an empty argument list", () => {
    expect(buildFlowRowSummariesFromExtraction("1AC", [])).toEqual([]);
  });
});
