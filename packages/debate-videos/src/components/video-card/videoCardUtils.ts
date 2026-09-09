/**
 * @fileoverview Utility functions and constants for video card styling and metadata
 */

import type { TopicType } from "../../types/videos";
import { DEBATE_STYLE_LABELS } from "../../types/videos";

export const STYLE_COLORS: Record<number, string> = {
  2: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  3: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  1: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export const TOURNAMENT_COLORS: Record<number, string> = {
  2: "bg-rose-900/80 border-rose-400/90 text-rose-300",
  3: "bg-purple-900/80 border-purple-400/90 text-purple-300",
  1: "bg-amber-900/80 border-amber-400/90 text-amber-300",
  4: "bg-emerald-900/80 border-emerald-400/90 text-emerald-300",
};

export function getRoundBadgeColor(roundLevel: string) {
  const round = roundLevel.toLowerCase().trim();
  if (
    round === "finals" ||
    round === "final" ||
    round === "champ" ||
    round === "1st"
  ) {
    return "border-amber-400 bg-amber-400 text-amber-950 dark:border-amber-500 dark:bg-amber-600 dark:text-amber-50 hover:bg-amber-500 dark:hover:bg-amber-500";
  }
  if (round.includes("semi")) {
    return "border-yellow-400 bg-yellow-400 text-yellow-950 dark:border-yellow-500 dark:bg-yellow-500 dark:text-yellow-50 hover:bg-yellow-500 dark:hover:bg-yellow-400";
  }
  if (round.includes("quarter")) {
    return "border-yellow-300 bg-yellow-300 text-yellow-900 dark:border-yellow-400 dark:bg-yellow-400 dark:text-yellow-950 hover:bg-yellow-400 dark:hover:bg-yellow-300";
  }
  // Round levels arrive as both "octos" and the normalized "Octafinals".
  if (round.includes("octo") || round.includes("octa")) {
    return "border-yellow-200 bg-yellow-200 text-yellow-800 dark:border-yellow-300 dark:bg-yellow-300 dark:text-yellow-900 hover:bg-yellow-300 dark:hover:bg-yellow-200";
  }
  if (round.includes("double") || round.includes("triple")) {
    return "border-yellow-100 bg-yellow-50 text-yellow-700 dark:border-yellow-200 dark:bg-yellow-100 dark:text-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-50";
  }
  return "border-amber-100 bg-amber-50/50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40";
}

export function getYearTopic(
  year: number,
  style: number | undefined,
  topics?: TopicType[],
): string | undefined {
  if (!year || !topics) return undefined;
  const topicEntry = topics.find((t) => Number(t.year) === year);
  if (!topicEntry) return undefined;
  if (style === 1) return topicEntry.policy_topic;
  if (style === 2) return topicEntry.pf_topic;
  if (style === 3) return topicEntry.ld_topic;
  if (style === 4) return topicEntry.ndt_topic;
  return undefined;
}

/**
 * Cached date formatters.
 *
 * `toLocaleDateString(locale, options)` builds a fresh `Intl.DateTimeFormat`
 * on every call, which is the expensive part. A grid renders three dates per
 * card and holds hundreds of cards once the user has paged through the
 * library, so building those formatters once is worth the indirection.
 */
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short" });

/**
 * Formats a video's publication date for a card or row.
 *
 * @param date - The raw date string from the video row.
 * @param style - `"full"` for "Mar 3, 2026", `"month"` for just "Mar".
 * @param fallback - Returned for a date that does not parse.
 * @returns The formatted date.
 */
export function formatVideoDate(
  date: string,
  style: "full" | "month" = "full",
  fallback = "",
): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return style === "month"
    ? MONTH_FORMATTER.format(parsed)
    : FULL_DATE_FORMATTER.format(parsed);
}

export { DEBATE_STYLE_LABELS };
