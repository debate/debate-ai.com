/**
 * @fileoverview Pure daily-winner selection for the "Daily Best Card
 * Challenge" idea under Research Crowdsourcing Organizer Features in
 * TODO.md ("Highlight the highest-scoring card of the day and let the
 * community vote on it"). Builds directly on the idea #11
 * helpfulness-scoring slice in `community-rating.ts` — a card's community
 * "vote" is its existing likes/saves signal, so this slice only adds a
 * submission timestamp, groups card contributions by their UTC calendar
 * day, and picks each day's single highest-helpfulness card. This is the
 * first slice only — it works entirely off already-collected, caller-
 * supplied contributions; it doesn't track submission timestamps itself,
 * persist a day's winner, or render a challenge banner/widget UI. See the
 * follow-ups noted in TODO.md.
 *
 * @module lib/daily-best-card
 */

import {
  DEFAULT_HELPFULNESS_WEIGHTS,
  computeHelpfulnessBreakdown,
  type CommunityContribution,
  type HelpfulnessBreakdown,
  type HelpfulnessWeights,
} from "./community-rating";

/** A card contribution stamped with when it was submitted. */
export interface TimestampedCardContribution extends CommunityContribution {
  kind: "card";
  /** Submission time, as epoch milliseconds (UTC). */
  submittedAt: number;
}

/** One day's winning card and its scored breakdown. */
export interface DailyBestCard {
  /** UTC calendar day, formatted "YYYY-MM-DD". */
  dayKey: string;
  contribution: TimestampedCardContribution;
  breakdown: HelpfulnessBreakdown;
}

/** Formats an epoch-ms timestamp as its UTC calendar day key, "YYYY-MM-DD". */
export function getUtcDayKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

/**
 * Groups card contributions by their UTC submission day, preserving each
 * day's original relative order.
 */
export function groupCardsByDay(
  contributions: TimestampedCardContribution[],
): Map<string, TimestampedCardContribution[]> {
  const byDay = new Map<string, TimestampedCardContribution[]>();
  for (const contribution of contributions) {
    const dayKey = getUtcDayKey(contribution.submittedAt);
    const group = byDay.get(dayKey);
    if (group) {
      group.push(contribution);
    } else {
      byDay.set(dayKey, [contribution]);
    }
  }
  return byDay;
}

/**
 * Picks the single highest-helpfulness card from one day's contributions,
 * tie-broken by `id` for a stable, deterministic winner. Throws if
 * `contributions` is empty — callers should skip days with no submitted
 * cards rather than producing a winner-less entry.
 */
export function pickBestCardOfDay(
  dayKey: string,
  contributions: TimestampedCardContribution[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): DailyBestCard {
  if (contributions.length === 0) {
    throw new Error(`pickBestCardOfDay: day "${dayKey}" has no contributions`);
  }

  let best = contributions[0];
  let bestBreakdown = computeHelpfulnessBreakdown(best, weights);

  for (const contribution of contributions.slice(1)) {
    const breakdown = computeHelpfulnessBreakdown(contribution, weights);
    const isBetter =
      breakdown.helpfulnessScore > bestBreakdown.helpfulnessScore ||
      (breakdown.helpfulnessScore === bestBreakdown.helpfulnessScore &&
        contribution.id.localeCompare(best.id) < 0);
    if (isBetter) {
      best = contribution;
      bestBreakdown = breakdown;
    }
  }

  return { dayKey, contribution: best, breakdown: bestBreakdown };
}

/**
 * Builds the daily-best-card challenge result for every day represented in
 * `contributions`: groups cards by UTC submission day and picks each day's
 * single highest-helpfulness card. Returned sorted by `dayKey` ascending.
 */
export function buildDailyBestCards(
  contributions: TimestampedCardContribution[],
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): DailyBestCard[] {
  const byDay = groupCardsByDay(contributions);
  return Array.from(byDay.entries())
    .map(([dayKey, group]) => pickBestCardOfDay(dayKey, group, weights))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/**
 * Convenience wrapper around `buildDailyBestCards` for a single day: the
 * winning card among contributions submitted on the UTC calendar day of
 * `now`, or `null` if none were submitted that day. `now` is caller-supplied
 * (epoch ms) rather than read from the clock, keeping this pure and testable.
 */
export function getBestCardForDay(
  contributions: TimestampedCardContribution[],
  now: number,
  weights: HelpfulnessWeights = DEFAULT_HELPFULNESS_WEIGHTS,
): DailyBestCard | null {
  const todayKey = getUtcDayKey(now);
  const todaysCards = contributions.filter((contribution) => getUtcDayKey(contribution.submittedAt) === todayKey);
  return todaysCards.length === 0 ? null : pickBestCardOfDay(todayKey, todaysCards, weights);
}

/** Renders a short highlight line for a daily-best-card banner/widget. */
export function buildDailyBestCardHighlight(best: DailyBestCard): string {
  return `Card of the day (${best.dayKey}): "${best.contribution.id}" — helpfulness ${best.breakdown.helpfulnessScore}/100`;
}

/** One ISO week's daily winners plus that week's single best-of-the-week champion. */
export interface WeeklyBestCardRollup {
  /** ISO 8601 week key, formatted "YYYY-Www" (e.g. "2026-W36"). */
  weekKey: string;
  /** That week's daily winners, sorted by `dayKey` ascending. */
  days: DailyBestCard[];
  /** The single highest-helpfulness daily winner among `days`. */
  champion: DailyBestCard;
}

/**
 * Formats a "YYYY-MM-DD" day key as its ISO 8601 week key, "YYYY-Www" — the
 * Monday-starting week containing that day, numbered so week 1 is the week
 * containing the year's first Thursday (the standard ISO week-numbering
 * rule). Weeks are UTC throughout, matching `getUtcDayKey`.
 */
export function getUtcWeekKey(dayKey: string): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  // Shift to the Thursday of this ISO week: Monday=0 .. Sunday=6, then +3 days lands on Thursday.
  const dayNr = (date.getUTCDay() + 6) % 7;
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() - dayNr + 3);

  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNr + 3);

  const weekNumber = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Groups already-picked daily winners by ISO week, preserving each week's
 * original relative order (callers typically pass a `dayKey`-ascending list,
 * so groups come out day-ascending too).
 */
export function groupDailyBestCardsByWeek(dailyBests: DailyBestCard[]): Map<string, DailyBestCard[]> {
  const byWeek = new Map<string, DailyBestCard[]>();
  for (const daily of dailyBests) {
    const weekKey = getUtcWeekKey(daily.dayKey);
    const group = byWeek.get(weekKey);
    if (group) {
      group.push(daily);
    } else {
      byWeek.set(weekKey, [daily]);
    }
  }
  return byWeek;
}

/**
 * Picks the single highest-helpfulness daily winner from one week's daily
 * winners, tie-broken by `dayKey` ascending (the earlier day wins) for a
 * stable, deterministic champion. Throws if `days` is empty — callers should
 * skip weeks with no represented days rather than producing a champion-less
 * entry.
 */
export function pickBestCardOfWeek(weekKey: string, days: DailyBestCard[]): DailyBestCard {
  if (days.length === 0) {
    throw new Error(`pickBestCardOfWeek: week "${weekKey}" has no daily winners`);
  }

  let champion = days[0];
  for (const daily of days.slice(1)) {
    const isBetter =
      daily.breakdown.helpfulnessScore > champion.breakdown.helpfulnessScore ||
      (daily.breakdown.helpfulnessScore === champion.breakdown.helpfulnessScore &&
        daily.dayKey.localeCompare(champion.dayKey) < 0);
    if (isBetter) {
      champion = daily;
    }
  }

  return champion;
}

/**
 * Rolls up daily winners into one entry per represented ISO week — every
 * week's daily winners plus that week's single best-of-the-week champion.
 * Returned sorted by `weekKey` ascending; within each rollup, `days` is
 * sorted by `dayKey` ascending regardless of input order.
 */
export function buildWeeklyBestCardRollups(dailyBests: DailyBestCard[]): WeeklyBestCardRollup[] {
  const byWeek = groupDailyBestCardsByWeek(dailyBests);
  return Array.from(byWeek.entries())
    .map(([weekKey, days]) => {
      const sortedDays = [...days].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
      return { weekKey, days: sortedDays, champion: pickBestCardOfWeek(weekKey, sortedDays) };
    })
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

/** Renders a short highlight line for a best-of-the-week rollup. */
export function buildWeeklyBestCardRollupHighlight(rollup: WeeklyBestCardRollup): string {
  const dayLabel = rollup.days.length === 1 ? "1 day" : `${rollup.days.length} days`;
  return `Best of the week (${rollup.weekKey}): "${rollup.champion.contribution.id}" — helpfulness ${rollup.champion.breakdown.helpfulnessScore}/100 (${dayLabel})`;
}

/** Formats an epoch-ms timestamp as its UTC calendar month key, "YYYY-MM". */
export function getUtcMonthKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 7);
}

/**
 * Shifts a "YYYY-MM" month key by `deltaMonths` (negative for earlier
 * months), wrapping across year boundaries. Used to drive a calendar view's
 * previous/next month navigation.
 */
export function shiftUtcMonthKey(monthKey: string, deltaMonths: number): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const shifted = new Date(Date.UTC(year, monthIndex + deltaMonths, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** One day cell in a daily-best-card calendar month grid. */
export interface DailyBestCardCalendarCell<T extends DailyBestCard = DailyBestCard> {
  /** UTC calendar day, "YYYY-MM-DD". */
  dayKey: string;
  /** False for padding cells from the adjacent month filling out a full week row. */
  inMonth: boolean;
  /** That day's winner, or `null` if none is recorded for it. */
  winner: T | null;
}

/** A calendar month grid of daily-best-card winners, Monday-first, in full week rows. */
export interface DailyBestCardCalendarMonth<T extends DailyBestCard = DailyBestCard> {
  /** The requested "YYYY-MM" month. */
  monthKey: string;
  /** Full (7-cell) week rows spanning the month, padded with adjacent-month days as needed. */
  weeks: DailyBestCardCalendarCell<T>[][];
}

/**
 * Builds a Monday-first calendar month grid for `monthKey` ("YYYY-MM"),
 * attaching each represented day's winner from `dailyBests` by its `dayKey`.
 * The first and last week rows are padded with adjacent-month days
 * (`inMonth: false`, always winner-less even if `dailyBests` happens to
 * contain one for that padding day) so every row has exactly 7 cells.
 */
export function buildDailyBestCardCalendarMonth<T extends DailyBestCard>(
  monthKey: string,
  dailyBests: T[],
): DailyBestCardCalendarMonth<T> {
  const byDay = new Map(dailyBests.map((daily) => [daily.dayKey, daily] as const));

  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // Monday=0 .. Sunday=6
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstWeekday);

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const cells: DailyBestCardCalendarCell<T>[] = [];
  for (let offset = 0; offset < totalCells; offset++) {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + offset);
    const dayKey = date.toISOString().slice(0, 10);
    const inMonth = date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
    cells.push({ dayKey, inMonth, winner: inMonth ? (byDay.get(dayKey) ?? null) : null });
  }

  const weeks: DailyBestCardCalendarCell<T>[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { monthKey, weeks };
}
