import { describe, expect, it } from "vitest";
import type { ContributorStats } from "../src/lib/contribution-leaderboard";
import {
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  buildContributorUnlockStatus,
  buildUnlockStatusText,
  computeContributorTier,
  getUnlockedBadges,
  getUnlockedSkillLevel,
  type UnlockTierRequirement,
} from "../src/lib/progress-unlocks";

function makeStats(overrides: Partial<ContributorStats> = {}): ContributorStats {
  return {
    contributorId: "alice",
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "card-1",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    completedTaskCount: 0,
    ...overrides,
  };
}

describe("computeContributorTier", () => {
  it("returns novice for a contributor below every threshold", () => {
    expect(computeContributorTier(makeStats({ contributionCount: 2, totalHelpfulnessScore: 5 }))).toBe("novice");
  });

  it("returns apprentice once both apprentice thresholds are cleared", () => {
    expect(computeContributorTier(makeStats({ contributionCount: 5, totalHelpfulnessScore: 25 }))).toBe(
      "apprentice",
    );
  });

  it("requires both contribution count and score thresholds, not just one", () => {
    expect(computeContributorTier(makeStats({ contributionCount: 50, totalHelpfulnessScore: 1 }))).toBe("novice");
    expect(computeContributorTier(makeStats({ contributionCount: 1, totalHelpfulnessScore: 1000 }))).toBe("novice");
  });

  it("returns the highest tier reached, not just the first one cleared", () => {
    expect(computeContributorTier(makeStats({ contributionCount: 40, totalHelpfulnessScore: 400 }))).toBe("expert");
  });

  it("returns veteran right at the veteran boundary", () => {
    expect(computeContributorTier(makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 }))).toBe(
      "veteran",
    );
  });

  it("supports caller-supplied requirement tables", () => {
    const requirements: UnlockTierRequirement[] = [
      { tier: "novice", minContributionCount: 0, minTotalHelpfulnessScore: 0, minCompletedTaskCount: 0 },
      { tier: "apprentice", minContributionCount: 1, minTotalHelpfulnessScore: 1, minCompletedTaskCount: 1 },
      { tier: "veteran", minContributionCount: 2, minTotalHelpfulnessScore: 2, minCompletedTaskCount: 2 },
      { tier: "expert", minContributionCount: 3, minTotalHelpfulnessScore: 3, minCompletedTaskCount: 3 },
    ];

    expect(computeContributorTier(makeStats({ contributionCount: 3, totalHelpfulnessScore: 3 }), requirements)).toBe(
      "expert",
    );
  });

  it("reaches a tier via completed tasks alone, with no scored contributions", () => {
    expect(computeContributorTier(makeStats({ completedTaskCount: 3 }))).toBe("apprentice");
    expect(computeContributorTier(makeStats({ completedTaskCount: 7 }))).toBe("apprentice");
    expect(computeContributorTier(makeStats({ completedTaskCount: 8 }))).toBe("veteran");
    expect(computeContributorTier(makeStats({ completedTaskCount: 20 }))).toBe("expert");
  });

  it("returns the highest tier reached combining the contribution and completed-task paths", () => {
    expect(
      computeContributorTier(makeStats({ contributionCount: 15, totalHelpfulnessScore: 100, completedTaskCount: 20 })),
    ).toBe("expert");
  });

  it("does not change tier for a contributor already qualifying via contributions when completedTaskCount is 0", () => {
    expect(computeContributorTier(makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 }))).toBe("veteran");
  });
});

describe("getUnlockedSkillLevel", () => {
  it("maps novice and apprentice to the novice skill level", () => {
    expect(getUnlockedSkillLevel("novice")).toBe("novice");
    expect(getUnlockedSkillLevel("apprentice")).toBe("novice");
  });

  it("maps veteran to intermediate and expert to advanced", () => {
    expect(getUnlockedSkillLevel("veteran")).toBe("intermediate");
    expect(getUnlockedSkillLevel("expert")).toBe("advanced");
  });
});

describe("getUnlockedBadges", () => {
  it("returns no badges at novice", () => {
    expect(getUnlockedBadges("novice")).toEqual([]);
  });

  it("accumulates every badge earned on the way to a tier", () => {
    expect(getUnlockedBadges("apprentice")).toEqual(["Rising Researcher"]);
    expect(getUnlockedBadges("veteran")).toEqual(["Rising Researcher", "Seasoned Contributor"]);
    expect(getUnlockedBadges("expert")).toEqual([
      "Rising Researcher",
      "Seasoned Contributor",
      "Master Researcher",
    ]);
  });
});

describe("buildContributorUnlockStatus", () => {
  it("builds a novice contributor's status with progress toward apprentice", () => {
    const status = buildContributorUnlockStatus(makeStats({ contributionCount: 2, totalHelpfulnessScore: 10 }));

    expect(status).toEqual({
      contributorId: "alice",
      tier: "novice",
      unlockedSkillLevel: "novice",
      badges: [],
      nextTier: { tier: "apprentice", contributionsNeeded: 3, helpfulnessScoreNeeded: 15, completedTasksNeeded: 3 },
      completedTaskCount: 0,
    });
  });

  it("reports zero remaining on whichever threshold is already cleared", () => {
    const status = buildContributorUnlockStatus(makeStats({ contributionCount: 20, totalHelpfulnessScore: 5 }));

    expect(status.tier).toBe("novice");
    expect(status.nextTier).toEqual({
      tier: "apprentice",
      contributionsNeeded: 0,
      helpfulnessScoreNeeded: 20,
      completedTasksNeeded: 3,
    });
  });

  it("reports zero completedTasksNeeded once the completed-task path alone is cleared", () => {
    const status = buildContributorUnlockStatus(makeStats({ completedTaskCount: 8, contributionCount: 15, totalHelpfulnessScore: 100 }));

    expect(status.tier).toBe("veteran");
    expect(status.nextTier).toEqual({
      tier: "expert",
      contributionsNeeded: 15,
      helpfulnessScoreNeeded: 200,
      completedTasksNeeded: 12,
    });
  });

  it("has no next tier once a contributor reaches expert", () => {
    const status = buildContributorUnlockStatus(makeStats({ contributionCount: 40, totalHelpfulnessScore: 400 }));

    expect(status.tier).toBe("expert");
    expect(status.unlockedSkillLevel).toBe("advanced");
    expect(status.nextTier).toBeNull();
  });

  it("uses the default requirement table when none is supplied", () => {
    const status = buildContributorUnlockStatus(makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 }));
    expect(status.tier).toBe(computeContributorTier(makeStats({ contributionCount: 15, totalHelpfulnessScore: 100 }), DEFAULT_UNLOCK_TIER_REQUIREMENTS));
  });
});

describe("buildUnlockStatusText", () => {
  it("renders a novice's status with no badge clause but a next-tier clause", () => {
    const text = buildUnlockStatusText(
      buildContributorUnlockStatus(makeStats({ contributionCount: 2, totalHelpfulnessScore: 10 })),
    );

    expect(text).toBe(
      "alice: novice tier — unlocked novice tasks (3 contributions and 15 pts, or 3 completed tasks, to apprentice)",
    );
  });

  it("renders an expert's status with every badge and no next-tier clause", () => {
    const text = buildUnlockStatusText(
      buildContributorUnlockStatus(makeStats({ contributionCount: 40, totalHelpfulnessScore: 400 })),
    );

    expect(text).toBe(
      "alice: expert tier — unlocked advanced tasks, badges: Rising Researcher, Seasoned Contributor, Master Researcher",
    );
  });
});
