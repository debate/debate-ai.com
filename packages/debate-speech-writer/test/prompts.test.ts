import { describe, expect, it } from "vitest";
import { findFlawsPrompt } from "../src/prompts/quote-to-find-flaws";
import { judgeDecisionPrompt } from "../src/prompts/judge-decision-options";
import { speechToFlowPrompt } from "../src/prompts/speech-to-flow";
import { speechToResponsePrompt } from "../src/prompts/speech-to-response";
import { textToHighlightedPrompt } from "../src/prompts/text-to-highlighted";
import { topicToResearchOutlinePrompt } from "../src/prompts/topic-to-research-outline";

const prompts = {
  findFlawsPrompt,
  judgeDecisionPrompt,
  speechToFlowPrompt,
  speechToResponsePrompt,
  textToHighlightedPrompt,
  topicToResearchOutlinePrompt,
};

describe("prompt library", () => {
  it("exports a non-trivial string for every prompt", () => {
    for (const [name, prompt] of Object.entries(prompts)) {
      expect(typeof prompt, name).toBe("string");
      expect(prompt.trim().length, name).toBeGreaterThan(100);
    }
  });

  it("keeps every prompt distinct", () => {
    const values = Object.values(prompts);
    expect(new Set(values).size).toBe(values.length);
  });

  it("leaves no unreplaced template placeholders", () => {
    for (const [name, prompt] of Object.entries(prompts)) {
      expect(prompt, name).not.toMatch(/\$\{/);
    }
  });
});

describe("prompt content", () => {
  it("asks the flow prompt for a single speech column", () => {
    expect(speechToFlowPrompt).toMatch(/flow/i);
    expect(speechToFlowPrompt).toMatch(/speech/i);
  });

  it("asks the judge prompt for both aff and neg decisions", () => {
    expect(judgeDecisionPrompt).toMatch(/\bAFF\b/);
    expect(judgeDecisionPrompt).toMatch(/\bNEG\b/);
  });

  it("asks the flaw prompt for warrants", () => {
    expect(findFlawsPrompt).toMatch(/warrant/i);
  });
});
