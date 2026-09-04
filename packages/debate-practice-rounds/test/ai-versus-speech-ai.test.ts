import { describe, expect, it } from "vitest";
import {
  AI_VERSUS_SPEECH_SYSTEM_PROMPT,
  buildAiVersusSpeechUserPrompt,
  parseAiVersusSpeechResponse,
} from "../src/round/ai-versus-speech-ai";
import type { AiSpeechRequest } from "debate-round/src/round/ai-versus-speech-order";

const FIRST_SPEECH_REQUEST: AiSpeechRequest = {
  slot: { index: 0, name: "1AC", secondary: false, time: 360, speaker: "ai" },
  priorSpeeches: [],
  isCrossExamination: false,
};

const LATER_SPEECH_REQUEST: AiSpeechRequest = {
  slot: { index: 1, name: "1NC", secondary: true, time: 480, speaker: "ai" },
  priorSpeeches: [{ name: "1AC", speaker: "user", text: "Contention one: warming is real." }],
  isCrossExamination: false,
};

const CX_REQUEST: AiSpeechRequest = {
  slot: {
    index: 2,
    name: "Cross-ex",
    secondary: false,
    time: 180,
    speaker: "ai",
    cxRoles: { questioner: "AI", answerer: "User" },
  },
  priorSpeeches: [{ name: "1AC", speaker: "user", text: "Contention one: warming is real." }],
  isCrossExamination: true,
};

describe("AI_VERSUS_SPEECH_SYSTEM_PROMPT", () => {
  it("instructs the model to reply with speech text only", () => {
    expect(AI_VERSUS_SPEECH_SYSTEM_PROMPT).toContain("speech text ONLY");
  });
});

describe("buildAiVersusSpeechUserPrompt", () => {
  it("names the slot and its time limit", () => {
    const prompt = buildAiVersusSpeechUserPrompt(FIRST_SPEECH_REQUEST);
    expect(prompt).toContain('"1AC"');
    expect(prompt).toContain("360 seconds");
  });

  it("notes there are no prior speeches when speaking first", () => {
    const prompt = buildAiVersusSpeechUserPrompt(FIRST_SPEECH_REQUEST);
    expect(prompt).toContain("none yet");
  });

  it("includes prior speeches, tagging the human side as the opponent", () => {
    const prompt = buildAiVersusSpeechUserPrompt(LATER_SPEECH_REQUEST);
    expect(prompt).toContain("1AC (opponent)");
    expect(prompt).toContain("Contention one: warming is real.");
  });

  it("flags a cross-examination turn", () => {
    const prompt = buildAiVersusSpeechUserPrompt(CX_REQUEST);
    expect(prompt).toContain("a cross-examination turn");
  });

  it("does not flag a non-cross-examination turn", () => {
    const prompt = buildAiVersusSpeechUserPrompt(FIRST_SPEECH_REQUEST);
    expect(prompt).not.toContain("cross-examination turn");
  });
});

describe("parseAiVersusSpeechResponse", () => {
  it("trims surrounding whitespace", () => {
    expect(parseAiVersusSpeechResponse("  Contention one: warming is real.  \n")).toBe(
      "Contention one: warming is real.",
    );
  });

  it("strips a wrapping markdown code fence", () => {
    const raw = "```\nContention one: warming is real.\n```";
    expect(parseAiVersusSpeechResponse(raw)).toBe("Contention one: warming is real.");
  });

  it("strips a wrapping code fence with a language tag", () => {
    const raw = "```text\nContention one: warming is real.\n```";
    expect(parseAiVersusSpeechResponse(raw)).toBe("Contention one: warming is real.");
  });

  it("strips a single layer of wrapping double quotes", () => {
    expect(parseAiVersusSpeechResponse('"Contention one: warming is real."')).toBe(
      "Contention one: warming is real.",
    );
  });

  it("returns null for an empty string", () => {
    expect(parseAiVersusSpeechResponse("")).toBeNull();
  });

  it("returns null for a string that is only whitespace", () => {
    expect(parseAiVersusSpeechResponse("   \n  ")).toBeNull();
  });

  it("returns null when a code fence wraps nothing but whitespace", () => {
    expect(parseAiVersusSpeechResponse("```\n\n```")).toBeNull();
  });

  it("passes through ordinary multi-paragraph speech text unchanged", () => {
    const speech = "Contention one: warming is real.\n\nContention two: it's anthropogenic.";
    expect(parseAiVersusSpeechResponse(speech)).toBe(speech);
  });
});
