import { describe, expect, it } from "vitest";
import {
  TEAM_COACH_AI_SYSTEM_PROMPT,
  buildTeamCoachAiSystemPrompt,
  parseTeamCoachAiResponse,
} from "../src/coach/team-coach-ai";
import { coachPersonas } from "../src/coach/coach-personas";

describe("TEAM_COACH_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to stick to the grounding materials", () => {
    expect(TEAM_COACH_AI_SYSTEM_PROMPT).toContain("grounding materials");
  });

  it("instructs the model to reply with the answer only", () => {
    expect(TEAM_COACH_AI_SYSTEM_PROMPT).toContain("answer text ONLY");
  });
});

describe("buildTeamCoachAiSystemPrompt", () => {
  it("returns the base prompt unchanged for Standard, no persona or an unknown id", () => {
    expect(buildTeamCoachAiSystemPrompt()).toBe(TEAM_COACH_AI_SYSTEM_PROMPT);
    expect(buildTeamCoachAiSystemPrompt("standard")).toBe(TEAM_COACH_AI_SYSTEM_PROMPT);
    expect(buildTeamCoachAiSystemPrompt("drill-sergeant")).toBe(TEAM_COACH_AI_SYSTEM_PROMPT);
  });

  it.each(["socratic", "devils-advocate", "fact-checker"] as const)(
    "appends the %s persona after the grounding rules",
    (id) => {
      const prompt = buildTeamCoachAiSystemPrompt(id);
      expect(prompt.startsWith(TEAM_COACH_AI_SYSTEM_PROMPT)).toBe(true);
      expect(prompt).toContain(`Coaching style — ${coachPersonas[id].name}:`);
      expect(prompt).toContain(coachPersonas[id].instructions);
      expect(prompt).toContain("never the debater as a person");
    },
  );
});

describe("parseTeamCoachAiResponse", () => {
  it("returns the trimmed answer text", () => {
    expect(parseTeamCoachAiResponse("  A topicality violation needs...  ")).toBe(
      "A topicality violation needs...",
    );
  });

  it("strips a wrapping code fence with a language tag", () => {
    const raw = "```markdown\nAnswer the violation by...\n```";
    expect(parseTeamCoachAiResponse(raw)).toBe("Answer the violation by...");
  });

  it("strips a wrapping code fence with no language tag", () => {
    const raw = "```\nAnswer the violation by...\n```";
    expect(parseTeamCoachAiResponse(raw)).toBe("Answer the violation by...");
  });

  it("returns null for an empty string", () => {
    expect(parseTeamCoachAiResponse("")).toBeNull();
  });

  it("returns null for a blank string", () => {
    expect(parseTeamCoachAiResponse("   \n  ")).toBeNull();
  });

  it("returns null when a fence wraps nothing but whitespace", () => {
    expect(parseTeamCoachAiResponse("```\n  \n```")).toBeNull();
  });
});
