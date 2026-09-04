import { describe, expect, it } from "vitest";
import { opponentPersonas } from "debate-speech-writer/src/opponent/opponent-personas";
import { AI_VERSUS_SPEECH_SYSTEM_PROMPT } from "../src/round/ai-versus-speech-ai";
import { buildPersonaAiVersusSystemPrompt } from "../src/round/opponent-persona-speech-ai";

describe("buildPersonaAiVersusSystemPrompt", () => {
  it("includes the base AI-versus speech system prompt", () => {
    const prompt = buildPersonaAiVersusSystemPrompt(opponentPersonas["policy-heavy"]);
    expect(prompt).toContain(AI_VERSUS_SPEECH_SYSTEM_PROMPT);
  });

  it("includes the persona's name, description, and instructions", () => {
    const prompt = buildPersonaAiVersusSystemPrompt(opponentPersonas.kritik);
    expect(prompt).toContain("Opponent Persona: Kritik");
    expect(prompt).toContain(opponentPersonas.kritik.description);
    expect(prompt).toContain(opponentPersonas.kritik.instructions);
  });

  it("includes the persona's preferred arguments, in priority order", () => {
    const prompt = buildPersonaAiVersusSystemPrompt(opponentPersonas["fast-flow"]);
    expect(prompt).toContain("1. High argument volume");
  });

  it("notes that the persona's style overrides the general tone", () => {
    const prompt = buildPersonaAiVersusSystemPrompt(opponentPersonas.lay);
    expect(prompt).toContain("override the general tone above");
  });

  it("produces a different prompt for a different persona", () => {
    const policyPrompt = buildPersonaAiVersusSystemPrompt(opponentPersonas["policy-heavy"]);
    const layPrompt = buildPersonaAiVersusSystemPrompt(opponentPersonas.lay);
    expect(policyPrompt).not.toBe(layPrompt);
  });

  it("defaults to the intermediate difficulty when none is given", () => {
    const prompt = buildPersonaAiVersusSystemPrompt(opponentPersonas.kritik);
    expect(prompt).toContain("Difficulty: Intermediate.");
  });

  it("includes a caller-supplied difficulty's instructions", () => {
    const prompt = buildPersonaAiVersusSystemPrompt(opponentPersonas.kritik, "beginner");
    expect(prompt).toContain("Difficulty: Beginner.");
  });

  it("produces a different prompt for a different difficulty, same persona", () => {
    const beginner = buildPersonaAiVersusSystemPrompt(opponentPersonas.kritik, "beginner");
    const elite = buildPersonaAiVersusSystemPrompt(opponentPersonas.kritik, "elite");
    expect(beginner).not.toBe(elite);
  });
});
