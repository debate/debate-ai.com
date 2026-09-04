import { describe, expect, it } from "vitest";
import {
  buildJudgePanelComparison,
  buildJudgePanelComparisonSummary,
} from "../src/judge/judge-panel-comparison";
import { buildJudgeProfile, type JudgeRoundRecord } from "../src/judge/judge-profile";

function record(overrides: Partial<JudgeRoundRecord> = {}): JudgeRoundRecord {
  return {
    judgeId: "smith",
    tournamentName: "Berkeley",
    date: "2026-01-01",
    division: "PF",
    winningSide: "aff",
    affSpeakerPoints: 28,
    negSpeakerPoints: 27,
    theoryArgumentRaised: false,
    theoryArgumentWon: false,
    ...overrides,
  };
}

describe("buildJudgePanelComparison", () => {
  it("throws for fewer than two profiles", () => {
    const solo = buildJudgeProfile("smith", [record()]);
    expect(() => buildJudgePanelComparison([solo])).toThrow(/at least two/);
    expect(() => buildJudgePanelComparison([])).toThrow(/at least two/);
  });

  it("lists judges with a notable side bias and which side they lean", () => {
    const skewedAff = buildJudgeProfile("skewed-aff", [
      ...Array.from({ length: 5 }, () => record({ winningSide: "aff" })),
      record({ winningSide: "neg" }),
    ]);
    const skewedNeg = buildJudgeProfile("skewed-neg", [
      ...Array.from({ length: 5 }, () => record({ winningSide: "neg" })),
      record({ winningSide: "aff" }),
    ]);
    const even = buildJudgeProfile("even", [
      ...Array.from({ length: 3 }, () => record({ winningSide: "aff" })),
      ...Array.from({ length: 3 }, () => record({ winningSide: "neg" })),
    ]);

    const comparison = buildJudgePanelComparison([skewedAff, skewedNeg, even]);
    expect(comparison.sideLeans).toEqual([
      { judgeId: "skewed-aff", leansSide: "aff" },
      { judgeId: "skewed-neg", leansSide: "neg" },
    ]);
  });

  it("returns an empty side-lean list when no judge on the panel has a notable bias", () => {
    const a = buildJudgeProfile("a", [record()]);
    const b = buildJudgeProfile("b", [record()]);
    expect(buildJudgePanelComparison([a, b]).sideLeans).toEqual([]);
  });

  it("recommends the slowest tracked judge's pace so the panel's least speed-tolerant vote isn't lost", () => {
    const fast = buildJudgeProfile("fast", [record({ paceWpm: 350 })]);
    const slow = buildJudgeProfile("slow", [record({ paceWpm: 180 })]);
    const untracked = buildJudgeProfile("untracked", [record()]);

    const comparison = buildJudgePanelComparison([fast, slow, untracked]);
    expect(comparison.recommendedPaceWpm).toBe(180);
    expect(comparison.slowestPacedJudgeId).toBe("slow");
  });

  it("leaves pace recommendation null when no judge on the panel tracked pace", () => {
    const a = buildJudgeProfile("a", [record()]);
    const b = buildJudgeProfile("b", [record()]);
    const comparison = buildJudgePanelComparison([a, b]);
    expect(comparison.recommendedPaceWpm).toBeNull();
    expect(comparison.slowestPacedJudgeId).toBeNull();
  });

  it("reports theory risk as unknown when no judge on the panel tracked theory receptiveness", () => {
    const a = buildJudgeProfile("a", [record()]);
    const b = buildJudgeProfile("b", [record()]);
    const comparison = buildJudgePanelComparison([a, b]);
    expect(comparison.theoryRisk).toBe("unknown");
    expect(comparison.judgesAverseToTheory).toEqual([]);
  });

  it("reports theory risk as safe when every tracked judge is receptive", () => {
    const receptive = buildJudgeProfile("receptive", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: true }),
    ]);
    const untracked = buildJudgeProfile("untracked", [record()]);
    const comparison = buildJudgePanelComparison([receptive, untracked]);
    expect(comparison.theoryRisk).toBe("safe");
    expect(comparison.judgesAverseToTheory).toEqual([]);
  });

  it("reports theory risk as risky when every tracked judge is averse", () => {
    const averseOne = buildJudgeProfile("averse-one", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: false }),
    ]);
    const averseTwo = buildJudgeProfile("averse-two", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: false }),
    ]);
    const comparison = buildJudgePanelComparison([averseOne, averseTwo]);
    expect(comparison.theoryRisk).toBe("risky");
    expect(comparison.judgesAverseToTheory).toEqual(["averse-one", "averse-two"]);
  });

  it("reports theory risk as mixed when the panel is split", () => {
    const averse = buildJudgeProfile("averse", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: false }),
    ]);
    const receptive = buildJudgeProfile("receptive", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: true }),
    ]);
    const comparison = buildJudgePanelComparison([averse, receptive]);
    expect(comparison.theoryRisk).toBe("mixed");
    expect(comparison.judgesAverseToTheory).toEqual(["averse"]);
  });

  it("flags conflicting paradigms across the panel", () => {
    const flow = buildJudgeProfile("flow-judge", [record({ paradigmId: "flow" })]);
    const lay = buildJudgeProfile("lay-judge", [record({ paradigmId: "lay" })]);
    const comparison = buildJudgePanelComparison([flow, lay]);
    expect(comparison.hasConflictingParadigms).toBe(true);
    expect(comparison.paradigms).toEqual([
      { judgeId: "flow-judge", paradigmId: "flow" },
      { judgeId: "lay-judge", paradigmId: "lay" },
    ]);
  });

  it("does not flag a conflict when tagged judges agree, or when only one is tagged", () => {
    const flowA = buildJudgeProfile("flow-a", [record({ paradigmId: "flow" })]);
    const flowB = buildJudgeProfile("flow-b", [record({ paradigmId: "flow" })]);
    expect(buildJudgePanelComparison([flowA, flowB]).hasConflictingParadigms).toBe(false);

    const untagged = buildJudgeProfile("untagged", [record()]);
    expect(buildJudgePanelComparison([flowA, untagged]).hasConflictingParadigms).toBe(false);
  });

  it("preserves input order and echoes back judgeIds/judges", () => {
    const b = buildJudgeProfile("b", [record()]);
    const a = buildJudgeProfile("a", [record()]);
    const comparison = buildJudgePanelComparison([b, a]);
    expect(comparison.judgeIds).toEqual(["b", "a"]);
    expect(comparison.judges).toEqual([b, a]);
  });
});

describe("buildJudgePanelComparisonSummary", () => {
  it("renders every section of a fully-known panel", () => {
    const skewed = buildJudgeProfile("skewed", [
      ...Array.from({ length: 5 }, () => record({ winningSide: "aff", paceWpm: 180, paradigmId: "flow" })),
      record({ winningSide: "neg" }),
    ]);
    const receptive = buildJudgeProfile("receptive", [
      record({ paceWpm: 320, theoryArgumentRaised: true, theoryArgumentWon: true, paradigmId: "lay" }),
    ]);
    const summary = buildJudgePanelComparisonSummary(
      buildJudgePanelComparison([skewed, receptive]),
    );

    expect(summary).toContain("Panel of 2: skewed, receptive.");
    expect(summary).toContain("Side leans: skewed → aff");
    expect(summary).toContain("Recommended pace: 180 wpm (set by skewed");
    expect(summary).toContain("Theory: safe to run");
    expect(summary).toContain("Paradigms: conflicting across the panel (skewed: flow, receptive: lay)");
  });

  it("renders unknown/no-conflict placeholders when a panel has no signal", () => {
    const a = buildJudgeProfile("a", [record()]);
    const b = buildJudgeProfile("b", [record()]);
    const summary = buildJudgePanelComparisonSummary(buildJudgePanelComparison([a, b]));

    expect(summary).toContain("Side leans: no judge on this panel has a notable side bias on record.");
    expect(summary).toContain("Recommended pace: unknown");
    expect(summary).toContain("Theory: unknown");
    expect(summary).toContain("Paradigms: no conflict among tagged judges on this panel");
  });

  it("renders the mixed and risky theory branches", () => {
    const averse = buildJudgeProfile("averse", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: false }),
    ]);
    const receptive = buildJudgeProfile("receptive", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: true }),
    ]);
    const mixedSummary = buildJudgePanelComparisonSummary(
      buildJudgePanelComparison([averse, receptive]),
    );
    expect(mixedSummary).toContain("Theory: mixed — averse averse, others receptive");

    const otherAverse = buildJudgeProfile("other-averse", [
      record({ theoryArgumentRaised: true, theoryArgumentWon: false }),
    ]);
    const riskySummary = buildJudgePanelComparisonSummary(
      buildJudgePanelComparison([averse, otherAverse]),
    );
    expect(riskySummary).toContain("Theory: risky — every tracked judge on this panel is theory-averse (averse, other-averse)");
  });
});
