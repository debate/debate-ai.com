import { describe, expect, it } from "vitest";
import {
  JUDGE_DECISION_AI_SYSTEM_PROMPT,
  buildJudgeDecisionUserPrompt,
  parseJudgeDecisionAiResponse,
  type JudgeDecisionAiInput,
} from "../src/round/judge-decision-ai";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

const INPUT: JudgeDecisionAiInput = {
  paradigm: judgeParadigms.flow,
  flowSummaryText: "1AC: Warming is real (unanswered since 1AC)",
  sideLabels: ["Affirmative", "Negative"],
};

describe("JUDGE_DECISION_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to reply with strict JSON only", () => {
    expect(JUDGE_DECISION_AI_SYSTEM_PROMPT).toContain("STRICT JSON ONLY");
  });
});

describe("buildJudgeDecisionUserPrompt", () => {
  it("includes the paradigm's prompt section", () => {
    const prompt = buildJudgeDecisionUserPrompt(INPUT);
    expect(prompt).toContain("Judge Paradigm: Flow / Tech Judge");
    expect(prompt).toContain("Vote strictly off the flow.");
  });

  it("names both side labels", () => {
    const prompt = buildJudgeDecisionUserPrompt(INPUT);
    expect(prompt).toContain('"Affirmative"');
    expect(prompt).toContain('"Negative"');
  });

  it("includes the flow summary text", () => {
    const prompt = buildJudgeDecisionUserPrompt(INPUT);
    expect(prompt).toContain("1AC: Warming is real (unanswered since 1AC)");
  });
});

describe("parseJudgeDecisionAiResponse", () => {
  const sideLabels: [string, string] = ["Affirmative", "Negative"];

  it("parses a well-formed JSON verdict", () => {
    const raw = JSON.stringify({
      winner: "Affirmative",
      reasoning: ["Dropped disad outweighs.", "Case impact uncontested."],
      ballotText: "Aff wins on an unanswered case impact.",
    });
    expect(parseJudgeDecisionAiResponse(raw, sideLabels)).toEqual({
      winner: "Affirmative",
      reasoning: ["Dropped disad outweighs.", "Case impact uncontested."],
      ballotText: "Aff wins on an unanswered case impact.",
    });
  });

  it("matches winner case-insensitively and normalizes to the input's casing", () => {
    const raw = JSON.stringify({
      winner: "negative",
      reasoning: ["Neg wins the link debate."],
      ballotText: "Neg wins.",
    });
    const verdict = parseJudgeDecisionAiResponse(raw, sideLabels);
    expect(verdict?.winner).toBe("Negative");
  });

  it("extracts a JSON object wrapped in a markdown code fence", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        winner: "Affirmative",
        reasoning: ["Reason one."],
        ballotText: "Ballot text.",
      }) +
      "\n```";
    const verdict = parseJudgeDecisionAiResponse(raw, sideLabels);
    expect(verdict?.winner).toBe("Affirmative");
  });

  it("returns null for an empty string", () => {
    expect(parseJudgeDecisionAiResponse("", sideLabels)).toBeNull();
  });

  it("returns null when winner doesn't match either side label", () => {
    const raw = JSON.stringify({
      winner: "Third Party",
      reasoning: ["Reason."],
      ballotText: "Ballot.",
    });
    expect(parseJudgeDecisionAiResponse(raw, sideLabels)).toBeNull();
  });

  it("returns null when reasoning is empty", () => {
    const raw = JSON.stringify({ winner: "Affirmative", reasoning: [], ballotText: "Ballot." });
    expect(parseJudgeDecisionAiResponse(raw, sideLabels)).toBeNull();
  });

  it("returns null when reasoning is missing", () => {
    const raw = JSON.stringify({ winner: "Affirmative", ballotText: "Ballot." });
    expect(parseJudgeDecisionAiResponse(raw, sideLabels)).toBeNull();
  });

  it("returns null when ballotText is empty", () => {
    const raw = JSON.stringify({ winner: "Affirmative", reasoning: ["Reason."], ballotText: "   " });
    expect(parseJudgeDecisionAiResponse(raw, sideLabels)).toBeNull();
  });

  it("returns null for unparseable, non-JSON text", () => {
    expect(parseJudgeDecisionAiResponse("Sorry, I can't decide this round.", sideLabels)).toBeNull();
  });

  it("filters out non-string reasoning entries rather than failing outright", () => {
    const raw = JSON.stringify({
      winner: "Affirmative",
      reasoning: ["Real reason.", 42, ""],
      ballotText: "Ballot.",
    });
    const verdict = parseJudgeDecisionAiResponse(raw, sideLabels);
    expect(verdict?.reasoning).toEqual(["Real reason."]);
  });
});
