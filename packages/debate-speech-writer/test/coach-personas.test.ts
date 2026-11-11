import { describe, expect, it } from "vitest";
import {
  DEFAULT_COACH_PERSONA_ID,
  applyCoachPersonaToSystemPrompt,
  coachPersonas,
  isCoachPersonaId,
  listCoachPersonas,
  resolveCoachPersona,
} from "../src/coach/coach-personas";

describe("coach personas", () => {
  it("lists standard first, then Socratic, Devil's Advocate and Fact-Checker", () => {
    expect(listCoachPersonas().map((persona) => persona.id)).toEqual([
      "standard",
      "socratic",
      "devils-advocate",
      "fact-checker",
    ]);
    expect(DEFAULT_COACH_PERSONA_ID).toBe("standard");
  });

  it("keeps the critique-the-argument guardrail in every styled persona", () => {
    for (const persona of listCoachPersonas()) {
      if (persona.id === "standard") {
        expect(persona.instructions).toBe("");
        continue;
      }
      expect(persona.instructions).toContain("never the debater as a person");
    }
  });

  it("narrows only known ids", () => {
    expect(isCoachPersonaId("socratic")).toBe(true);
    expect(isCoachPersonaId("custom")).toBe(false);
    expect(isCoachPersonaId(undefined)).toBe(false);
    expect(isCoachPersonaId(3)).toBe(false);
  });

  it("resolves missing or unknown values to the standard persona", () => {
    expect(resolveCoachPersona(undefined).id).toBe("standard");
    expect(resolveCoachPersona("yoda").id).toBe("standard");
    expect(resolveCoachPersona("fact-checker")).toBe(coachPersonas["fact-checker"]);
  });

  it("leaves the base prompt unchanged for standard or unknown ids", () => {
    expect(applyCoachPersonaToSystemPrompt("BASE", "standard")).toBe("BASE");
    expect(applyCoachPersonaToSystemPrompt("BASE", undefined)).toBe("BASE");
    expect(applyCoachPersonaToSystemPrompt("BASE", "not-a-persona")).toBe("BASE");
  });

  it("appends a labelled style section for a styled persona", () => {
    const prompt = applyCoachPersonaToSystemPrompt("BASE", "devils-advocate");
    expect(prompt.startsWith("BASE\n\nCoaching style — Devil's Advocate:\n")).toBe(true);
    expect(prompt).toContain(coachPersonas["devils-advocate"].instructions);
  });
});
