import { describe, expect, it } from "vitest";
import {
  aiVersusTranscriptComparisonFilename,
  aiVersusTranscriptFilename,
  buildAiVersusTranscriptComparison,
  buildAiVersusTranscriptComparisonText,
  buildAiVersusTranscriptText,
} from "../src/round/ai-versus-transcript";
import type { AiVersusRoundRecord } from "debate-round/src/state/aiVersusRounds";

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

const ROUND_B: AiVersusRoundRecord = {
  roundId: "round-2",
  styleKey: "policy",
  userSide: "primary",
  submittedSpeeches: [
    { name: "1AC", speaker: "user", text: "Contention one is different." },
    { name: "1NC", speaker: "ai", text: "The negative contends..." },
    { name: "2AC", speaker: "user", text: "Extending contention one." },
  ],
};

describe("buildAiVersusTranscriptComparison", () => {
  it("zips both rounds' speeches positionally, one row per index", () => {
    const comparison = buildAiVersusTranscriptComparison(ROUND, ROUND_B);
    expect(comparison.rows).toHaveLength(3);
    expect(comparison.rows[0]!.index).toBe(0);
    expect(comparison.rows[0]!.a).toEqual(ROUND.submittedSpeeches[0]);
    expect(comparison.rows[0]!.b).toEqual(ROUND_B.submittedSpeeches[0]);
  });

  it("word-diffs a row where both rounds have a speech at that index", () => {
    const comparison = buildAiVersusTranscriptComparison(ROUND, ROUND_B);
    const diff = comparison.rows[0]!.diff;
    expect(diff).not.toBeNull();
    expect(diff!.left.some((segment) => segment.type === "removed")).toBe(true);
    expect(diff!.right.some((segment) => segment.type === "added")).toBe(true);
  });

  it("leaves a row with identical text on both sides fully equal", () => {
    const comparison = buildAiVersusTranscriptComparison(ROUND, ROUND_B);
    const diff = comparison.rows[1]!.diff;
    expect(diff!.left.every((segment) => segment.type === "equal")).toBe(true);
    expect(diff!.right.every((segment) => segment.type === "equal")).toBe(true);
  });

  it("includes an undiffed row for a speech only one round delivered", () => {
    const comparison = buildAiVersusTranscriptComparison(ROUND, ROUND_B);
    const row = comparison.rows[2]!;
    expect(row.a).toBeNull();
    expect(row.b).toEqual(ROUND_B.submittedSpeeches[2]);
    expect(row.diff).toBeNull();
  });

  it("produces no rows for two rounds with no delivered speeches", () => {
    const empty: AiVersusRoundRecord = { ...ROUND, submittedSpeeches: [] };
    const comparison = buildAiVersusTranscriptComparison(empty, empty);
    expect(comparison.rows).toHaveLength(0);
  });
});

describe("buildAiVersusTranscriptComparisonText", () => {
  it("headers with both round ids and a section per aligned speech position", () => {
    const text = buildAiVersusTranscriptComparisonText(buildAiVersusTranscriptComparison(ROUND, ROUND_B));
    expect(text).toContain("AI-Versus Transcript Comparison — Round round-1 vs. Round round-2");
    expect(text).toContain("### Speech 1");
    expect(text).toContain("### Speech 3");
  });

  it("renders both rounds' full text for every position, undiffed", () => {
    const text = buildAiVersusTranscriptComparisonText(buildAiVersusTranscriptComparison(ROUND, ROUND_B));
    expect(text).toContain("Contention one is...");
    expect(text).toContain("Contention one is different.");
  });

  it("marks a position only one round delivered as not delivered in the other", () => {
    const text = buildAiVersusTranscriptComparisonText(buildAiVersusTranscriptComparison(ROUND, ROUND_B));
    expect(text).toContain("(not delivered in this round)");
  });
});

describe("aiVersusTranscriptComparisonFilename", () => {
  it("builds a lowercase, hyphenated filename from both round ids", () => {
    expect(aiVersusTranscriptComparisonFilename(ROUND, ROUND_B)).toBe(
      "ai-versus-comparison-round-1-vs-round-2.txt",
    );
  });

  it("collapses non-alphanumeric round ids down to the surviving 'vs' separator", () => {
    const blankA: AiVersusRoundRecord = { ...ROUND, roundId: "###" };
    const blankB: AiVersusRoundRecord = { ...ROUND_B, roundId: "###" };
    expect(aiVersusTranscriptComparisonFilename(blankA, blankB)).toBe("ai-versus-comparison-vs.txt");
  });
});
