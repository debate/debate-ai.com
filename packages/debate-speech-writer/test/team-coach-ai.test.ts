import { describe, expect, it } from "vitest";
import { TEAM_COACH_AI_SYSTEM_PROMPT, parseTeamCoachAiResponse } from "../src/coach/team-coach-ai";

describe("TEAM_COACH_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to stick to the grounding materials", () => {
    expect(TEAM_COACH_AI_SYSTEM_PROMPT).toContain("grounding materials");
  });

  it("instructs the model to reply with the answer only", () => {
    expect(TEAM_COACH_AI_SYSTEM_PROMPT).toContain("answer text ONLY");
  });
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
