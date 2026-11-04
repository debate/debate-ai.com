import { describe, expect, it } from "vitest";

import {
  MAX_DECIDING_SPEECH_CHARS,
  ROUND_ARGUMENTS_SYSTEM_PROMPT,
  affConstructive,
  buildRoundArgumentsPrompt,
  finalNegRebuttal,
  parseRoundArgumentsResponse,
} from "../src/lib/round-argument-picker";
import type { AnalysisSpeech } from "../src/lib/speech-analysis";

const speech = (name: string, transcript = `${name} words`): AnalysisSpeech => ({
  name,
  startSeconds: 0,
  endSeconds: null,
  transcript,
});

const policy = ["1AC", "1AX", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR"].map((name) => speech(name));

describe("affConstructive / finalNegRebuttal", () => {
  it("picks the 1AC and the 2NR in a policy round", () => {
    expect(affConstructive(policy)?.name).toBe("1AC");
    expect(finalNegRebuttal(policy)?.name).toBe("2NR");
  });

  it("picks the NR in LD and the Con Final Focus in PF", () => {
    expect(finalNegRebuttal(["1AC", "1NC", "1AR", "NR", "2AR"].map((n) => speech(n)))?.name).toBe("NR");
    const pf = ["Pro Constructive", "Con Constructive", "Con Summary", "Pro Final Focus", "Con Final Focus"];
    const speeches = pf.map((n) => speech(n));
    expect(affConstructive(speeches)?.name).toBe("Pro Constructive");
    expect(finalNegRebuttal(speeches)?.name).toBe("Con Final Focus");
  });

  it("falls back to the 1NR when the recording stops before the 2NR", () => {
    expect(finalNegRebuttal(policy.slice(0, 7))?.name).toBe("1NR");
    expect(finalNegRebuttal([speech("1AC")])).toBeNull();
  });
});

describe("buildRoundArgumentsPrompt", () => {
  it("sends the outline and the two deciding speeches in full", () => {
    const prompt = buildRoundArgumentsPrompt({
      speeches: policy,
      analysis: { overview: "Cap K vs a space aff.", speeches: [{ name: "2NR", summary: "- **Cap K**", alternative: "" }] },
      videoTitle: "Finals",
      format: "policy",
      aff: "Kentucky",
      neg: "Michigan",
    });
    expect(prompt).toContain("Round: Finals");
    expect(prompt).toContain("Format: Policy");
    expect(prompt).toContain("Cap K vs a space aff.");
    expect(prompt).toContain("Affirmative constructive — 1AC, full captions:\n1AC words");
    expect(prompt).toContain("Final negative rebuttal — 2NR, full captions:\n2NR words");
    expect(prompt).not.toContain("2NC words");
  });

  it("trims a very long speech", () => {
    const prompt = buildRoundArgumentsPrompt({ speeches: [speech("1AC", "x".repeat(MAX_DECIDING_SPEECH_CHARS + 50))] });
    expect(prompt).toContain("… [trimmed]");
    expect(prompt.length).toBeLessThan(MAX_DECIDING_SPEECH_CHARS + 200);
  });

  it("asks for JSON tags for both sides", () => {
    expect(ROUND_ARGUMENTS_SYSTEM_PROMPT).toContain('{"aff":["Tag","Tag"],"neg":["Tag"]}');
  });
});

describe("parseRoundArgumentsResponse", () => {
  it("reads tag lists into comma-separated fields", () => {
    expect(parseRoundArgumentsResponse('```json\n{"aff":["Setcol"," Space Col "],"neg":["Cap K","Framework"]}\n```')).toEqual({
      aff: "Setcol, Space Col",
      neg: "Cap K, Framework",
    });
  });

  it("accepts strings, drops duplicates and placeholders, and caps the tag count", () => {
    expect(parseRoundArgumentsResponse('{"aff":"Heg, heg, Econ, Warming, Pandemics, Space","neg":["unknown"]}')).toEqual({
      aff: "Heg, Econ, Warming, Pandemics",
      neg: null,
    });
  });

  it("returns null when neither side is named", () => {
    expect(parseRoundArgumentsResponse('{"aff":[],"neg":[]}')).toBeNull();
    expect(parseRoundArgumentsResponse("no idea")).toBeNull();
  });
});
