import { describe, expect, it } from "vitest";
import {
  buildCounselPanelAiUserPrompt,
  parseCounselPanelAiResponse,
  type CounselPanelAiInput,
} from "../src/flow/response-outcome-ai";

const INPUT: CounselPanelAiInput = {
  arguments: [
    {
      rowIndex: 0,
      argument: "The plan solves warming through emissions caps.",
      originSpeech: "1AC",
      isUnanswered: true,
      vulnerabilityScore: 80,
    },
    {
      rowIndex: 2,
      argument: "Framework: weigh consequences over discourse.",
      originSpeech: "2AC",
      isUnanswered: false,
      vulnerabilityScore: 45,
    },
  ],
};

describe("buildCounselPanelAiUserPrompt", () => {
  it("includes each argument's row index, origin speech, unanswered status, and score", () => {
    const prompt = buildCounselPanelAiUserPrompt(INPUT);

    expect(prompt).toContain("rowIndex 0");
    expect(prompt).toContain("1AC");
    expect(prompt).toContain("currently unanswered");
    expect(prompt).toContain("heuristic exposure 80/100");
    expect(prompt).toContain("The plan solves warming through emissions caps.");
    expect(prompt).toContain("rowIndex 2");
    expect(prompt).toContain("2AC");
    expect(prompt).toContain('"argumentAssessments"');
    expect(prompt).toContain('"overallClashSummary"');
  });

  it("omits the unanswered note for an already-answered argument", () => {
    const prompt = buildCounselPanelAiUserPrompt({
      arguments: [
        {
          rowIndex: 5,
          argument: "Case turn on solvency.",
          originSpeech: "1NC",
          isUnanswered: false,
          vulnerabilityScore: 30,
        },
      ],
    });

    expect(prompt).not.toContain("currently unanswered");
  });
});

describe("parseCounselPanelAiResponse", () => {
  const VALID = {
    argumentAssessments: [
      {
        rowIndex: 0,
        counselRole: "Policy Counsel",
        likelyResponsePath: "Negative will read a solvency deficit card.",
        clashEstimate: "Clash concentrates on mechanism feasibility.",
      },
      {
        rowIndex: 2,
        counselRole: "Weighing Counsel",
        likelyResponsePath: "Affirmative extends magnitude over probability.",
        clashEstimate: "Impact calculus becomes the deciding issue.",
      },
    ],
    overallClashSummary: "Clash will concentrate on solvency mechanics and impact weighing.",
  };

  it("parses a well-formed JSON reply", () => {
    expect(parseCounselPanelAiResponse(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("extracts JSON wrapped in a markdown code fence", () => {
    const raw = "```json\n" + JSON.stringify(VALID) + "\n```";
    const result = parseCounselPanelAiResponse(raw);
    expect(result?.argumentAssessments).toHaveLength(2);
    expect(result?.overallClashSummary).toBe(VALID.overallClashSummary);
  });

  it("extracts JSON wrapped in prose", () => {
    const raw = "Here is the panel's assessment:\n" + JSON.stringify(VALID) + "\nHope that helps!";
    const result = parseCounselPanelAiResponse(raw);
    expect(result?.argumentAssessments[0]?.counselRole).toBe("Policy Counsel");
  });

  it("returns null for an empty string", () => {
    expect(parseCounselPanelAiResponse("")).toBeNull();
    expect(parseCounselPanelAiResponse("   ")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseCounselPanelAiResponse("not json at all")).toBeNull();
  });

  it("returns null when argumentAssessments is empty", () => {
    const raw = JSON.stringify({ argumentAssessments: [], overallClashSummary: "summary" });
    expect(parseCounselPanelAiResponse(raw)).toBeNull();
  });

  it("returns null when a counselRole isn't one of the three known roles", () => {
    const raw = JSON.stringify({
      argumentAssessments: [
        {
          rowIndex: 0,
          counselRole: "General Counsel",
          likelyResponsePath: "path",
          clashEstimate: "estimate",
        },
      ],
      overallClashSummary: "summary",
    });
    expect(parseCounselPanelAiResponse(raw)).toBeNull();
  });

  it("returns null when an assessment is missing a required field", () => {
    const raw = JSON.stringify({
      argumentAssessments: [{ rowIndex: 0, counselRole: "Policy Counsel", likelyResponsePath: "path" }],
      overallClashSummary: "summary",
    });
    expect(parseCounselPanelAiResponse(raw)).toBeNull();
  });

  it("returns null when overallClashSummary is missing or blank", () => {
    const raw = JSON.stringify({
      argumentAssessments: [
        {
          rowIndex: 0,
          counselRole: "Policy Counsel",
          likelyResponsePath: "path",
          clashEstimate: "estimate",
        },
      ],
      overallClashSummary: "   ",
    });
    expect(parseCounselPanelAiResponse(raw)).toBeNull();
  });
});
