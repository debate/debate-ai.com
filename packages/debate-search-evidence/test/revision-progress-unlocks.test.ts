import { describe, expect, it } from "vitest";
import {
  buildRevisionRewardContributorStats,
  buildRevisionRewardUnlockStatus,
} from "../src/lib/revision-progress-unlocks";
import type { ContributorRevisionStats } from "../src/lib/revision-incentives";

function stats(overrides: Partial<ContributorRevisionStats> = {}): ContributorRevisionStats {
  return {
    contributorId: "alice",
    revisionCount: 0,
    rewardedRevisionCount: 0,
    totalRewardPoints: 0,
    weakCardsImprovedCount: 0,
    ...overrides,
  };
}

describe("buildRevisionRewardContributorStats", () => {
  it("maps rewardedRevisionCount to contributionCount and totalRewardPoints to totalHelpfulnessScore", () => {
    expect(
      buildRevisionRewardContributorStats(
        stats({ contributorId: "bob", rewardedRevisionCount: 6, totalRewardPoints: 42 }),
      ),
    ).toEqual({
      contributorId: "bob",
      contributionCount: 6,
      totalHelpfulnessScore: 42,
      averageHelpfulnessScore: 7,
      bestContributionId: "",
      bestHelpfulnessScore: 0,
      popularityOnlyOutlierCount: 0,
      completedTaskCount: 0,
    });
  });

  it("averages to 0 when nothing was rewarded yet, rather than dividing by zero", () => {
    const result = buildRevisionRewardContributorStats(stats({ rewardedRevisionCount: 0, totalRewardPoints: 0 }));
    expect(result.averageHelpfulnessScore).toBe(0);
  });
});

describe("buildRevisionRewardUnlockStatus", () => {
  it("is novice tier with no rewarded revisions", () => {
    const status = buildRevisionRewardUnlockStatus(stats());
    expect(status.tier).toBe("novice");
    expect(status.badges).toEqual([]);
  });

  it("reaches apprentice once both default thresholds (5 revisions, 25 points) clear", () => {
    const status = buildRevisionRewardUnlockStatus(
      stats({ rewardedRevisionCount: 5, totalRewardPoints: 25 }),
    );
    expect(status.tier).toBe("apprentice");
    expect(status.badges).toEqual(["Rising Researcher"]);
  });

  it("does not reach apprentice when only the points threshold clears, not the count", () => {
    const status = buildRevisionRewardUnlockStatus(
      stats({ rewardedRevisionCount: 1, totalRewardPoints: 999 }),
    );
    expect(status.tier).toBe("novice");
  });

  it("reaches expert once both default thresholds (30 revisions, 300 points) clear", () => {
    const status = buildRevisionRewardUnlockStatus(
      stats({ rewardedRevisionCount: 30, totalRewardPoints: 300 }),
    );
    expect(status.tier).toBe("expert");
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor", "Master Researcher"]);
    expect(status.nextTier).toBeNull();
  });

  it("supports caller-supplied tier requirements", () => {
    const status = buildRevisionRewardUnlockStatus(
      stats({ rewardedRevisionCount: 2, totalRewardPoints: 10 }),
      [
        { tier: "novice", minContributionCount: 0, minTotalHelpfulnessScore: 0, minCompletedTaskCount: 0 },
        { tier: "apprentice", minContributionCount: 2, minTotalHelpfulnessScore: 10, minCompletedTaskCount: 999 },
        { tier: "veteran", minContributionCount: 10, minTotalHelpfulnessScore: 100, minCompletedTaskCount: 999 },
        { tier: "expert", minContributionCount: 20, minTotalHelpfulnessScore: 200, minCompletedTaskCount: 999 },
      ],
    );
    expect(status.tier).toBe("apprentice");
  });
});
