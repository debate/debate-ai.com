import { describe, expect, it } from "vitest";
import type { ContributorStats } from "../src/lib/contribution-leaderboard";
import type { DailyMissionResult } from "../src/lib/gamified-quests";
import {
  buildContributorUnlockStatusWithStreak,
  buildUnlockStatusWithStreakText,
} from "../src/lib/unlock-streak-status";

function makeStats(overrides: Partial<ContributorStats> & { contributorId: string }): ContributorStats {
  return {
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "none",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    ...overrides,
  };
}

function day(dayKey: string, isComplete: boolean): DailyMissionResult {
  return { dayKey, isComplete };
}

const veteranStats = makeStats({ contributorId: "veteran-vic", contributionCount: 15, totalHelpfulnessScore: 100 });

describe("buildContributorUnlockStatusWithStreak", () => {
  it("merges tier badges with streak badges earned as of the given day", () => {
    const missionResults = [
      day("2026-08-08", true),
      day("2026-08-09", true),
      day("2026-08-10", true),
    ];

    const status = buildContributorUnlockStatusWithStreak(veteranStats, missionResults, "2026-08-10");

    expect(status.tier).toBe("veteran");
    expect(status.unlockedSkillLevel).toBe("intermediate");
    expect(status.streak.currentStreak).toBe(3);
    expect(status.streakBadges).toEqual(["3-Day Streak"]);
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor", "3-Day Streak"]);
  });

  it("still returns a correct tier-only status when the streak is broken", () => {
    const missionResults = [day("2026-08-08", true), day("2026-08-10", false)];

    const status = buildContributorUnlockStatusWithStreak(veteranStats, missionResults, "2026-08-10");

    expect(status.streak.currentStreak).toBe(0);
    expect(status.streakBadges).toEqual([]);
    expect(status.badges).toEqual(["Rising Researcher", "Seasoned Contributor"]);
  });

  it("returns no badges at all for a novice contributor with no streak", () => {
    const noviceStats = makeStats({ contributorId: "novice-nick" });
    const status = buildContributorUnlockStatusWithStreak(noviceStats, [], "2026-08-10");

    expect(status.tier).toBe("novice");
    expect(status.badges).toEqual([]);
    expect(status.streakBadges).toEqual([]);
    expect(status.streak.currentStreak).toBe(0);
  });
});

describe("buildUnlockStatusWithStreakText", () => {
  it("composes the tier line and streak line via each source slice's own text builder", () => {
    const missionResults = [day("2026-08-09", true), day("2026-08-10", true)];
    const status = buildContributorUnlockStatusWithStreak(veteranStats, missionResults, "2026-08-10");

    const text = buildUnlockStatusWithStreakText(status);

    expect(text).toContain("veteran-vic: veteran tier");
    expect(text).toContain("veteran-vic: 2-day streak");
  });
});
