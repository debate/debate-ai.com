import { describe, expect, it } from "vitest";
import {
  DEFAULT_STREAK_MILESTONES,
  buildContributorQuestStreak,
  buildStreakMilestoneAnnouncementText,
  buildStreakRewardText,
  buildStreakSummaryText,
  computeDailyMissionResult,
  computeStreakStatus,
  deriveEarnedStreakMilestoneEvents,
  getEarnedStreakBadges,
  type DailyMissionResult,
  type StreakMilestone,
} from "../src/lib/gamified-quests";
import type { QuestProgress } from "../src/lib/daily-quests";

function quest(questId: string, isComplete: boolean): QuestProgress {
  return {
    questId,
    description: `desc-${questId}`,
    targetCount: 5,
    completedCount: isComplete ? 5 : 2,
    remainingCount: isComplete ? 0 : 3,
    isComplete,
  };
}

function day(dayKey: string, isComplete: boolean): DailyMissionResult {
  return { dayKey, isComplete };
}

describe("computeDailyMissionResult", () => {
  it("is complete only when every quest on the board is complete", () => {
    const board = [quest("a", true), quest("b", true)];
    expect(computeDailyMissionResult(board, "2026-08-10")).toEqual({ dayKey: "2026-08-10", isComplete: true });
  });

  it("is incomplete when any quest on the board is incomplete", () => {
    const board = [quest("a", true), quest("b", false)];
    expect(computeDailyMissionResult(board, "2026-08-10").isComplete).toBe(false);
  });

  it("is incomplete for an empty board", () => {
    expect(computeDailyMissionResult([], "2026-08-10").isComplete).toBe(false);
  });
});

describe("computeStreakStatus", () => {
  it("counts consecutive completed days ending at asOfDayKey", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true), day("2026-08-10", true)];
    const status = computeStreakStatus(results, "2026-08-10");
    expect(status.currentStreak).toBe(3);
    expect(status.longestStreak).toBe(3);
    expect(status.lastCompletedDayKey).toBe("2026-08-10");
  });

  it("stops the current streak at the first gap", () => {
    const results = [day("2026-08-07", true), day("2026-08-09", true), day("2026-08-10", true)];
    const status = computeStreakStatus(results, "2026-08-10");
    expect(status.currentStreak).toBe(2);
  });

  it("is zero when asOfDayKey itself was not completed", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true)];
    const status = computeStreakStatus(results, "2026-08-10");
    expect(status.currentStreak).toBe(0);
  });

  it("ignores incomplete days when computing streaks", () => {
    const results = [day("2026-08-09", false), day("2026-08-10", true)];
    const status = computeStreakStatus(results, "2026-08-10");
    expect(status.currentStreak).toBe(1);
  });

  it("finds the longest run even when it isn't the current run", () => {
    const results = [
      day("2026-08-01", true),
      day("2026-08-02", true),
      day("2026-08-03", true),
      day("2026-08-04", true),
      day("2026-08-10", true),
    ];
    const status = computeStreakStatus(results, "2026-08-10");
    expect(status.currentStreak).toBe(1);
    expect(status.longestStreak).toBe(4);
  });

  it("crosses a UTC month boundary correctly", () => {
    const results = [day("2026-07-31", true), day("2026-08-01", true)];
    const status = computeStreakStatus(results, "2026-08-01");
    expect(status.currentStreak).toBe(2);
  });

  it("returns zeroes and a null last-completed day for empty history", () => {
    const status = computeStreakStatus([], "2026-08-10");
    expect(status).toEqual({ currentStreak: 0, longestStreak: 0, lastCompletedDayKey: null });
  });
});

describe("getEarnedStreakBadges", () => {
  it("returns no badges below the first milestone", () => {
    expect(getEarnedStreakBadges(2)).toEqual([]);
  });

  it("returns every milestone badge reached, in ascending order", () => {
    expect(getEarnedStreakBadges(10)).toEqual(DEFAULT_STREAK_MILESTONES.filter((m) => m.streakLength <= 10).map(
      (m) => m.badge,
    ));
    expect(getEarnedStreakBadges(10)).toEqual(["3-Day Streak", "Week Warrior"]);
  });

  it("returns every default badge once the longest milestone is cleared", () => {
    expect(getEarnedStreakBadges(30)).toEqual(["3-Day Streak", "Week Warrior", "Fortnight Focus", "Monthly Momentum"]);
  });

  it("supports a custom milestone list, sorted by length regardless of input order", () => {
    const milestones: StreakMilestone[] = [
      { streakLength: 5, badge: "Five" },
      { streakLength: 1, badge: "One" },
    ];
    expect(getEarnedStreakBadges(5, milestones)).toEqual(["One", "Five"]);
  });
});

describe("buildContributorQuestStreak", () => {
  it("combines streak status and earned badges for a contributor", () => {
    const results = [
      day("2026-08-08", true),
      day("2026-08-09", true),
      day("2026-08-10", true),
    ];
    const status = buildContributorQuestStreak("alex", results, "2026-08-10");
    expect(status.contributorId).toBe("alex");
    expect(status.streak.currentStreak).toBe(3);
    expect(status.earnedBadges).toEqual(["3-Day Streak"]);
  });
});

describe("buildStreakSummaryText", () => {
  it("renders streak counts without a badge suffix when none are earned", () => {
    const status = buildContributorQuestStreak("alex", [day("2026-08-10", true)], "2026-08-10");
    expect(buildStreakSummaryText(status)).toBe("alex: 1-day streak (longest 1)");
  });

  it("renders earned badges when present", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true), day("2026-08-10", true)];
    const status = buildContributorQuestStreak("alex", results, "2026-08-10");
    expect(buildStreakSummaryText(status)).toBe("alex: 3-day streak (longest 3), badges: 3-Day Streak");
  });
});

describe("buildStreakRewardText", () => {
  it("prompts to start a streak when the mission isn't complete today and there is no streak yet", () => {
    const status = buildContributorQuestStreak("alex", [], "2026-08-10");
    expect(buildStreakRewardText(status, false)).toBe("Complete today's quests to start a streak.");
  });

  it("encourages continuing an existing streak when today's mission isn't complete", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true)];
    const status = buildContributorQuestStreak("alex", results, "2026-08-09");
    expect(buildStreakRewardText(status, false)).toBe(
      "🔥 2-day streak — complete today's quests to keep it going.",
    );
  });

  it("celebrates a plain completion when today's streak length isn't a milestone", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", true)];
    const status = buildContributorQuestStreak("alex", results, "2026-08-10");
    expect(buildStreakRewardText(status, true)).toBe("🎉 Mission complete! 2-day streak.");
  });

  it("calls out a badge freshly earned today when the streak exactly reaches a milestone", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true), day("2026-08-10", true)];
    const status = buildContributorQuestStreak("alex", results, "2026-08-10");
    expect(buildStreakRewardText(status, true)).toBe(
      '🎉 Mission complete! 3-day streak — you just earned "3-Day Streak"!',
    );
  });

  it("does not re-announce a badge earned on a prior day", () => {
    const results = [
      day("2026-08-08", true),
      day("2026-08-09", true),
      day("2026-08-10", true),
      day("2026-08-11", true),
    ];
    const status = buildContributorQuestStreak("alex", results, "2026-08-11");
    expect(buildStreakRewardText(status, true)).toBe("🎉 Mission complete! 4-day streak.");
  });

  it("supports a custom milestone list", () => {
    const milestones: StreakMilestone[] = [{ streakLength: 1, badge: "First Day" }];
    const status = buildContributorQuestStreak("alex", [day("2026-08-10", true)], "2026-08-10", milestones);
    expect(buildStreakRewardText(status, true, milestones)).toBe(
      '🎉 Mission complete! 1-day streak — you just earned "First Day"!',
    );
  });
});

describe("deriveEarnedStreakMilestoneEvents", () => {
  it("returns no events for a history that never reaches a milestone", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", true)];
    expect(deriveEarnedStreakMilestoneEvents(results)).toEqual([]);
  });

  it("reports the exact day a milestone is first crossed", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true), day("2026-08-10", true)];
    expect(deriveEarnedStreakMilestoneEvents(results)).toEqual([
      { dayKey: "2026-08-10", streakLength: 3, badge: "3-Day Streak" },
    ]);
  });

  it("does not re-report the same milestone on later days once the streak has moved past it", () => {
    const results = [
      day("2026-08-08", true),
      day("2026-08-09", true),
      day("2026-08-10", true),
      day("2026-08-11", true),
    ];
    expect(deriveEarnedStreakMilestoneEvents(results)).toEqual([
      { dayKey: "2026-08-10", streakLength: 3, badge: "3-Day Streak" },
    ]);
  });

  it("reports every milestone crossed across a long enough streak", () => {
    const results = Array.from({ length: 7 }, (_, i) => day(`2026-08-${String(i + 1).padStart(2, "0")}`, true));
    expect(deriveEarnedStreakMilestoneEvents(results)).toEqual([
      { dayKey: "2026-08-03", streakLength: 3, badge: "3-Day Streak" },
      { dayKey: "2026-08-07", streakLength: 7, badge: "Week Warrior" },
    ]);
  });

  it("resets after a gap, so a milestone can be earned again on a fresh streak", () => {
    const results = [
      day("2026-08-01", true),
      day("2026-08-02", true),
      day("2026-08-03", true),
      // gap on 2026-08-04
      day("2026-08-05", true),
      day("2026-08-06", true),
      day("2026-08-07", true),
    ];
    expect(deriveEarnedStreakMilestoneEvents(results)).toEqual([
      { dayKey: "2026-08-03", streakLength: 3, badge: "3-Day Streak" },
      { dayKey: "2026-08-07", streakLength: 3, badge: "3-Day Streak" },
    ]);
  });

  it("ignores incomplete days", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", false), day("2026-08-10", true)];
    expect(deriveEarnedStreakMilestoneEvents(results)).toEqual([]);
  });

  it("returns no events for empty history", () => {
    expect(deriveEarnedStreakMilestoneEvents([])).toEqual([]);
  });

  it("supports a custom milestone list", () => {
    const milestones: StreakMilestone[] = [{ streakLength: 1, badge: "First Day" }];
    const results = [day("2026-08-10", true)];
    expect(deriveEarnedStreakMilestoneEvents(results, milestones)).toEqual([
      { dayKey: "2026-08-10", streakLength: 1, badge: "First Day" },
    ]);
  });
});

describe("buildStreakMilestoneAnnouncementText", () => {
  it("renders a third-person announcement for a freshly earned milestone", () => {
    expect(
      buildStreakMilestoneAnnouncementText("alex", { dayKey: "2026-08-10", streakLength: 3, badge: "3-Day Streak" }),
    ).toBe('alex reached a 3-day streak and earned "3-Day Streak"!');
  });
});
