import { beforeEach, describe, expect, it } from "vitest";
import {
  adoptStrategyRecommendation,
  appendStrategyRecommendation,
  buildStrategyRecommendationsPanelView,
  deleteStrategyRecommendation,
  deleteStrategyRecommendationsForMatchup,
  getLatestStrategyRecommendationForMatchup,
  getStrategyRecommendation,
  listStrategyRecommendations,
  listStrategyRecommendationsForMatchup,
  MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP,
  updateStrategyRecommendationAiCaseChoice,
  type StrategyRecommendationRecord,
} from "../src/state/strategyRecommendations";
import type { CaseChoiceAiResult } from "../src/round/case-choice-ai";

/** Convenience wrapper — most tests only care about the stamped record. */
function append(input: Omit<StrategyRecommendationRecord, "id">): StrategyRecommendationRecord {
  return appendStrategyRecommendation(input).record;
}

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

const INPUT_A: Omit<StrategyRecommendationRecord, "id"> = {
  matchupId: "round-1",
  recommendation: {
    recommendedCase: { name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 },
    caseRankings: [{ name: "Kritik case", argumentTags: ["kritik"], overlapScore: 1 }],
    judgeAdaptationNotes: ["No judge tendency data on file — adapt to a generic flow judge by default."],
    riskLevel: "low",
    riskFactors: [],
  },
  generatedAt: 1000,
};

const INPUT_B: Omit<StrategyRecommendationRecord, "id"> = {
  matchupId: "round-2",
  recommendation: {
    recommendedCase: { name: "Topicality case", argumentTags: ["topicality"], overlapScore: 3 },
    caseRankings: [{ name: "Topicality case", argumentTags: ["topicality"], overlapScore: 3 }],
    judgeAdaptationNotes: ["Slow down delivery — this judge has a low tracked speed tolerance."],
    riskLevel: "high",
    riskFactors: ["Opponent has a strong overall record (75% win rate across 4 round(s))."],
  },
  generatedAt: 2000,
};

const AI_CASE_CHOICE: CaseChoiceAiResult = {
  recommendedCase: "Kritik case",
  reasoning: "Lowest overlap and fits the judge's tendencies.",
  caseAssessments: [{ name: "Kritik case", assessment: "Safest available option." }],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("appendStrategyRecommendation", () => {
  it("assigns a fresh id and returns the stamped record", () => {
    const { record } = appendStrategyRecommendation(INPUT_A);
    expect(record.id).toBeTruthy();
    expect(record).toMatchObject(INPUT_A);
  });

  it("never overwrites an existing entry, even for the same matchupId", () => {
    append(INPUT_A);
    append({ ...INPUT_A, generatedAt: 1500 });
    expect(listStrategyRecommendations()).toHaveLength(2);
  });

  it("assigns distinct ids to two recommendations built back to back", () => {
    const first = append(INPUT_A);
    const second = append({ ...INPUT_A, generatedAt: 1500 });
    expect(first.id).not.toBe(second.id);
  });

  it("returns an empty trimmedIds while a matchup stays under the cap", () => {
    for (let i = 0; i < MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP; i++) {
      const { trimmedIds } = appendStrategyRecommendation({ ...INPUT_A, generatedAt: i });
      expect(trimmedIds).toEqual([]);
    }
    expect(listStrategyRecommendationsForMatchup("round-1")).toHaveLength(MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP);
  });

  it("trims the oldest recommendation for a matchup once it exceeds MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP", () => {
    const oldest = append({ ...INPUT_A, generatedAt: 0 });
    for (let i = 1; i < MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP; i++) {
      append({ ...INPUT_A, generatedAt: i });
    }
    const { record: newest, trimmedIds } = appendStrategyRecommendation({
      ...INPUT_A,
      generatedAt: MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP,
    });

    expect(trimmedIds).toEqual([oldest.id]);
    const forMatchup1 = listStrategyRecommendationsForMatchup("round-1");
    expect(forMatchup1).toHaveLength(MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP);
    expect(forMatchup1.map((r) => r.id)).not.toContain(oldest.id);
    expect(forMatchup1[0].id).toBe(newest.id);
  });

  it("leaves other matchups untouched when one matchup's cap is enforced", () => {
    for (let i = 0; i <= MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP; i++) {
      append({ ...INPUT_A, generatedAt: i });
    }
    append(INPUT_B);

    expect(listStrategyRecommendationsForMatchup("round-2")).toHaveLength(1);
  });
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

  it("lists every appended recommendation", () => {
    append(INPUT_A);
    append(INPUT_B);
    expect(listStrategyRecommendations()).toHaveLength(2);
  });
});

describe("getStrategyRecommendation", () => {
  it("returns undefined when no recommendation is stored with that id", () => {
    expect(getStrategyRecommendation("does-not-exist")).toBeUndefined();
  });

  it("returns the stored recommendation by its own id", () => {
    const record = append(INPUT_A);
    expect(getStrategyRecommendation(record.id)).toEqual(record);
  });
});

describe("listStrategyRecommendationsForMatchup", () => {
  it("returns only the given matchup's recommendations, newest-first", () => {
    append(INPUT_A);
    const older = append({ ...INPUT_A, generatedAt: 500 });
    const newer = append({ ...INPUT_A, generatedAt: 5000 });
    append(INPUT_B);

    const forMatchup1 = listStrategyRecommendationsForMatchup("round-1");
    expect(forMatchup1).toHaveLength(3);
    expect(forMatchup1[0].id).toBe(newer.id);
    expect(forMatchup1.at(-1)!.id).toBe(older.id);
  });

  it("returns an empty list for a matchup with no history", () => {
    append(INPUT_A);
    expect(listStrategyRecommendationsForMatchup("round-does-not-exist")).toEqual([]);
  });
});

describe("getLatestStrategyRecommendationForMatchup", () => {
  it("returns the most recently built recommendation for a matchup", () => {
    append({ ...INPUT_A, generatedAt: 100 });
    const newest = append({ ...INPUT_A, generatedAt: 9000 });
    expect(getLatestStrategyRecommendationForMatchup("round-1")?.id).toBe(newest.id);
  });

  it("returns undefined for a matchup with no history", () => {
    expect(getLatestStrategyRecommendationForMatchup("round-does-not-exist")).toBeUndefined();
  });
});

describe("adoptStrategyRecommendation", () => {
  it("inserts a record with a new id", () => {
    const remote: StrategyRecommendationRecord = { ...INPUT_A, id: "strategy-remote-1" };
    adoptStrategyRecommendation(remote);
    expect(listStrategyRecommendations()).toEqual([remote]);
  });

  it("overwrites an existing record with the same id, rather than duplicating", () => {
    const remote: StrategyRecommendationRecord = { ...INPUT_A, id: "strategy-remote-1" };
    adoptStrategyRecommendation(remote);
    const updated: StrategyRecommendationRecord = {
      ...remote,
      recommendation: { ...remote.recommendation, riskLevel: "high" },
    };
    adoptStrategyRecommendation(updated);
    expect(listStrategyRecommendations()).toEqual([updated]);
  });
});

describe("updateStrategyRecommendationAiCaseChoice", () => {
  it("sets aiCaseChoice on the stored record and returns it", () => {
    const record = append(INPUT_A);
    const updated = updateStrategyRecommendationAiCaseChoice(record.id, AI_CASE_CHOICE);

    expect(updated).toEqual({ ...record, aiCaseChoice: AI_CASE_CHOICE });
    expect(getStrategyRecommendation(record.id)).toEqual({ ...record, aiCaseChoice: AI_CASE_CHOICE });
  });

  it("overwrites an existing evaluation for the same recommendation", () => {
    const record = append(INPUT_A);
    updateStrategyRecommendationAiCaseChoice(record.id, AI_CASE_CHOICE);
    const regenerated: CaseChoiceAiResult = { ...AI_CASE_CHOICE, reasoning: "Regenerated reasoning." };
    updateStrategyRecommendationAiCaseChoice(record.id, regenerated);

    expect(getStrategyRecommendation(record.id)?.aiCaseChoice).toEqual(regenerated);
  });

  it("leaves other recommendations for the same matchup untouched", () => {
    const first = append(INPUT_A);
    const second = append({ ...INPUT_A, generatedAt: 1500 });
    updateStrategyRecommendationAiCaseChoice(first.id, AI_CASE_CHOICE);

    expect(getStrategyRecommendation(second.id)?.aiCaseChoice).toBeUndefined();
  });

  it("returns undefined and is a no-op when the id isn't stored", () => {
    const record = append(INPUT_B);
    const updated = updateStrategyRecommendationAiCaseChoice("does-not-exist", AI_CASE_CHOICE);

    expect(updated).toBeUndefined();
    expect(listStrategyRecommendations()).toEqual([record]);
  });
});

describe("deleteStrategyRecommendation", () => {
  it("removes a single recommendation by its own id, leaving other recommendations for the same matchup", () => {
    const first = append(INPUT_A);
    const second = append({ ...INPUT_A, generatedAt: 1500 });
    deleteStrategyRecommendation(first.id);
    expect(listStrategyRecommendations()).toEqual([second]);
  });

  it("is a no-op when no recommendation has that id", () => {
    const record = append(INPUT_A);
    deleteStrategyRecommendation("does-not-exist");
    expect(listStrategyRecommendations()).toEqual([record]);
  });
});

describe("deleteStrategyRecommendationsForMatchup", () => {
  it("removes every recommendation for the given matchup, leaving other matchups untouched", () => {
    append(INPUT_A);
    append({ ...INPUT_A, generatedAt: 1500 });
    const other = append(INPUT_B);

    deleteStrategyRecommendationsForMatchup("round-1");

    expect(listStrategyRecommendations()).toEqual([other]);
    expect(listStrategyRecommendationsForMatchup("round-1")).toEqual([]);
  });

  it("returns the removed ids newest-first", () => {
    const older = append(INPUT_A);
    const newer = append({ ...INPUT_A, generatedAt: 9000 });

    const removedIds = deleteStrategyRecommendationsForMatchup("round-1");

    expect(removedIds).toEqual([newer.id, older.id]);
  });

  it("returns an empty array and is a no-op for a matchup with no history", () => {
    const record = append(INPUT_A);
    const removedIds = deleteStrategyRecommendationsForMatchup("round-does-not-exist");
    expect(removedIds).toEqual([]);
    expect(listStrategyRecommendations()).toEqual([record]);
  });
});

describe("buildStrategyRecommendationsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildStrategyRecommendationsPanelView()).toEqual([]);
  });

  it("groups recommendations by matchupId, sorted by matchupId", () => {
    append(INPUT_B);
    append(INPUT_A);
    const groups = buildStrategyRecommendationsPanelView();
    expect(groups.map((g) => g.matchupId)).toEqual(["round-1", "round-2"]);
  });

  it("sorts each matchup's recommendations newest-first", () => {
    const older = append({ ...INPUT_A, generatedAt: 100 });
    const newer = append({ ...INPUT_A, generatedAt: 9000 });
    const [group] = buildStrategyRecommendationsPanelView();
    expect(group.recommendations.map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});
