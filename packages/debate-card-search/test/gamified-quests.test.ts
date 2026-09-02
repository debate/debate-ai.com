import { describe, expect, it } from "vitest";
import {
  DEFAULT_STREAK_MILESTONES,
  MAX_STREAK_FREEZES_PER_WINDOW,
  STREAK_FREEZE_WINDOW_DAYS,
  applyStreakFreezes,
  buildContributorQuestStreak,
  buildStreakFreezeAvailabilityText,
  buildDailyQuestCompletionAnnouncementText,
  buildStreakMilestoneAnnouncementText,
  buildStreakRewardText,
  buildStreakSummaryText,
  canApplyStreakFreeze,
  computeDailyMissionResult,
  computeStreakStatus,
  countStreakFreezesUsedInWindow,
  deriveEarnedStreakMilestoneEvents,
  findFreezableStreakGapDayKey,
  getAvailableStreakFreezes,
  getEarnedStreakBadges,
  buildStreakLapseReminderText,
  getStreakLapseRiskLength,
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

describe("buildDailyQuestCompletionAnnouncementText", () => {
  it("renders a third-person announcement for a completed Daily Quests board", () => {
    expect(buildDailyQuestCompletionAnnouncementText("alex", "2026-08-10")).toBe(
      "alex completed every quest on the Daily Quests board for 2026-08-10!",
    );
  });
});

describe("applyStreakFreezes", () => {
  it("returns the same results unchanged when no days are frozen", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", false)];
    expect(applyStreakFreezes(results, [])).toEqual(results);
  });

  it("marks a frozen day complete when it already has an incomplete result", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", false)];
    expect(applyStreakFreezes(results, ["2026-08-10"])).toEqual([
      day("2026-08-09", true),
      day("2026-08-10", true),
    ]);
  });

  it("adds a fresh complete record for a frozen day with no existing result at all", () => {
    const results = [day("2026-08-09", true)];
    expect(applyStreakFreezes(results, ["2026-08-10"])).toEqual([
      day("2026-08-09", true),
      day("2026-08-10", true),
    ]);
  });

  it("accepts a Set as well as an array of dayKeys", () => {
    const results = [day("2026-08-10", false)];
    expect(applyStreakFreezes(results, new Set(["2026-08-10"]))).toEqual([day("2026-08-10", true)]);
  });

  it("does not mutate the input array", () => {
    const results = [day("2026-08-10", false)];
    applyStreakFreezes(results, ["2026-08-10"]);
    expect(results).toEqual([day("2026-08-10", false)]);
  });

  it("bridges a streak gap when fed into computeStreakStatus", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", false), day("2026-08-10", true)];
    const effective = applyStreakFreezes(results, ["2026-08-09"]);
    expect(computeStreakStatus(effective, "2026-08-10").currentStreak).toBe(3);
  });
});

describe("countStreakFreezesUsedInWindow", () => {
  it("counts freeze days within the trailing window, inclusive of asOfDayKey", () => {
    expect(countStreakFreezesUsedInWindow(["2026-08-10"], "2026-08-10")).toBe(1);
  });

  it("excludes a freeze day older than the window", () => {
    const oldDayKey = "2026-07-01"; // more than 30 days before 2026-08-10
    expect(countStreakFreezesUsedInWindow([oldDayKey], "2026-08-10")).toBe(0);
  });

  it("excludes a freeze day after asOfDayKey", () => {
    expect(countStreakFreezesUsedInWindow(["2026-08-11"], "2026-08-10")).toBe(0);
  });

  it("supports a custom window size", () => {
    expect(countStreakFreezesUsedInWindow(["2026-08-05"], "2026-08-10", 3)).toBe(0);
    expect(countStreakFreezesUsedInWindow(["2026-08-08"], "2026-08-10", 3)).toBe(1);
  });

  it("returns zero for no used freezes", () => {
    expect(countStreakFreezesUsedInWindow([], "2026-08-10")).toBe(0);
  });
});

describe("getAvailableStreakFreezes", () => {
  it("returns the full allowance when nothing has been used", () => {
    expect(getAvailableStreakFreezes([], "2026-08-10")).toBe(MAX_STREAK_FREEZES_PER_WINDOW);
  });

  it("subtracts freezes used within the window", () => {
    expect(getAvailableStreakFreezes(["2026-08-10"], "2026-08-10")).toBe(MAX_STREAK_FREEZES_PER_WINDOW - 1);
  });

  it("never goes negative even if more freezes were somehow used than the cap", () => {
    expect(getAvailableStreakFreezes(["2026-08-08", "2026-08-09", "2026-08-10"], "2026-08-10", 2)).toBe(0);
  });

  it("replenishes once a used freeze ages out of the window", () => {
    expect(getAvailableStreakFreezes(["2026-07-01"], "2026-08-10")).toBe(MAX_STREAK_FREEZES_PER_WINDOW);
  });
});

describe("canApplyStreakFreeze", () => {
  const results = [day("2026-08-08", true), day("2026-08-09", false)];

  it("allows freezing a past, incomplete, not-already-frozen day when freezes are available", () => {
    expect(canApplyStreakFreeze(results, [], "2026-08-09", "2026-08-10")).toBeNull();
  });

  it("denies freezing a future day", () => {
    expect(canApplyStreakFreeze(results, [], "2026-08-11", "2026-08-10")).toBe("future-day");
  });

  it("denies freezing a day that was already completed", () => {
    expect(canApplyStreakFreeze(results, [], "2026-08-08", "2026-08-10")).toBe("already-complete");
  });

  it("denies re-freezing an already-frozen day", () => {
    expect(canApplyStreakFreeze(results, ["2026-08-09"], "2026-08-09", "2026-08-10")).toBe("already-frozen");
  });

  it("denies freezing once the allowance is exhausted", () => {
    const usedUp = Array.from({ length: MAX_STREAK_FREEZES_PER_WINDOW }, (_, i) => `2026-08-0${i + 1}`);
    expect(canApplyStreakFreeze(results, usedUp, "2026-08-09", "2026-08-10")).toBe("no-freezes-available");
  });

  it("supports custom maxFreezes/windowDays", () => {
    expect(canApplyStreakFreeze(results, ["2026-08-01"], "2026-08-09", "2026-08-10", 1)).toBe(
      "no-freezes-available",
    );
  });
});

describe("findFreezableStreakGapDayKey", () => {
  it("finds yesterday when it broke a streak that was active the day before", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", false)];
    expect(findFreezableStreakGapDayKey(results, [], "2026-08-10")).toBe("2026-08-09");
  });

  it("returns null when there's no gap — asOfDayKey's own streak is unbroken", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", true)];
    expect(findFreezableStreakGapDayKey(results, [], "2026-08-10")).toBeNull();
  });

  it("returns null when yesterday is already frozen", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", false)];
    expect(findFreezableStreakGapDayKey(results, ["2026-08-09"], "2026-08-10")).toBeNull();
  });

  it("returns null when there was no streak in progress before the gap", () => {
    const results = [day("2026-08-09", false)];
    expect(findFreezableStreakGapDayKey(results, [], "2026-08-10")).toBeNull();
  });

  it("returns null for a completely empty history", () => {
    expect(findFreezableStreakGapDayKey([], [], "2026-08-10")).toBeNull();
  });
});

describe("buildStreakFreezeAvailabilityText", () => {
  it("reports the count and rolling window when freezes remain", () => {
    expect(buildStreakFreezeAvailabilityText(2)).toBe(
      `2 streak freezes available (resets over a rolling ${STREAK_FREEZE_WINDOW_DAYS}-day window).`,
    );
  });

  it("uses singular wording for exactly one freeze remaining", () => {
    expect(buildStreakFreezeAvailabilityText(1)).toBe(
      `1 streak freeze available (resets over a rolling ${STREAK_FREEZE_WINDOW_DAYS}-day window).`,
    );
  });

  it("reports none left when the allowance is exhausted", () => {
    expect(buildStreakFreezeAvailabilityText(0)).toBe(
      `No streak freezes left in the last ${STREAK_FREEZE_WINDOW_DAYS} days.`,
    );
  });
});

describe("getStreakLapseRiskLength", () => {
  it("returns the in-progress streak length when yesterday extended it and today isn't done yet", () => {
    const results = [day("2026-08-08", true), day("2026-08-09", true)];
    expect(getStreakLapseRiskLength(results, "2026-08-10")).toBe(2);
  });

  it("returns null when today's mission is already complete — nothing at risk", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", true)];
    expect(getStreakLapseRiskLength(results, "2026-08-10")).toBeNull();
  });

  it("returns null when there was no streak in progress coming into today", () => {
    const results = [day("2026-08-09", false)];
    expect(getStreakLapseRiskLength(results, "2026-08-10")).toBeNull();
  });

  it("returns null for a completely empty history", () => {
    expect(getStreakLapseRiskLength([], "2026-08-10")).toBeNull();
  });

  it("returns null once a streak has already fully lapsed (yesterday itself was missed)", () => {
    const results = [day("2026-08-07", true), day("2026-08-08", true), day("2026-08-09", false)];
    expect(getStreakLapseRiskLength(results, "2026-08-10")).toBeNull();
  });

  it("reflects an explicit today record marked incomplete the same as no record at all", () => {
    const results = [day("2026-08-09", true), day("2026-08-10", false)];
    expect(getStreakLapseRiskLength(results, "2026-08-10")).toBe(1);
  });
});

describe("buildStreakLapseReminderText", () => {
  it("renders the streak length in the warning", () => {
    expect(buildStreakLapseReminderText(5)).toBe(
      "⏰ Your 5-day streak will end today unless you complete today's quests!",
    );
  });
});
