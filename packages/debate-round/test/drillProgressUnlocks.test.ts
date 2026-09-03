import { beforeEach, describe, expect, it } from "vitest";
import {
  DRILL_PRACTICE_CONTRIBUTOR_ID,
  buildDrillPracticeContributorStats,
  buildDrillPracticeUnlockStatus,
  buildDrillPracticeUnlockStatusFromStore,
  getTotalCompletedDrillCount,
} from "../src/state/drillProgressUnlocks";
import { saveDrillSet, toggleDrillCompletion, type DrillSetRecord } from "../src/state/drillSets";

/** Minimal in-memory `localStorage` mock — mirrors drillSets.test.ts's own. */
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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

const DRILL_SET_A: DrillSetRecord = {
  roundId: "round-1",
  sideKey: "aff",
  drills: [
    { kind: "overview", rowIndex: null, prompt: "Overview.", difficulty: "medium" },
    { kind: "frontline", rowIndex: 2, prompt: "Frontline.", difficulty: "hard" },
  ],
};

const DRILL_SET_B: DrillSetRecord = {
  roundId: "round-2",
  sideKey: "neg",
  drills: [{ kind: "cross_ex", rowIndex: 0, prompt: "Cross-ex.", difficulty: "easy" }],
};

describe("getTotalCompletedDrillCount", () => {
  it("returns 0 for an empty list", () => {
    expect(getTotalCompletedDrillCount([])).toBe(0);
  });

  it("returns 0 when nothing is marked completed", () => {
    expect(getTotalCompletedDrillCount([DRILL_SET_A, DRILL_SET_B])).toBe(0);
  });

  it("sums completed drills across multiple records", () => {
    const records = [
      { ...DRILL_SET_A, completedDrillIndexes: [0, 1] },
      { ...DRILL_SET_B, completedDrillIndexes: [0] },
    ];
    expect(getTotalCompletedDrillCount(records)).toBe(3);
  });

  it("ignores stale out-of-range completed indexes, same as getDrillSetCompletionStats", () => {
    const records = [{ ...DRILL_SET_A, completedDrillIndexes: [0, 99] }];
    expect(getTotalCompletedDrillCount(records)).toBe(1);
  });
});

describe("buildDrillPracticeContributorStats", () => {
  it("carries the completed-drill count as completedTaskCount, every other field zero", () => {
    expect(buildDrillPracticeContributorStats(7)).toEqual({
      contributorId: DRILL_PRACTICE_CONTRIBUTOR_ID,
      contributionCount: 0,
      totalHelpfulnessScore: 0,
      averageHelpfulnessScore: 0,
      bestContributionId: "",
      bestHelpfulnessScore: 0,
      popularityOnlyOutlierCount: 0,
      completedTaskCount: 7,
    });
  });

  it("accepts a caller-supplied contributorId", () => {
    expect(buildDrillPracticeContributorStats(2, "alice").contributorId).toBe("alice");
  });
});

describe("buildDrillPracticeUnlockStatus", () => {
  it("is novice tier with 0 practiced drills", () => {
    const status = buildDrillPracticeUnlockStatus(0);
    expect(status.tier).toBe("novice");
    expect(status.badges).toEqual([]);
    expect(status.unlockedSkillLevel).toBe("novice");
  });

  it("reaches apprentice at the default minCompletedTaskCount threshold (3), earning its badge", () => {
    const status = buildDrillPracticeUnlockStatus(3);
    expect(status.tier).toBe("apprentice");
    expect(status.badges).toEqual(["Rising Researcher"]);
  });

  it("does not reach apprentice one short of the threshold", () => {
    expect(buildDrillPracticeUnlockStatus(2).tier).toBe("novice");
  });

  it("reaches veteran at the default threshold (8), earning both tier badges", () => {
    const status = buildDrillPracticeUnlockStatus(8);
    expect(status.tier).toBe("veteran");
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor"]);
  });

  it("reaches expert at the default threshold (20), earning every tier badge", () => {
    const status = buildDrillPracticeUnlockStatus(20);
    expect(status.tier).toBe("expert");
    expect(status.unlockedSkillLevel).toBe("advanced");
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor", "Master Researcher"]);
    expect(status.nextTier).toBeNull();
  });

  it("reports next-tier progress driven by the completed-drill count alone", () => {
    const status = buildDrillPracticeUnlockStatus(1);
    expect(status.nextTier).not.toBeNull();
    expect(status.nextTier?.tier).toBe("apprentice");
    expect(status.nextTier?.completedTasksNeeded).toBe(2);
    expect(status.nextTier?.progressRatio).toBeCloseTo(1 / 3);
  });

  it("supports caller-supplied tier requirements", () => {
    const status = buildDrillPracticeUnlockStatus(5, [
      { tier: "novice", minContributionCount: 0, minTotalHelpfulnessScore: 0, minCompletedTaskCount: 0 },
      { tier: "apprentice", minContributionCount: 100, minTotalHelpfulnessScore: 100, minCompletedTaskCount: 5 },
      { tier: "veteran", minContributionCount: 200, minTotalHelpfulnessScore: 200, minCompletedTaskCount: 10 },
      { tier: "expert", minContributionCount: 300, minTotalHelpfulnessScore: 300, minCompletedTaskCount: 15 },
    ]);
    expect(status.tier).toBe("apprentice");
  });
});

describe("buildDrillPracticeUnlockStatusFromStore", () => {
  it("is novice when nothing is persisted", () => {
    expect(buildDrillPracticeUnlockStatusFromStore().tier).toBe("novice");
  });

  it("aggregates completed drills across every persisted round", () => {
    saveDrillSet(DRILL_SET_A);
    saveDrillSet(DRILL_SET_B);
    toggleDrillCompletion("round-1", 0);
    toggleDrillCompletion("round-1", 1);
    toggleDrillCompletion("round-2", 0);

    const status = buildDrillPracticeUnlockStatusFromStore();
    expect(status.tier).toBe("apprentice");
    expect(status.nextTier?.tier).toBe("veteran");
    expect(status.nextTier?.completedTasksNeeded).toBe(5);
  });
});
