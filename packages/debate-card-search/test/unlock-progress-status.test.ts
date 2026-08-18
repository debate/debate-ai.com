import { describe, expect, it } from "vitest";
import type { ContributorStats } from "../src/lib/contribution-leaderboard";
import {
  DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS,
  buildContributorUnlockStatusWithProgress,
  buildUnlockStatusWithProgressText,
  computeContributorTierWithProgress,
  type ProgressAwareUnlockTierRequirement,
} from "../src/lib/unlock-progress-status";

function makeStats(overrides: Partial<ContributorStats> = {}): ContributorStats {
  return {
    contributorId: "alice",
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "card-1",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    ...overrides,
  };
}

describe("computeContributorTierWithProgress", () => {
  it("returns novice for a contributor below every threshold, even with completed tasks", () => {
    expect(computeContributorTierWithProgress(makeStats({ contributionCount: 2, totalHelpfulnessScore: 5 }), 100)).toBe(
      "novice",
    );
  });

  it("reaches apprentice on stats alone, since apprentice requires zero completed tasks by default", () => {
    expect(
      computeContributorTierWithProgress(makeStats({ contributionCount: 5, totalHelpfulnessScore: 25 }), 0),
    ).toBe("apprentice");
  });

  it("withholds veteran until the completed-task gate is also cleared", () => {
    const stats = makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 });

    expect(computeContributorTierWithProgress(stats, 0)).toBe("apprentice");
    expect(computeContributorTierWithProgress(stats, 4)).toBe("apprentice");
    expect(computeContributorTierWithProgress(stats, 5)).toBe("veteran");
  });

  it("withholds expert until its higher completed-task gate is cleared", () => {
    const stats = makeStats({ contributionCount: 30, totalHelpfulnessScore: 300 });

    expect(computeContributorTierWithProgress(stats, 5)).toBe("veteran");
    expect(computeContributorTierWithProgress(stats, 14)).toBe("veteran");
    expect(computeContributorTierWithProgress(stats, 15)).toBe("expert");
  });

  it("supports caller-supplied requirement tables", () => {
    const requirements: ProgressAwareUnlockTierRequirement[] = [
      { tier: "novice", minContributionCount: 0, minTotalHelpfulnessScore: 0, minCompletedTaskCount: 0 },
      { tier: "apprentice", minContributionCount: 1, minTotalHelpfulnessScore: 1, minCompletedTaskCount: 1 },
      { tier: "veteran", minContributionCount: 2, minTotalHelpfulnessScore: 2, minCompletedTaskCount: 2 },
      { tier: "expert", minContributionCount: 3, minTotalHelpfulnessScore: 3, minCompletedTaskCount: 3 },
    ];

    expect(
      computeContributorTierWithProgress(makeStats({ contributionCount: 3, totalHelpfulnessScore: 3 }), 1, requirements),
    ).toBe("apprentice");
    expect(
      computeContributorTierWithProgress(makeStats({ contributionCount: 3, totalHelpfulnessScore: 3 }), 3, requirements),
    ).toBe("expert");
  });
});

describe("buildContributorUnlockStatusWithProgress", () => {
  it("builds a novice contributor's status with progress toward apprentice, including tasksNeeded", () => {
    const status = buildContributorUnlockStatusWithProgress(makeStats({ contributionCount: 2, totalHelpfulnessScore: 10 }), 0);

    expect(status).toEqual({
      contributorId: "alice",
      tier: "novice",
      unlockedSkillLevel: "novice",
      badges: [],
      completedTaskCount: 0,
      nextTier: { tier: "apprentice", contributionsNeeded: 3, helpfulnessScoreNeeded: 15, tasksNeeded: 0 },
    });
  });

  it("reports how many more tasks are needed to reach veteran even once stats already qualify", () => {
    const status = buildContributorUnlockStatusWithProgress(
      makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 }),
      2,
    );

    expect(status.tier).toBe("apprentice");
    expect(status.nextTier).toEqual({ tier: "veteran", contributionsNeeded: 0, helpfulnessScoreNeeded: 0, tasksNeeded: 3 });
  });

  it("has no next tier once a contributor reaches expert", () => {
    const status = buildContributorUnlockStatusWithProgress(
      makeStats({ contributionCount: 40, totalHelpfulnessScore: 400 }),
      15,
    );

    expect(status.tier).toBe("expert");
    expect(status.unlockedSkillLevel).toBe("advanced");
    expect(status.nextTier).toBeNull();
  });

  it("uses the default progress-aware requirement table when none is supplied", () => {
    const stats = makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 });
    const status = buildContributorUnlockStatusWithProgress(stats, 5);
    expect(status.tier).toBe(
      computeContributorTierWithProgress(stats, 5, DEFAULT_PROGRESS_AWARE_UNLOCK_TIER_REQUIREMENTS),
    );
    expect(status.tier).toBe("veteran");
  });
});

describe("buildUnlockStatusWithProgressText", () => {
  it("renders a novice's status with a completed-task count but no badge clause", () => {
    const text = buildUnlockStatusWithProgressText(
      buildContributorUnlockStatusWithProgress(makeStats({ contributionCount: 2, totalHelpfulnessScore: 10 }), 0),
    );

    expect(text).toBe(
      "alice: novice tier — unlocked novice tasks (0 tasks completed) (3 contributions, 15 pts, and 0 completed tasks to apprentice)",
    );
  });

  it("renders an expert's status with every badge and no next-tier clause", () => {
    const text = buildUnlockStatusWithProgressText(
      buildContributorUnlockStatusWithProgress(makeStats({ contributionCount: 40, totalHelpfulnessScore: 400 }), 15),
    );

    expect(text).toBe(
      "alice: expert tier — unlocked advanced tasks (15 tasks completed), badges: Rising Researcher, Seasoned Contributor, Master Researcher",
    );
  });
});
