import { describe, expect, it } from "vitest";
import {
  buildCaseChoiceAiUserPrompt,
  parseCaseChoiceAiResponse,
  type CaseChoiceAiInput,
} from "../src/round/case-choice-ai";

const INPUT: CaseChoiceAiInput = {
  caseRankings: [
    { name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 },
    { name: "Topicality case", argumentTags: ["topicality", "framework"], overlapScore: 4 },
  ],
  judgeAdaptationNotes: ["Slow down delivery — this judge has a low tracked speed tolerance."],
  riskLevel: "medium",
  riskFactors: ["Opponent has a strong overall record (70% win rate across 5 round(s))."],
};

describe("buildCaseChoiceAiUserPrompt", () => {
  it("includes every case's tags and overlap score", () => {
    const prompt = buildCaseChoiceAiUserPrompt(INPUT);

    expect(prompt).toContain("Kritik case (tags: kritik; opponent-tag overlap score: 1)");
    expect(prompt).toContain("Topicality case (tags: topicality, framework; opponent-tag overlap score: 4)");
  });

  it("includes the judge adaptation notes and risk level/factors", () => {
    const prompt = buildCaseChoiceAiUserPrompt(INPUT);

    expect(prompt).toContain("Slow down delivery");
    expect(prompt).toContain("Matchup risk level: medium");
    expect(prompt).toContain("Opponent has a strong overall record");
    expect(prompt).toContain('"recommendedCase"');
  });

  it("falls back to explicit text when there are no case options or risk factors", () => {
    const prompt = buildCaseChoiceAiUserPrompt({
      caseRankings: [],
      judgeAdaptationNotes: ["No judge tendency data on file — adapt to a generic flow judge by default."],
      riskLevel: "low",
      riskFactors: [],
    });

    expect(prompt).toContain("No case options supplied.");
    expect(prompt).toContain("No notable risk factors detected.");
  });

  it("labels a case with no argument tags as \"none\"", () => {
    const prompt = buildCaseChoiceAiUserPrompt({
      ...INPUT,
      caseRankings: [{ name: "Untagged case", argumentTags: [], overlapScore: 0 }],
    });

    expect(prompt).toContain("Untagged case (tags: none; opponent-tag overlap score: 0)");
  });
});

describe("parseCaseChoiceAiResponse", () => {
  it("parses a well-formed JSON reply", () => {
    const raw = JSON.stringify({
      recommendedCase: "Kritik case",
      reasoning: "Lowest overlap and fits the judge's low theory receptiveness.",
      caseAssessments: [
        { name: "Kritik case", assessment: "Safest option against this opponent's prep." },
        { name: "Topicality case", assessment: "Higher overlap risk — opponent has answers prepped." },
      ],
    });

    expect(parseCaseChoiceAiResponse(raw)).toEqual({
      recommendedCase: "Kritik case",
      reasoning: "Lowest overlap and fits the judge's low theory receptiveness.",
      caseAssessments: [
        { name: "Kritik case", assessment: "Safest option against this opponent's prep." },
        { name: "Topicality case", assessment: "Higher overlap risk — opponent has answers prepped." },
      ],
    });
  });

  it("extracts JSON wrapped in a markdown code fence", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        recommendedCase: "Topicality case",
        reasoning: "Best fits the judge's tendencies despite the higher overlap.",
        caseAssessments: [{ name: "Topicality case", assessment: "Strong fit." }],
      }) +
      "\n```";

    const result = parseCaseChoiceAiResponse(raw);
    expect(result?.recommendedCase).toBe("Topicality case");
  });

  it("extracts JSON wrapped in prose", () => {
    const raw =
      "Here is my evaluation:\n" +
      JSON.stringify({
        recommendedCase: "Kritik case",
        reasoning: "Safer overall.",
        caseAssessments: [{ name: "Kritik case", assessment: "Safer overall." }],
      }) +
      "\nHope that helps!";

    const result = parseCaseChoiceAiResponse(raw);
    expect(result?.recommendedCase).toBe("Kritik case");
    expect(result?.caseAssessments).toEqual([{ name: "Kritik case", assessment: "Safer overall." }]);
  });

  it("returns null for an empty string", () => {
    expect(parseCaseChoiceAiResponse("")).toBeNull();
    expect(parseCaseChoiceAiResponse("   ")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseCaseChoiceAiResponse("not json at all")).toBeNull();
  });

  it("returns null when recommendedCase is missing or blank", () => {
    const raw = JSON.stringify({
      recommendedCase: "   ",
      reasoning: "reasoning",
      caseAssessments: [{ name: "Case", assessment: "note" }],
    });
    expect(parseCaseChoiceAiResponse(raw)).toBeNull();
  });

  it("returns null when reasoning is missing", () => {
    const raw = JSON.stringify({
      recommendedCase: "Case",
      caseAssessments: [{ name: "Case", assessment: "note" }],
    });
    expect(parseCaseChoiceAiResponse(raw)).toBeNull();
  });

  it("returns null when caseAssessments is empty", () => {
    const raw = JSON.stringify({ recommendedCase: "Case", reasoning: "reasoning", caseAssessments: [] });
    expect(parseCaseChoiceAiResponse(raw)).toBeNull();
  });

  it("filters out malformed entries in caseAssessments but keeps valid ones", () => {
    const raw = JSON.stringify({
      recommendedCase: "Case A",
      reasoning: "reasoning",
      caseAssessments: [
        { name: "Case A", assessment: "Valid note." },
        { name: "", assessment: "Missing name." },
        { name: "Case B" },
        "not an object",
        { name: "Case C", assessment: "  " },
      ],
    });

    expect(parseCaseChoiceAiResponse(raw)?.caseAssessments).toEqual([{ name: "Case A", assessment: "Valid note." }]);
  });
});
