import { describe, expect, it } from "vitest";
import { combineJudgePanelDecisions, type JudgePanelParadigmResult } from "../src/round/judge-decision-panel";

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
