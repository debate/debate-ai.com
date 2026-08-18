import { beforeEach, describe, expect, it } from "vitest";
import {
  buildJudgeDecisionsPanelView,
  deleteJudgeDecision,
  getJudgeDecision,
  listJudgeDecisions,
  saveJudgeDecision,
  type JudgeDecisionRecord,
} from "../src/state/judgeDecisions";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

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
  paradigm: judgeParadigms.flow,
  sideLabels: ["Affirmative", "Negative"],
  verdict: {
    winner: "Affirmative",
    reasoning: ["Dropped disad outweighs."],
    ballotText: "Aff wins on the flow.",
  },
};
const DECISION_B: JudgeDecisionRecord = {
  roundId: "round-2",
  paradigm: judgeParadigms.lay,
  sideLabels: ["Pro", "Con"],
  verdict: {
    winner: "Con",
    reasoning: ["Con was clearer and more persuasive."],
    ballotText: "Con wins on clarity.",
  },
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

  it("lists every saved decision", () => {
    saveJudgeDecision(DECISION_A);
    saveJudgeDecision(DECISION_B);
    expect(listJudgeDecisions()).toEqual([DECISION_A, DECISION_B]);
  });
});

describe("getJudgeDecision", () => {
  it("finds a saved decision by roundId", () => {
    saveJudgeDecision(DECISION_A);
    expect(getJudgeDecision("round-1")).toEqual(DECISION_A);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getJudgeDecision("missing")).toBeUndefined();
  });
});

describe("saveJudgeDecision", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveJudgeDecision(DECISION_A);
    const updated: JudgeDecisionRecord = {
      ...DECISION_A,
      verdict: { ...DECISION_A.verdict, winner: "Negative" },
    };
    saveJudgeDecision(updated);

    expect(listJudgeDecisions()).toEqual([updated]);
    expect(getJudgeDecision("round-1")).toEqual(updated);
  });
});

describe("deleteJudgeDecision", () => {
  it("removes a stored decision by roundId", () => {
    saveJudgeDecision(DECISION_A);
    saveJudgeDecision(DECISION_B);
    deleteJudgeDecision("round-1");

    expect(listJudgeDecisions()).toEqual([DECISION_B]);
    expect(getJudgeDecision("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveJudgeDecision(DECISION_B);
    deleteJudgeDecision("missing");
    expect(listJudgeDecisions()).toEqual([DECISION_B]);
  });
});

describe("buildJudgeDecisionsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildJudgeDecisionsPanelView()).toEqual([]);
  });

  it("sorts every persisted decision by roundId", () => {
    saveJudgeDecision(DECISION_B);
    saveJudgeDecision(DECISION_A);
    expect(buildJudgeDecisionsPanelView()).toEqual([DECISION_A, DECISION_B]);
  });

  it("does not mutate the underlying stored order", () => {
    saveJudgeDecision(DECISION_B);
    saveJudgeDecision(DECISION_A);
    buildJudgeDecisionsPanelView();
    expect(listJudgeDecisions()).toEqual([DECISION_B, DECISION_A]);
  });
});
