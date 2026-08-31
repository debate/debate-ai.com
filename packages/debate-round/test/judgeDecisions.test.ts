import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptJudgeDecision,
  appendJudgeDecision,
  buildJudgeDecisionsPanelView,
  deleteJudgeDecision,
  deleteJudgeDecisionsForRound,
  getJudgeDecision,
  listJudgeDecisions,
  listJudgeDecisionsForRound,
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

const INPUT_A: Omit<JudgeDecisionRecord, "id"> = {
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

const INPUT_B: Omit<JudgeDecisionRecord, "id"> = {
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

describe("appendJudgeDecision", () => {
  it("assigns a fresh id and returns the stamped record", () => {
    const record = appendJudgeDecision(INPUT_A);
    expect(record.id).toBeTruthy();
    expect(record).toMatchObject(INPUT_A);
  });

  it("never overwrites an existing entry, even for the same roundId", () => {
    appendJudgeDecision(INPUT_A);
    appendJudgeDecision({ ...INPUT_A, generatedAt: 1500 });
    expect(listJudgeDecisions()).toHaveLength(2);
  });

  it("assigns distinct ids to two decisions requested back to back", () => {
    const first = appendJudgeDecision(INPUT_A);
    const second = appendJudgeDecision({ ...INPUT_A, generatedAt: 1500 });
    expect(first.id).not.toBe(second.id);
  });
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

  it("lists every appended judge decision", () => {
    appendJudgeDecision(INPUT_A);
    appendJudgeDecision(INPUT_B);
    expect(listJudgeDecisions()).toHaveLength(2);
  });
});

describe("getJudgeDecision", () => {
  it("returns undefined when no decision is stored with that id", () => {
    expect(getJudgeDecision("does-not-exist")).toBeUndefined();
  });

  it("returns the stored decision by its own id", () => {
    const record = appendJudgeDecision(INPUT_A);
    expect(getJudgeDecision(record.id)).toEqual(record);
  });
});

describe("listJudgeDecisionsForRound", () => {
  it("returns only the given round's decisions, newest-first", () => {
    appendJudgeDecision(INPUT_A);
    const older = appendJudgeDecision({ ...INPUT_A, generatedAt: 500 });
    const newer = appendJudgeDecision({ ...INPUT_A, generatedAt: 5000 });
    appendJudgeDecision(INPUT_B);

    const forRound1 = listJudgeDecisionsForRound("round-1");
    expect(forRound1).toHaveLength(3);
    expect(forRound1[0].id).toBe(newer.id);
    expect(forRound1.at(-1)!.id).toBe(older.id);
  });

  it("returns an empty list for a round with no history", () => {
    appendJudgeDecision(INPUT_A);
    expect(listJudgeDecisionsForRound("round-does-not-exist")).toEqual([]);
  });
});

describe("adoptJudgeDecision", () => {
  it("inserts a record with a new id", () => {
    const remote: JudgeDecisionRecord = { ...INPUT_A, id: "decision-remote-1" };
    adoptJudgeDecision(remote);
    expect(listJudgeDecisions()).toEqual([remote]);
  });

  it("overwrites an existing record with the same id, rather than duplicating", () => {
    const remote: JudgeDecisionRecord = { ...INPUT_A, id: "decision-remote-1" };
    adoptJudgeDecision(remote);
    const updated: JudgeDecisionRecord = { ...remote, result: { ...remote.result, winner: "secondary" } };
    adoptJudgeDecision(updated);
    expect(listJudgeDecisions()).toEqual([updated]);
  });
});

describe("deleteJudgeDecision", () => {
  it("removes a single decision by its own id, leaving other decisions for the same round", () => {
    const first = appendJudgeDecision(INPUT_A);
    const second = appendJudgeDecision({ ...INPUT_A, generatedAt: 1500 });
    deleteJudgeDecision(first.id);
    expect(listJudgeDecisions()).toEqual([second]);
  });

  it("is a no-op when no decision has that id", () => {
    const record = appendJudgeDecision(INPUT_A);
    deleteJudgeDecision("does-not-exist");
    expect(listJudgeDecisions()).toEqual([record]);
  });
});

describe("deleteJudgeDecisionsForRound", () => {
  it("removes every decision for the given round, leaving other rounds untouched", () => {
    appendJudgeDecision(INPUT_A);
    appendJudgeDecision({ ...INPUT_A, generatedAt: 1500 });
    const other = appendJudgeDecision(INPUT_B);

    deleteJudgeDecisionsForRound("round-1");

    expect(listJudgeDecisions()).toEqual([other]);
    expect(listJudgeDecisionsForRound("round-1")).toEqual([]);
  });

  it("returns the removed ids newest-first", () => {
    const older = appendJudgeDecision(INPUT_A);
    const newer = appendJudgeDecision({ ...INPUT_A, generatedAt: 9000 });

    const removedIds = deleteJudgeDecisionsForRound("round-1");

    expect(removedIds).toEqual([newer.id, older.id]);
  });

  it("returns an empty array and is a no-op for a round with no history", () => {
    const record = appendJudgeDecision(INPUT_A);
    const removedIds = deleteJudgeDecisionsForRound("round-does-not-exist");
    expect(removedIds).toEqual([]);
    expect(listJudgeDecisions()).toEqual([record]);
  });
});

describe("buildJudgeDecisionsPanelView", () => {
  it("groups decisions by roundId, sorted by roundId", () => {
    appendJudgeDecision(INPUT_B);
    appendJudgeDecision(INPUT_A);
    const groups = buildJudgeDecisionsPanelView();
    expect(groups.map((g) => g.roundId)).toEqual(["round-1", "round-2"]);
  });

  it("sorts each round's decisions newest-first", () => {
    const older = appendJudgeDecision({ ...INPUT_A, generatedAt: 100 });
    const newer = appendJudgeDecision({ ...INPUT_A, generatedAt: 9000 });
    const [group] = buildJudgeDecisionsPanelView();
    expect(group.decisions.map((d) => d.id)).toEqual([newer.id, older.id]);
  });
});
