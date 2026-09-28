import { describe, expect, it } from "vitest";
import {
  buildJudgePanelRubricAgreement,
  combineJudgePanelDecisions,
  type JudgePanelParadigmDecision,
  type JudgePanelParadigmResult,
} from "../src/round/judge-decision-panel";
import type { JudgeDecisionAiResult } from "../src/round/judge-decision-ai";

function resultFor(paradigmName: string, winner: "primary" | "secondary", keyVotingIssues: string[]): JudgePanelParadigmResult {
  return {
    paradigmName,
    result: { winner, keyVotingIssues, rationale: `${paradigmName} rationale.` },
  };
}

describe("combineJudgePanelDecisions", () => {
  it("throws with fewer than 2 results", () => {
    expect(() => combineJudgePanelDecisions([resultFor("Flow", "primary", ["A"])])).toThrow();
    expect(() => combineJudgePanelDecisions([])).toThrow();
  });

  it("declares the majority winner and reports vote counts", () => {
    const combined = combineJudgePanelDecisions([
      resultFor("Flow / Tech Judge", "primary", ["Dropped disad"]),
      resultFor("Lay / Community Judge", "primary", ["Clarity"]),
      resultFor("Policymaker", "secondary", ["Net benefits"]),
    ]);

    expect(combined.winner).toBe("primary");
    expect(combined.primaryVotes).toBe(2);
    expect(combined.secondaryVotes).toBe(1);
    expect(combined.unanimous).toBe(false);
  });

  it("reports a split on an even tie", () => {
    const combined = combineJudgePanelDecisions([
      resultFor("Flow", "primary", ["A"]),
      resultFor("Policymaker", "secondary", ["B"]),
    ]);

    expect(combined.winner).toBe("split");
    expect(combined.unanimous).toBe(false);
  });

  it("marks unanimous when every paradigm agrees", () => {
    const combined = combineJudgePanelDecisions([
      resultFor("Flow", "secondary", ["A"]),
      resultFor("Critic", "secondary", ["B"]),
      resultFor("Educator", "secondary", ["C"]),
    ]);

    expect(combined.unanimous).toBe(true);
    expect(combined.winner).toBe("secondary");
  });

  it("unions key voting issues, de-duplicated, in first-seen order", () => {
    const combined = combineJudgePanelDecisions([
      resultFor("Flow", "primary", ["Dropped disad", "Framework"]),
      resultFor("Policymaker", "primary", ["Framework", "Net benefits"]),
    ]);

    expect(combined.keyVotingIssues).toEqual(["Dropped disad", "Framework", "Net benefits"]);
  });
});

const PARADIGM_A = {
  id: "custom" as const,
  name: "Paradigm A",
  description: "Test paradigm A.",
  votingPriorities: ["Alpha criterion", "Beta criterion"],
  speedTolerance: "medium" as const,
  jargonTolerance: "medium" as const,
  instructions: "Judge under paradigm A.",
};

const PARADIGM_B = {
  id: "custom" as const,
  name: "Paradigm B",
  description: "Test paradigm B.",
  votingPriorities: ["Gamma criterion"],
  speedTolerance: "medium" as const,
  jargonTolerance: "medium" as const,
  instructions: "Judge under paradigm B.",
};

function decisionResultFor(keyVotingIssues: string[], rationale: string): JudgeDecisionAiResult {
  return { winner: "primary", keyVotingIssues, rationale };
}

describe("buildJudgePanelRubricAgreement", () => {
  it("throws with fewer than 2 entries", () => {
    const single: JudgePanelParadigmDecision[] = [
      { paradigm: PARADIGM_A, result: decisionResultFor(["Something about alpha here"], "Nothing else was discussed.") },
    ];
    expect(() => buildJudgePanelRubricAgreement(single)).toThrow();
    expect(() => buildJudgePanelRubricAgreement([])).toThrow();
  });

  it("builds each paradigm's own rubric and sums an overall addressed/total count", () => {
    const agreement = buildJudgePanelRubricAgreement([
      {
        paradigm: PARADIGM_A,
        result: decisionResultFor(["Something about alpha here"], "Nothing else was discussed."),
      },
      {
        paradigm: PARADIGM_B,
        result: decisionResultFor(["Gamma won it clearly"], "Nothing else mattered."),
      },
    ]);

    expect(agreement.perParadigm).toHaveLength(2);

    const [breakdownA, breakdownB] = agreement.perParadigm;
    expect(breakdownA!.paradigmName).toBe("Paradigm A");
    expect(breakdownA!.totalCount).toBe(2);
    expect(breakdownA!.addressedCount).toBe(1);
    expect(breakdownA!.rubric.map((row) => row.criterion)).toEqual(["Alpha criterion", "Beta criterion"]);

    expect(breakdownB!.paradigmName).toBe("Paradigm B");
    expect(breakdownB!.totalCount).toBe(1);
    expect(breakdownB!.addressedCount).toBe(1);

    expect(agreement.totalAddressed).toBe(2);
    expect(agreement.totalCriteria).toBe(3);
    expect(agreement.agreementRate).toBeCloseTo(2 / 3);
  });

  it("reports a 0 agreement rate rather than dividing by zero when no criteria exist", () => {
    const noPriorities = { ...PARADIGM_A, votingPriorities: [] };
    const agreement = buildJudgePanelRubricAgreement([
      { paradigm: noPriorities, result: decisionResultFor([], "No priorities to check.") },
      { paradigm: { ...PARADIGM_B, votingPriorities: [] }, result: decisionResultFor([], "None here either.") },
    ]);

    expect(agreement.totalCriteria).toBe(0);
    expect(agreement.totalAddressed).toBe(0);
    expect(agreement.agreementRate).toBe(0);
  });
});
