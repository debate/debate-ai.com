import { describe, expect, it } from "vitest";
import {
  MAX_ROUND_CONTEXT_CHARS,
  OUTCOME_CANDIDATE_COUNT,
  SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT,
  buildSpeechOutcomeResponsesUserPrompt,
  fitPriorSpeeches,
  parseSpeechOutcomeResponsesResponse,
} from "../src/prompts/speech-outcome-responses";
import { speechToResponsePrompt } from "../src/prompts/speech-to-response";
import { judgeParadigms } from "../src/judge/judge-paradigms";

const candidate = (title: string, successRate: unknown, winner = "aff") => ({
  title,
  strategy: `Go for ${title}`,
  outline: ["Extend Fatton 19 from the 1NC", "Answer the 2NC turn"],
  cardSearches: ["alliance resilience"],
  opponentAnswers: ["Link turn"],
  judgeDecision: { winner, rationale: "Dropped turn." },
  issues: ["Thin on impact calc"],
  successRate,
});

describe("speech outcome responses prompt", () => {
  it("builds on the speech-to-response strategy prompt and pins the JSON contract", () => {
    expect(SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT).toContain(speechToResponsePrompt.trim().slice(0, 80));
    for (const field of ["candidates", "outline", "cardSearches", "opponentAnswers", "judgeDecision", "issues", "successRate"]) {
      expect(SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT).toContain(field);
    }
  });

  it("passes prior speeches, the flow and the judge into the user prompt", () => {
    const prompt = buildSpeechOutcomeResponsesUserPrompt({
      speechName: "2AC",
      side: "aff",
      roundLabel: "Glenbrooks, Octos",
      priorSpeeches: [
        { speech: "1AC", side: "aff", text: "Plan text. ==Warming causes extinction== Smith 24" },
        { speech: "1NC", side: "neg", text: "Alliance DA. Fatton 19" },
        { speech: "CX", side: null, text: "   " },
      ],
      flowText: "- 1AC: Warming | 1NC: No impact",
      judge: { name: "Judge Lee", paradigm: judgeParadigms.lay, tendencySummary: "Judge Lee: 4 rounds" },
      focus: "Go for the turn",
    });
    expect(prompt).toContain("Speech to prepare: 2AC (Aff)");
    expect(prompt).toContain("--- 1AC (Aff) ---");
    expect(prompt).toContain("Smith 24");
    expect(prompt).toContain("--- 1NC (Neg) ---");
    expect(prompt).not.toContain("--- CX");
    expect(prompt).toContain("1NC: No impact");
    expect(prompt).toContain("Judge Lee");
    expect(prompt).toContain(judgeParadigms.lay.name);
    expect(prompt).toContain("Go for the turn");
  });

  it("trims the oldest speeches first to fit the context budget", () => {
    const big = "x".repeat(20_000);
    const fitted = fitPriorSpeeches(
      ["1AC", "1NC", "2AC", "2NC", "1NR", "1AR"].map((speech) => ({ speech, side: null, text: big })),
    );
    const total = fitted.reduce((sum, s) => sum + s.text.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_ROUND_CONTEXT_CHARS + 200);
    expect(fitted[fitted.length - 1].text.length).toBeGreaterThan(fitted[0].text.length);
  });
});

describe("parseSpeechOutcomeResponsesResponse", () => {
  it("parses three candidates and keeps the model's pick", () => {
    const raw = JSON.stringify({
      recommendedIndex: 1,
      candidates: [candidate("DA", 40), candidate("Case", 70), candidate("K", 20, "neg")],
    });
    const result = parseSpeechOutcomeResponsesResponse(raw)!;
    expect(result.candidates).toHaveLength(OUTCOME_CANDIDATE_COUNT);
    expect(result.recommendedIndex).toBe(1);
    expect(result.candidates[2].judgeDecision.winner).toBe("neg");
  });

  it("tolerates fences, clamps rates and drops malformed candidates", () => {
    const raw =
      "Here you go:\n```json\n" +
      JSON.stringify({
        recommendedIndex: 0,
        candidates: [{ title: "broken" }, candidate("Case", "150"), candidate("DA", -5)],
      }) +
      "\n```";
    const result = parseSpeechOutcomeResponsesResponse(raw)!;
    expect(result.candidates.map((c) => c.successRate)).toEqual([100, 0]);
    // A dropped candidate shifts indexes, so the highest rate is recommended.
    expect(result.recommendedIndex).toBe(0);
  });

  it("returns null for unusable replies", () => {
    expect(parseSpeechOutcomeResponsesResponse("")).toBeNull();
    expect(parseSpeechOutcomeResponsesResponse("not json")).toBeNull();
    expect(parseSpeechOutcomeResponsesResponse('{"candidates": []}')).toBeNull();
  });
});
