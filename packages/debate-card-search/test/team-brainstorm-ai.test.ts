import { describe, expect, it } from "vitest";
import {
  TEAM_BRAINSTORM_AI_SYSTEM_PROMPT,
  buildTeamBrainstormAiUserPrompt,
  parseTeamBrainstormAiResponse,
} from "../src/lib/team-brainstorm-ai";
import { buildBrainstormPrompt } from "../src/lib/team-brainstorm-assist";

describe("buildTeamBrainstormAiUserPrompt", () => {
  it("includes the argument block, category, and seeding prompt", () => {
    const prompt = buildTeamBrainstormAiUserPrompt(buildBrainstormPrompt("solvency", "frontline"));

    expect(prompt).toContain("Argument block: solvency");
    expect(prompt).toContain("frontline answers");
    expect(prompt).toContain('Brainstorm frontline answers the team could run if the opponent reads "solvency".');
  });

  it("instructs the model to reply with the expected JSON shape", () => {
    const prompt = buildTeamBrainstormAiUserPrompt(buildBrainstormPrompt("warming", "argument"));
    expect(prompt).toContain('"ideas"');
  });
});

describe("TEAM_BRAINSTORM_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to respond with JSON only", () => {
    expect(TEAM_BRAINSTORM_AI_SYSTEM_PROMPT).toContain("STRICT JSON ONLY");
  });
});

describe("parseTeamBrainstormAiResponse", () => {
  const WELL_FORMED = {
    ideas: [
      "Federal funding unlocks state-level matching grants.",
      "Private financing crowds out public accountability.",
    ],
  };

  it("parses a well-formed JSON response", () => {
    expect(parseTeamBrainstormAiResponse(JSON.stringify(WELL_FORMED))).toEqual(WELL_FORMED.ideas);
  });

  it("parses JSON wrapped in a ```json fence", () => {
    const raw = "```json\n" + JSON.stringify(WELL_FORMED) + "\n```";
    expect(parseTeamBrainstormAiResponse(raw)).toEqual(WELL_FORMED.ideas);
  });

  it("parses JSON wrapped in surrounding prose", () => {
    const raw = `Here are some ideas:\n${JSON.stringify(WELL_FORMED)}\nLet me know if you want more.`;
    expect(parseTeamBrainstormAiResponse(raw)).toEqual(WELL_FORMED.ideas);
  });

  it("trims whitespace around each idea", () => {
    const raw = JSON.stringify({ ideas: ["  Idea with padding.  "] });
    expect(parseTeamBrainstormAiResponse(raw)).toEqual(["Idea with padding."]);
  });

  it("drops empty or whitespace-only entries but keeps the rest", () => {
    const raw = JSON.stringify({ ideas: ["A real idea.", "   ", ""] });
    expect(parseTeamBrainstormAiResponse(raw)).toEqual(["A real idea."]);
  });

  it("returns null when every entry is empty", () => {
    expect(parseTeamBrainstormAiResponse(JSON.stringify({ ideas: ["   ", ""] }))).toBeNull();
  });

  it("returns null when ideas isn't an array", () => {
    expect(parseTeamBrainstormAiResponse(JSON.stringify({ ideas: "not an array" }))).toBeNull();
  });

  it("returns null when the ideas field is missing", () => {
    expect(parseTeamBrainstormAiResponse(JSON.stringify({}))).toBeNull();
  });

  it("returns null for text that isn't JSON at all", () => {
    expect(parseTeamBrainstormAiResponse("I can't brainstorm right now.")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseTeamBrainstormAiResponse("")).toBeNull();
  });
});
