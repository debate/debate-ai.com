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
