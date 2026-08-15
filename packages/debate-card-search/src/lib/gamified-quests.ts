/**
 * @fileoverview Pure streak-tracking and milestone-badge logic for the
 * "Gamified Quests" idea under Research Crowdsourcing Organizer Features in
 * TODO.md ("Turn research work into missions, challenges, and streaks that
 * reward consistent contribution"). Builds directly on the existing "Daily
 * Quests and Targets" slice in `daily-quests.ts` — treats a day's
 * `QuestProgress` board as a "mission," derives whether that mission was
 * fully completed, and turns a contributor's completed-mission days into a
 * current/longest streak plus the milestone badges that streak has earned.
 * This is the first slice only — it works entirely off caller-supplied
 * mission-completion history; it doesn't persist a contributor's streak,
 * track real calendar-day boundaries beyond the UTC day keys `daily-quests.ts`
 * already uses, or render a streak/badge UI. See the follow-ups noted in
 * TODO.md.
 *
 * @module lib/gamified-quests
 */

import type { QuestProgress } from "./daily-quests";

/** One day's outcome for a contributor's daily-quest mission. */
export interface DailyMissionResult {
  /** UTC calendar day, formatted "YYYY-MM-DD" — same convention as `daily-quests.ts`/`daily-best-card.ts`. */
  dayKey: string;
  /** Whether every quest on that day's board was completed. */
  isComplete: boolean;
}

/**
 * Derives a day's mission result directly from its `daily-quests.ts`
 * `QuestProgress` board: the mission is complete only when the board is
 * non-empty and every quest on it is complete. Reuses the board's own
 * `isComplete` flag per quest rather than introducing a separate
 * completion signal.
 */
export function computeDailyMissionResult(board: QuestProgress[], dayKey: string): DailyMissionResult {
  return {
    dayKey,
    isComplete: board.length > 0 && board.every((quest) => quest.isComplete),
  };
}

/** A contributor's current and longest daily-activity streak. */
export interface StreakStatus {
  /** Consecutive completed-mission days counting back from `asOfDayKey`; `0` if `asOfDayKey` itself wasn't complete. */
  currentStreak: number;
  /** The longest run of consecutive completed-mission days found anywhere in the supplied history. */
  longestStreak: number;
  /** The most recent completed-mission day at or before `asOfDayKey`, or `null` if none. */
  lastCompletedDayKey: string | null;
}

function previousUtcDayKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Computes a contributor's current and longest streak of completed-mission
 * days from their daily mission-result history. `currentStreak` walks
 * backward one calendar day at a time from `asOfDayKey`, stopping at the
 * first gap (or the first incomplete/missing day); `longestStreak` scans
 * the full history for the longest such run, independent of `asOfDayKey`.
 */
export function computeStreakStatus(results: DailyMissionResult[], asOfDayKey: string): StreakStatus {
  const completedDayKeys = new Set(results.filter((result) => result.isComplete).map((result) => result.dayKey));

  let currentStreak = 0;
  let cursor = asOfDayKey;
  while (completedDayKeys.has(cursor)) {
    currentStreak += 1;
    cursor = previousUtcDayKey(cursor);
  }

  const sortedCompletedDayKeys = Array.from(completedDayKeys).sort();
  let longestStreak = 0;
  let runLength = 0;
  let previousDayKey: string | null = null;
  for (const dayKey of sortedCompletedDayKeys) {
    runLength = previousDayKey !== null && previousUtcDayKey(dayKey) === previousDayKey ? runLength + 1 : 1;
    longestStreak = Math.max(longestStreak, runLength);
    previousDayKey = dayKey;
  }

  return {
    currentStreak,
    longestStreak,
    lastCompletedDayKey: sortedCompletedDayKeys.at(-1) ?? null,
  };
}

/** A streak length that earns a badge once a contributor's current streak reaches it. */
export interface StreakMilestone {
  streakLength: number;
  badge: string;
}

/** Milestones a contributor's streak progresses through, shortest to longest. */
export const DEFAULT_STREAK_MILESTONES: StreakMilestone[] = [
  { streakLength: 3, badge: "3-Day Streak" },
  { streakLength: 7, badge: "Week Warrior" },
  { streakLength: 14, badge: "Fortnight Focus" },
  { streakLength: 30, badge: "Monthly Momentum" },
];

/** Every badge a `currentStreak` length has earned, in milestone order. */
export function getEarnedStreakBadges(
  currentStreak: number,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): string[] {
  return milestones
    .filter((milestone) => currentStreak >= milestone.streakLength)
    .sort((a, b) => a.streakLength - b.streakLength)
    .map((milestone) => milestone.badge);
}

/** A contributor's full gamified-quest standing: their streak and the badges it has earned. */
export interface ContributorQuestStreak {
  contributorId: string;
  streak: StreakStatus;
  earnedBadges: string[];
}

/**
 * Builds a contributor's full streak status and earned badges from their
 * daily mission-result history.
 */
export function buildContributorQuestStreak(
  contributorId: string,
  results: DailyMissionResult[],
  asOfDayKey: string,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): ContributorQuestStreak {
  const streak = computeStreakStatus(results, asOfDayKey);
  return {
    contributorId,
    streak,
    earnedBadges: getEarnedStreakBadges(streak.currentStreak, milestones),
  };
}

/** Renders a contributor's streak status as a short human-readable line for a profile/progress view. */
export function buildStreakSummaryText(status: ContributorQuestStreak): string {
  const badgeText = status.earnedBadges.length > 0 ? `, badges: ${status.earnedBadges.join(", ")}` : "";
  return `${status.contributorId}: ${status.streak.currentStreak}-day streak (longest ${status.streak.longestStreak})${badgeText}`;
}
