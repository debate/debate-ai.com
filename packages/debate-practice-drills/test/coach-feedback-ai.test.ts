import { describe, expect, it } from "vitest";
import {
  COACH_FEEDBACK_AI_SYSTEM_PROMPT,
  buildCoachFeedbackAiUserPrompt,
  parseCoachFeedbackAiResponse,
  type CoachFeedbackAiInput,
} from "../src/round/coach-feedback-ai";
import type { CoachingPrompt } from "debate-round/src/flow/coach-mode";

const PROMPTS: CoachingPrompt[] = [
  {
    kind: "refutation",
    rowIndex: 0,
    prompt: 'Answer "Solvency deficit" before it\'s extended against you.',
  },
  { kind: "weighing", rowIndex: null, prompt: "Weighing guidance: shore up your case before weighing." },
];

const INPUT: CoachFeedbackAiInput = { sideKey: "AFF", prompts: PROMPTS };

describe("COACH_FEEDBACK_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to expand on the template prompts", () => {
    expect(COACH_FEEDBACK_AI_SYSTEM_PROMPT).toContain("template coaching prompts");
  });

  it("instructs the model to reply with the feedback text only", () => {
    expect(COACH_FEEDBACK_AI_SYSTEM_PROMPT).toContain("feedback text ONLY");
  });

  it("instructs the model to stay grounded in the given prompts", () => {
    expect(COACH_FEEDBACK_AI_SYSTEM_PROMPT).toContain("don't invent new arguments");
  });
});

describe("buildCoachFeedbackAiUserPrompt", () => {
  it("includes the side being coached", () => {
    expect(buildCoachFeedbackAiUserPrompt(INPUT)).toContain("Side being coached: AFF");
  });

  it("includes the rendered template coaching summary", () => {
    const prompt = buildCoachFeedbackAiUserPrompt(INPUT);
    expect(prompt).toContain("[Refutation] Answer \"Solvency deficit\"");
    expect(prompt).toContain("[Weighing] Weighing guidance");
  });

  it("renders the no-prompts-yet message when the session has no prompts", () => {
    const prompt = buildCoachFeedbackAiUserPrompt({ sideKey: "NEG", prompts: [] });
    expect(prompt).toContain("No coaching prompts available yet");
  });
});

describe("parseCoachFeedbackAiResponse", () => {
  it("returns the trimmed feedback text", () => {
    expect(parseCoachFeedbackAiResponse("  Prioritize the solvency deficit first...  ")).toBe(
      "Prioritize the solvency deficit first...",
    );
  });

  it("strips a wrapping code fence with a language tag", () => {
    const raw = "```markdown\nPrioritize the solvency deficit first...\n```";
    expect(parseCoachFeedbackAiResponse(raw)).toBe("Prioritize the solvency deficit first...");
  });

  it("strips a wrapping code fence with no language tag", () => {
    const raw = "```\nPrioritize the solvency deficit first...\n```";
    expect(parseCoachFeedbackAiResponse(raw)).toBe("Prioritize the solvency deficit first...");
  });

  it("returns null for an empty string", () => {
    expect(parseCoachFeedbackAiResponse("")).toBeNull();
  });

  it("returns null for a blank string", () => {
    expect(parseCoachFeedbackAiResponse("   \n  ")).toBeNull();
  });

  it("returns null when a fence wraps nothing but whitespace", () => {
    expect(parseCoachFeedbackAiResponse("```\n  \n```")).toBeNull();
  });
});
