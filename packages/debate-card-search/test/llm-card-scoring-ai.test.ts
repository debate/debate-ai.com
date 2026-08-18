import { describe, expect, it } from "vitest";
import {
  CARD_SCORING_AI_SYSTEM_PROMPT,
  buildCardScoringAiUserPrompt,
  parseCardScoringAiResponse,
} from "../src/lib/llm-card-scoring-ai";

describe("buildCardScoringAiUserPrompt", () => {
  it("includes the card text and argument-block keywords in the prompt", () => {
    const prompt = buildCardScoringAiUserPrompt({
      text: "Rising emissions accelerate catastrophic warming impacts.",
      argBlockKeywords: ["warming", "emissions"],
    });

    expect(prompt).toContain("Rising emissions accelerate catastrophic warming impacts.");
    expect(prompt).toContain("warming, emissions");
  });

  it("notes when there are no keywords rather than leaving a blank line", () => {
    const prompt = buildCardScoringAiUserPrompt({ text: "Some card text.", argBlockKeywords: [] });
    expect(prompt).toContain("(none given)");
  });

  it("instructs the model to reply with the expected JSON shape", () => {
    const prompt = buildCardScoringAiUserPrompt({ text: "x", argBlockKeywords: [] });
    expect(prompt).toContain('"overallScore"');
    expect(prompt).toContain('"notes"');
  });
});

describe("CARD_SCORING_AI_SYSTEM_PROMPT", () => {
  it("instructs the model to respond with JSON only", () => {
    expect(CARD_SCORING_AI_SYSTEM_PROMPT).toContain("STRICT JSON ONLY");
  });
});

const WELL_FORMED = {
  overallScore: 82,
  verdict: "A strong, on-topic card with clear, usable evidence.",
  notes: {
    relevance: "Directly supports the warming argument.",
    clarity: "Sentences are well-balanced and easy to read live.",
    uniqueness: "Says something beyond common knowledge.",
    evidenceQuality: "Cites a credible, recent source.",
    usability: "A good length to read in round.",
  },
};

describe("parseCardScoringAiResponse", () => {
  it("parses a well-formed JSON response", () => {
    const parsed = parseCardScoringAiResponse(JSON.stringify(WELL_FORMED));
    expect(parsed).toEqual(WELL_FORMED);
  });

  it("parses JSON wrapped in a ```json fence", () => {
    const raw = "```json\n" + JSON.stringify(WELL_FORMED) + "\n```";
    expect(parseCardScoringAiResponse(raw)).toEqual(WELL_FORMED);
  });

  it("parses JSON wrapped in surrounding prose", () => {
    const raw = `Sure, here's my assessment:\n${JSON.stringify(WELL_FORMED)}\nLet me know if you need more.`;
    expect(parseCardScoringAiResponse(raw)).toEqual(WELL_FORMED);
  });

  it("returns null for text that isn't JSON at all", () => {
    expect(parseCardScoringAiResponse("I can't assess this card right now.")).toBeNull();
  });

  it("returns null when a required top-level field is missing", () => {
    const { verdict: _verdict, ...withoutVerdict } = WELL_FORMED;
    expect(parseCardScoringAiResponse(JSON.stringify(withoutVerdict))).toBeNull();
  });

  it("returns null when a required notes field is missing", () => {
    const { relevance: _relevance, ...restNotes } = WELL_FORMED.notes;
    const malformed = { ...WELL_FORMED, notes: restNotes };
    expect(parseCardScoringAiResponse(JSON.stringify(malformed))).toBeNull();
  });

  it("returns null when verdict is an empty string", () => {
    const malformed = { ...WELL_FORMED, verdict: "   " };
    expect(parseCardScoringAiResponse(JSON.stringify(malformed))).toBeNull();
  });

  it("clamps an out-of-range overallScore rather than rejecting it", () => {
    const tooHigh = { ...WELL_FORMED, overallScore: 140 };
    expect(parseCardScoringAiResponse(JSON.stringify(tooHigh))?.overallScore).toBe(100);

    const negative = { ...WELL_FORMED, overallScore: -20 };
    expect(parseCardScoringAiResponse(JSON.stringify(negative))?.overallScore).toBe(0);
  });

  it("rounds a fractional overallScore to the nearest integer", () => {
    const fractional = { ...WELL_FORMED, overallScore: 77.6 };
    expect(parseCardScoringAiResponse(JSON.stringify(fractional))?.overallScore).toBe(78);
  });

  it("returns null when overallScore isn't a number", () => {
    const malformed = { ...WELL_FORMED, overallScore: "82" };
    expect(parseCardScoringAiResponse(JSON.stringify(malformed))).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseCardScoringAiResponse("")).toBeNull();
  });
});
