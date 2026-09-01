import { describe, expect, it } from "vitest";
import {
  aiVersusTranscriptFilename,
  buildAiVersusTranscriptText,
} from "../src/round/ai-versus-transcript";
import type { AiVersusRoundRecord } from "../src/state/aiVersusRounds";

const ROUND: AiVersusRoundRecord = {
  roundId: "round-1",
  styleKey: "policy",
  userSide: "primary",
  submittedSpeeches: [
    { name: "1AC", speaker: "user", text: "Contention one is..." },
    { name: "1NC", speaker: "ai", text: "The negative contends..." },
  ],
};

describe("buildAiVersusTranscriptText", () => {
  it("renders a header with round id, format display name, and side display name", () => {
    const text = buildAiVersusTranscriptText(ROUND);
    expect(text).toContain("Online Debate Versus AI — Round round-1");
    expect(text).toContain("Format: Policy");
    expect(text).toContain("Your side: aff");
  });

  it("renders every delivered speech in order, speaker-labeled", () => {
    const text = buildAiVersusTranscriptText(ROUND);
    const speechOrder = [text.indexOf("You — 1AC"), text.indexOf("AI — 1NC")];
    expect(speechOrder[0]).toBeGreaterThan(-1);
    expect(speechOrder[1]).toBeGreaterThan(speechOrder[0]!);
    expect(text).toContain("Contention one is...");
    expect(text).toContain("The negative contends...");
  });

  it("uses the secondary side's display name when the user picked it", () => {
    const text = buildAiVersusTranscriptText({ ...ROUND, userSide: "secondary" });
    expect(text).toContain("Your side: neg");
  });

  it("renders a placeholder line when no speeches have been delivered yet", () => {
    const text = buildAiVersusTranscriptText({ ...ROUND, submittedSpeeches: [] });
    expect(text).toContain("No speeches have been delivered yet.");
  });
});

describe("aiVersusTranscriptFilename", () => {
  it("builds a lowercase, hyphenated filename from a simple round id", () => {
    expect(aiVersusTranscriptFilename("round-1")).toBe("ai-versus-round-1-transcript.txt");
  });

  it("collapses non-alphanumeric characters and mixed case into single hyphens", () => {
    expect(aiVersusTranscriptFilename("My Round #3!")).toBe("ai-versus-my-round-3-transcript.txt");
  });

  it("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(aiVersusTranscriptFilename("  --round--  ")).toBe("ai-versus-round-transcript.txt");
  });

  it("falls back to a generic name when the round id has no alphanumeric characters", () => {
    expect(aiVersusTranscriptFilename("###")).toBe("ai-versus-round-transcript.txt");
  });
});
