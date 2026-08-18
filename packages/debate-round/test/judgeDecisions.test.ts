import { beforeEach, describe, expect, it } from "vitest";
import {
  buildJudgeDecisionsPanelView,
  deleteJudgeDecision,
  getJudgeDecision,
  listJudgeDecisions,
  saveJudgeDecision,
  type JudgeDecisionRecord,
} from "../src/state/judgeDecisions";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const DECISION_A: JudgeDecisionRecord = {
  roundId: "round-1",
  paradigmName: "Flow / Tech Judge",
  sideNames: { primary: "Affirmative", secondary: "Negative" },
  result: {
    winner: "primary",
    keyVotingIssues: ["Dropped disadvantage"],
    rationale: "The negative dropped a key disadvantage.",
  },
  generatedAt: 1000,
};

const DECISION_B: JudgeDecisionRecord = {
  roundId: "round-2",
  paradigmName: "Policymaker",
  sideNames: { primary: "Aff", secondary: "Neg" },
  result: {
    winner: "secondary",
    keyVotingIssues: ["Net benefits"],
    rationale: "The negative's counterplan solves better with less risk.",
  },
  generatedAt: 2000,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listJudgeDecisions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listJudgeDecisions()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("judgeDecisions", "{not json");
    expect(listJudgeDecisions()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("judgeDecisions", JSON.stringify({ not: "an array" }));
    expect(listJudgeDecisions()).toEqual([]);
  });

  it("lists every saved judge decision", () => {
    saveJudgeDecision(DECISION_A);
    saveJudgeDecision(DECISION_B);
    expect(listJudgeDecisions()).toEqual([DECISION_A, DECISION_B]);
  });
});

describe("getJudgeDecision", () => {
  it("returns undefined when no decision is stored for the round", () => {
    expect(getJudgeDecision("round-1")).toBeUndefined();
  });

  it("returns the stored decision for a round", () => {
    saveJudgeDecision(DECISION_A);
    expect(getJudgeDecision("round-1")).toEqual(DECISION_A);
  });
});

describe("saveJudgeDecision", () => {
  it("overwrites an existing decision for the same roundId", () => {
    saveJudgeDecision(DECISION_A);
    const updated: JudgeDecisionRecord = { ...DECISION_A, result: { ...DECISION_A.result, winner: "secondary" } };
    saveJudgeDecision(updated);

    expect(listJudgeDecisions()).toEqual([updated]);
  });
});

describe("deleteJudgeDecision", () => {
  it("removes a stored decision", () => {
    saveJudgeDecision(DECISION_A);
    saveJudgeDecision(DECISION_B);
    deleteJudgeDecision("round-1");
    expect(listJudgeDecisions()).toEqual([DECISION_B]);
  });

  it("is a no-op when the round has no stored decision", () => {
    saveJudgeDecision(DECISION_A);
    deleteJudgeDecision("round-does-not-exist");
    expect(listJudgeDecisions()).toEqual([DECISION_A]);
  });
});

describe("buildJudgeDecisionsPanelView", () => {
  it("sorts decisions by roundId", () => {
    saveJudgeDecision(DECISION_B);
    saveJudgeDecision(DECISION_A);
    expect(buildJudgeDecisionsPanelView().map((r) => r.roundId)).toEqual(["round-1", "round-2"]);
  });
});
