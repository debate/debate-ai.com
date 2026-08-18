import { describe, expect, it } from "vitest";
import {
  buildJudgeDecisionAiUserPrompt,
  parseJudgeDecisionAiResponse,
  type JudgeDecisionAiInput,
} from "../src/round/judge-decision-ai";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

const INPUT: JudgeDecisionAiInput = {
  paradigm: judgeParadigms.flow,
  flowSummaryText: "1AC: Solvency deficit — the plan can't overcome bureaucratic inertia.",
  sideNames: { primary: "Affirmative", secondary: "Negative" },
};

describe("buildJudgeDecisionAiUserPrompt", () => {
  it("includes the paradigm's prompt section, side labels, and flow summary", () => {
    const prompt = buildJudgeDecisionAiUserPrompt(INPUT);

    expect(prompt).toContain("Judge Paradigm: Flow / Tech Judge");
    expect(prompt).toContain('"primary" = Affirmative');
    expect(prompt).toContain('"secondary" = Negative');
    expect(prompt).toContain("Solvency deficit");
    expect(prompt).toContain('"winner"');
  });
});

describe("parseJudgeDecisionAiResponse", () => {
  it("parses a well-formed JSON reply", () => {
    const raw = JSON.stringify({
      winner: "primary",
      keyVotingIssues: ["Dropped disadvantage", "Solvency deficit conceded"],
      rationale: "The negative dropped the aff's key solvency argument.",
    });

    expect(parseJudgeDecisionAiResponse(raw)).toEqual({
      winner: "primary",
      keyVotingIssues: ["Dropped disadvantage", "Solvency deficit conceded"],
      rationale: "The negative dropped the aff's key solvency argument.",
    });
  });

  it("extracts JSON wrapped in a markdown code fence", () => {
    const raw = "```json\n" + JSON.stringify({
      winner: "secondary",
      keyVotingIssues: ["Case turn"],
      rationale: "The neg's case turn was never answered.",
    }) + "\n```";

    const result = parseJudgeDecisionAiResponse(raw);
    expect(result?.winner).toBe("secondary");
  });

  it("extracts JSON wrapped in prose", () => {
    const raw =
      "Here is my decision:\n" +
      JSON.stringify({
        winner: "primary",
        keyVotingIssues: ["Framework"],
        rationale: "Aff won framework outright.",
      }) +
      "\nHope that helps!";

    const result = parseJudgeDecisionAiResponse(raw);
    expect(result?.winner).toBe("primary");
    expect(result?.keyVotingIssues).toEqual(["Framework"]);
  });

  it("returns null for an empty string", () => {
    expect(parseJudgeDecisionAiResponse("")).toBeNull();
    expect(parseJudgeDecisionAiResponse("   ")).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseJudgeDecisionAiResponse("not json at all")).toBeNull();
  });

  it("returns null when winner isn't 'primary' or 'secondary'", () => {
    const raw = JSON.stringify({
      winner: "aff",
      keyVotingIssues: ["issue"],
      rationale: "rationale",
    });
    expect(parseJudgeDecisionAiResponse(raw)).toBeNull();
  });

  it("returns null when keyVotingIssues is empty", () => {
    const raw = JSON.stringify({ winner: "primary", keyVotingIssues: [], rationale: "rationale" });
    expect(parseJudgeDecisionAiResponse(raw)).toBeNull();
  });

  it("returns null when rationale is missing or blank", () => {
    const raw = JSON.stringify({ winner: "primary", keyVotingIssues: ["issue"], rationale: "   " });
    expect(parseJudgeDecisionAiResponse(raw)).toBeNull();
  });

  it("filters out non-string entries in keyVotingIssues but keeps valid ones", () => {
    const raw = JSON.stringify({
      winner: "secondary",
      keyVotingIssues: ["real issue", 42, "", "  "],
      rationale: "rationale",
    });
    expect(parseJudgeDecisionAiResponse(raw)?.keyVotingIssues).toEqual(["real issue"]);
  });
});
