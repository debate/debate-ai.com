import { beforeEach, describe, expect, it } from "vitest";
import {
  buildStrategyRecommendationsPanelView,
  deleteStrategyRecommendation,
  getStrategyRecommendation,
  listStrategyRecommendations,
  saveStrategyRecommendation,
  saveStrategyRecommendationAiCaseChoice,
  type StrategyRecommendationRecord,
} from "../src/state/strategyRecommendations";
import type { CaseChoiceAiResult } from "../src/round/case-choice-ai";

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

const RECOMMENDATION_A: StrategyRecommendationRecord = {
  matchupId: "round-1",
  recommendation: {
    recommendedCase: { name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 },
    caseRankings: [{ name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 }],
    judgeAdaptationNotes: ["No judge tendency data on file — adapt to a generic flow judge by default."],
    riskLevel: "low",
    riskFactors: [],
  },
};
const RECOMMENDATION_B: StrategyRecommendationRecord = {
  matchupId: "round-2",
  recommendation: {
    recommendedCase: { name: "Topicality case", argumentTags: ["topicality"], overlapScore: 3 },
    caseRankings: [{ name: "Topicality case", argumentTags: ["topicality"], overlapScore: 3 }],
    judgeAdaptationNotes: ["Slow down delivery — this judge has a low tracked speed tolerance."],
    riskLevel: "high",
    riskFactors: ["Opponent has a strong overall record (75% win rate across 4 round(s))."],
  },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listStrategyRecommendations", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listStrategyRecommendations()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("strategyRecommendations", "{not json");
    expect(listStrategyRecommendations()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("strategyRecommendations", JSON.stringify({ not: "an array" }));
    expect(listStrategyRecommendations()).toEqual([]);
  });

  it("lists every saved recommendation", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    saveStrategyRecommendation(RECOMMENDATION_B);
    expect(listStrategyRecommendations()).toEqual([RECOMMENDATION_A, RECOMMENDATION_B]);
  });
});

describe("getStrategyRecommendation", () => {
  it("finds a saved recommendation by matchupId", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    expect(getStrategyRecommendation("round-1")).toEqual(RECOMMENDATION_A);
  });

  it("returns undefined for a matchupId that isn't stored", () => {
    expect(getStrategyRecommendation("missing")).toBeUndefined();
  });
});

describe("saveStrategyRecommendation", () => {
  it("upserts — saving an existing matchupId overwrites rather than duplicating it", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    const updated: StrategyRecommendationRecord = {
      ...RECOMMENDATION_A,
      recommendation: { ...RECOMMENDATION_A.recommendation, riskLevel: "high" },
    };
    saveStrategyRecommendation(updated);

    expect(listStrategyRecommendations()).toEqual([updated]);
    expect(getStrategyRecommendation("round-1")).toEqual(updated);
  });
});

describe("saveStrategyRecommendationAiCaseChoice", () => {
  const AI_CASE_CHOICE: CaseChoiceAiResult = {
    recommendedCase: "Kritik case",
    reasoning: "Lowest overlap and fits the judge's tendencies.",
    caseAssessments: [{ name: "Kritik case", assessment: "Safest available option." }],
  };

  it("sets aiCaseChoice on the stored record", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    saveStrategyRecommendationAiCaseChoice("round-1", AI_CASE_CHOICE);

    expect(getStrategyRecommendation("round-1")).toEqual({ ...RECOMMENDATION_A, aiCaseChoice: AI_CASE_CHOICE });
  });

  it("overwrites an existing evaluation for the same matchup", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    saveStrategyRecommendationAiCaseChoice("round-1", AI_CASE_CHOICE);
    const regenerated: CaseChoiceAiResult = { ...AI_CASE_CHOICE, reasoning: "Regenerated reasoning." };
    saveStrategyRecommendationAiCaseChoice("round-1", regenerated);

    expect(getStrategyRecommendation("round-1")?.aiCaseChoice).toEqual(regenerated);
  });

  it("leaves other matchups' records untouched", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    saveStrategyRecommendation(RECOMMENDATION_B);
    saveStrategyRecommendationAiCaseChoice("round-1", AI_CASE_CHOICE);

    expect(getStrategyRecommendation("round-2")).toEqual(RECOMMENDATION_B);
  });

  it("is a no-op when the matchupId isn't stored", () => {
    saveStrategyRecommendation(RECOMMENDATION_B);
    saveStrategyRecommendationAiCaseChoice("missing", AI_CASE_CHOICE);

    expect(listStrategyRecommendations()).toEqual([RECOMMENDATION_B]);
  });
});

describe("deleteStrategyRecommendation", () => {
  it("removes a stored recommendation by matchupId", () => {
    saveStrategyRecommendation(RECOMMENDATION_A);
    saveStrategyRecommendation(RECOMMENDATION_B);
    deleteStrategyRecommendation("round-1");

    expect(listStrategyRecommendations()).toEqual([RECOMMENDATION_B]);
    expect(getStrategyRecommendation("round-1")).toBeUndefined();
  });

  it("is a no-op when the matchupId isn't stored", () => {
    saveStrategyRecommendation(RECOMMENDATION_B);
    deleteStrategyRecommendation("missing");
    expect(listStrategyRecommendations()).toEqual([RECOMMENDATION_B]);
  });
});

describe("buildStrategyRecommendationsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildStrategyRecommendationsPanelView()).toEqual([]);
  });

  it("sorts every persisted recommendation by matchupId", () => {
    saveStrategyRecommendation(RECOMMENDATION_B);
    saveStrategyRecommendation(RECOMMENDATION_A);
    expect(buildStrategyRecommendationsPanelView()).toEqual([RECOMMENDATION_A, RECOMMENDATION_B]);
  });

  it("does not mutate the underlying stored order", () => {
    saveStrategyRecommendation(RECOMMENDATION_B);
    saveStrategyRecommendation(RECOMMENDATION_A);
    buildStrategyRecommendationsPanelView();
    expect(listStrategyRecommendations()).toEqual([RECOMMENDATION_B, RECOMMENDATION_A]);
  });
});
