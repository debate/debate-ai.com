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

/** One point in a contributor's history where their streak first reached a milestone. */
export interface StreakMilestoneEvent {
  dayKey: string;
  streakLength: number;
  badge: string;
}

/**
 * Finds every day in a contributor's mission-result history where their
 * streak-as-of-that-day exactly reached a milestone's `streakLength` — the
 * one day a badge is freshly earned, since a streak that keeps extending
 * moves past that exact length the very next day (mirrors
 * `buildStreakRewardText`'s "freshBadge" check, generalized across a whole
 * history instead of just today's streak). Purely derived from the history
 * itself, so replaying the same results always reports the same milestone
 * days — no separate "announced" store is needed to avoid re-reporting a
 * badge on a later day.
 */
export function deriveEarnedStreakMilestoneEvents(
  results: DailyMissionResult[],
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): StreakMilestoneEvent[] {
  const completedDayKeys = [...new Set(results.filter((result) => result.isComplete).map((result) => result.dayKey))].sort();

  const events: StreakMilestoneEvent[] = [];
  for (const dayKey of completedDayKeys) {
    const { currentStreak } = computeStreakStatus(results, dayKey);
    const badge = milestones.find((milestone) => milestone.streakLength === currentStreak)?.badge;
    if (badge) events.push({ dayKey, streakLength: currentStreak, badge });
  }
  return events;
}

/** Renders a short third-person announcement for a freshly earned streak milestone, for a feed item. */
export function buildStreakMilestoneAnnouncementText(contributorId: string, event: StreakMilestoneEvent): string {
  return `${contributorId} reached a ${event.streakLength}-day streak and earned "${event.badge}"!`;
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

/**
 * Applies a set of "streak freeze" (grace-day) dayKeys to a contributor's
 * mission-result history, marking each frozen day complete — upserting a
 * fresh `{ dayKey, isComplete: true }` record when the day has no result at
 * all (e.g. a day a contributor never even opened the app). Every other
 * streak/badge function in this module (`computeStreakStatus`,
 * `getEarnedStreakBadges`, `buildContributorQuestStreak`,
 * `deriveEarnedStreakMilestoneEvents`) already treats "complete" days as
 * streak-continuing, so a frozen day bridges a gap in the streak the exact
 * same way a real completed mission would, without needing any changes to
 * those functions — callers just run the raw history through this first.
 * Does not mutate the input array.
 */
export function applyStreakFreezes(
  results: DailyMissionResult[],
  frozenDayKeys: string[] | Set<string>,
): DailyMissionResult[] {
  const frozenSet = frozenDayKeys instanceof Set ? frozenDayKeys : new Set(frozenDayKeys);
  if (frozenSet.size === 0) return results;

  const byDayKey = new Map(results.map((result) => [result.dayKey, result]));
  for (const dayKey of frozenSet) {
    byDayKey.set(dayKey, { dayKey, isComplete: true });
  }
  return Array.from(byDayKey.values());
}

/** How many trailing days a contributor's streak-freeze allowance replenishes over. */
export const STREAK_FREEZE_WINDOW_DAYS = 30;

/** How many streak freezes a contributor may use within any `STREAK_FREEZE_WINDOW_DAYS`-day trailing window. */
export const MAX_STREAK_FREEZES_PER_WINDOW = 2;

/**
 * Counts how many of a contributor's already-used freeze days fall within
 * the trailing `windowDays`-day window ending at (and including) `asOfDayKey`
 * — the usage that counts against their rolling allowance. A freeze used
 * further in the past ages out and no longer counts, so the allowance
 * replenishes over time rather than being a lifetime cap.
 */
export function countStreakFreezesUsedInWindow(
  usedFreezeDayKeys: string[],
  asOfDayKey: string,
  windowDays: number = STREAK_FREEZE_WINDOW_DAYS,
): number {
  const windowStart = new Date(`${asOfDayKey}T00:00:00.000Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - (windowDays - 1));
  const windowStartDayKey = windowStart.toISOString().slice(0, 10);

  return usedFreezeDayKeys.filter((dayKey) => dayKey >= windowStartDayKey && dayKey <= asOfDayKey).length;
}

/**
 * How many streak freezes a contributor has left to spend, as of
 * `asOfDayKey` — the allowance minus whatever they've already used within
 * the trailing window. Never negative.
 */
export function getAvailableStreakFreezes(
  usedFreezeDayKeys: string[],
  asOfDayKey: string,
  maxFreezes: number = MAX_STREAK_FREEZES_PER_WINDOW,
  windowDays: number = STREAK_FREEZE_WINDOW_DAYS,
): number {
  return Math.max(0, maxFreezes - countStreakFreezesUsedInWindow(usedFreezeDayKeys, asOfDayKey, windowDays));
}

/** Why a streak freeze can't be applied to a given day, or `null` if it's allowed. */
export type StreakFreezeDenialReason = "future-day" | "already-complete" | "already-frozen" | "no-freezes-available";

/**
 * Validates whether a contributor may spend a streak freeze on `dayKey`:
 * the day can't be in the future, can't already be a completed mission day
 * (freezing it would be pointless), can't already be frozen, and the
 * contributor must have at least one freeze left in their rolling
 * allowance. Returns the specific denial reason rather than a bare boolean
 * so a caller can render an actionable message.
 */
export function canApplyStreakFreeze(
  results: DailyMissionResult[],
  usedFreezeDayKeys: string[],
  dayKey: string,
  asOfDayKey: string,
  maxFreezes: number = MAX_STREAK_FREEZES_PER_WINDOW,
  windowDays: number = STREAK_FREEZE_WINDOW_DAYS,
): StreakFreezeDenialReason | null {
  if (dayKey > asOfDayKey) return "future-day";
  if (usedFreezeDayKeys.includes(dayKey)) return "already-frozen";
  if (results.some((result) => result.dayKey === dayKey && result.isComplete)) return "already-complete";
  if (getAvailableStreakFreezes(usedFreezeDayKeys, asOfDayKey, maxFreezes, windowDays) <= 0) {
    return "no-freezes-available";
  }
  return null;
}

/**
 * Finds the single most recent missed day that broke a contributor's
 * in-progress streak — the day right before `asOfDayKey` that wasn't
 * completed (and isn't already frozen), where the day before *that* was a
 * completed (or frozen) streak day. Returns `null` when there's no such gap
 * to bridge: either `asOfDayKey` is itself unbroken, the prior day was
 * already completed/frozen, or there was no streak in progress before the
 * gap (freezing an isolated miss with nothing to reconnect isn't useful).
 * Only ever looks at the single day immediately before `asOfDayKey` — a
 * multi-day gap needs a freeze per missed day, applied one at a time as
 * each becomes the most recent gap.
 */
export function findFreezableStreakGapDayKey(
  results: DailyMissionResult[],
  frozenDayKeys: string[] | Set<string>,
  asOfDayKey: string,
): string | null {
  const effectiveResults = applyStreakFreezes(results, frozenDayKeys);
  const completedDayKeys = new Set(effectiveResults.filter((result) => result.isComplete).map((result) => result.dayKey));

  const gapDayKey = previousUtcDayKey(asOfDayKey);
  if (completedDayKeys.has(gapDayKey)) return null;

  const dayBeforeGap = previousUtcDayKey(gapDayKey);
  return completedDayKeys.has(dayBeforeGap) ? gapDayKey : null;
}

/**
 * Renders a short human-readable line for a contributor's freeze
 * allowance, meant to sit next to the "Use a grace day" action.
 */
export function buildStreakFreezeAvailabilityText(
  availableFreezes: number,
  windowDays: number = STREAK_FREEZE_WINDOW_DAYS,
): string {
  if (availableFreezes <= 0) return `No streak freezes left in the last ${windowDays} days.`;
  const noun = availableFreezes === 1 ? "streak freeze" : "streak freezes";
  return `${availableFreezes} ${noun} available (resets over a rolling ${windowDays}-day window).`;
}

/**
 * Renders a short "reward" line for a contributor's streak status, meant to
 * sit next to today's quest board itself (the "(c) a streak/reward layer"
 * follow-up under the "🎯 Daily Quests and Targets" bullet in TODO.md)
 * rather than the separate Quest Streaks roster. Calls out a badge freshly
 * earned today — one whose `streakLength` exactly matches the current
 * streak — instead of restating every badge already earned on prior days.
 */
export function buildStreakRewardText(
  status: ContributorQuestStreak,
  missionCompleteToday: boolean,
  milestones: StreakMilestone[] = DEFAULT_STREAK_MILESTONES,
): string {
  if (!missionCompleteToday) {
    return status.streak.currentStreak > 0
      ? `🔥 ${status.streak.currentStreak}-day streak — complete today's quests to keep it going.`
      : "Complete today's quests to start a streak.";
  }

  const freshBadge = milestones.find((milestone) => milestone.streakLength === status.streak.currentStreak)?.badge;
  return freshBadge
    ? `🎉 Mission complete! ${status.streak.currentStreak}-day streak — you just earned "${freshBadge}"!`
    : `🎉 Mission complete! ${status.streak.currentStreak}-day streak.`;
}
