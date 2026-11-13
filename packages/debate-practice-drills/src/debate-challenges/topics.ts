/**
 * @fileoverview The resolutions a challenge can be debated on: every topic in
 * `debate-topics.json` for the formats it covers (Policy, College Policy, LD,
 * PF), newest season first. Parliamentary and Worlds have no fixed topics, so
 * a challenger writes their own motion — which any format also allows.
 *
 * `debate-topics.json` keys a season by the year it ends, so the 2027 entry
 * is the "2026-27" season.
 *
 * @module debate-practice-rounds/debate-challenges/topics
 */

import topicsData from "@debate-ai/rankings/data/debate-topics.json";
import type { DebateTopicYear } from "@debate-ai/rankings/src/topics/debate-topics";
import type { ChallengeFormat } from "./types";

/** One resolution the picker offers. */
export interface ChallengeTopicOption {
  /** Stable key for the picker, `<format>-<year>-<index>`. */
  key: string;
  format: ChallengeFormat;
  /** The season label, "2026-27". */
  season: string;
  /** Short name, e.g. "Hyperscale Data Centers". */
  name: string;
  emoji?: string;
  /** Month a seasonal topic started. */
  month?: string;
  /** The full resolution — what the challenge stores. */
  text: string;
}

/** "2026-27" for the season ending in 2027. */
export function seasonLabel(endYear: number): string {
  return `${endYear - 1}-${String(endYear % 100).padStart(2, "0")}`;
}

/** The topics one year of `debate-topics.json` has for `format`. */
export function topicsForYear(entry: DebateTopicYear, format: ChallengeFormat): ChallengeTopicOption[] {
  const year = Number(entry.year);
  if (!Number.isFinite(year)) return [];
  const season = seasonLabel(year);
  const named = (name: string | undefined, emoji: string | undefined, text: string | undefined, fallback: string) =>
    text ? [{ key: `${format}-${year}-0`, format, season, name: name?.trim() || fallback, emoji: emoji || undefined, text }] : [];
  if (format === "policy") return named(entry.policy_topic_name, entry.policy_topic_emoji, entry.policy_topic, "Policy topic");
  if (format === "ndt") return named(entry.ndt_topic_name, entry.ndt_topic_emoji, entry.ndt_topic, "NDT topic");
  if (format === "ld" || format === "pf") {
    const list = format === "ld" ? entry.ld_topics : entry.pf_topics;
    if (!Array.isArray(list)) return [];
    return list
      .filter((topic) => typeof topic?.topic === "string" && topic.topic.trim())
      .map((topic, index) => ({
        key: `${format}-${year}-${index}`,
        format,
        season,
        name: topic.topic_name?.trim() || `${format.toUpperCase()} topic ${index + 1}`,
        emoji: topic.emoji || undefined,
        month: topic.start_month?.trim() || undefined,
        text: topic.topic,
      }));
  }
  return [];
}

/** Every topic `format` has in `years`, newest season first. */
export function buildChallengeTopics(years: readonly DebateTopicYear[], format: ChallengeFormat): ChallengeTopicOption[] {
  return [...years].sort((a, b) => Number(b.year) - Number(a.year)).flatMap((entry) => topicsForYear(entry, format));
}

const YEARS = (topicsData as { data: DebateTopicYear[] }).data;

/** Every topic the site lists for `format`, newest season first (empty for Parli and Worlds). */
export function challengeTopicsFor(format: ChallengeFormat): ChallengeTopicOption[] {
  return buildChallengeTopics(YEARS, format);
}

/** How the picker labels a topic: "2026-27 · Sep · 💾 Hyperscale Data Centers". */
export function challengeTopicLabel(option: ChallengeTopicOption): string {
  const month = option.month ? ` · ${option.month.slice(0, 3)}` : "";
  const emoji = option.emoji ? `${option.emoji} ` : "";
  return `${option.season}${month} · ${emoji}${option.name}`;
}
