/**
 * @fileoverview The pre-2000 resolutions — high-school policy from 1927-28
 * (`data/legacy-policy-topics.json`) and Lincoln-Douglas from 1979-80
 * (`data/legacy-ld-topics.json`) — as {@link DebateTopicYear} rows, so the
 * Topics & Statistics page can list them after `debate-topics.json`'s seasons.
 * The Topic Starters dropdown stops at 2015; this is where older topics live.
 * @module topics/legacy-topics
 */

import legacyLdData from "../../data/legacy-ld-topics.json";
import legacyPolicyData from "../../data/legacy-policy-topics.json";
import type { DebateTopicYear, SeasonalTopic } from "./debate-topics";

type LegacyPolicyRow = { year: number; policy_topic_name?: string; policy_topic_emoji?: string; policy_topic: string };
type LegacyLdRow = { year: number; ld_topics: SeasonalTopic[] };

/** Merges the two legacy files into one row per season, newest first. */
export function buildLegacyTopicYears(
  policy: readonly LegacyPolicyRow[],
  ld: readonly LegacyLdRow[],
): DebateTopicYear[] {
  const byYear = new Map<number, DebateTopicYear>();
  const row = (year: number) => {
    const existing = byYear.get(year);
    if (existing) return existing;
    const created: DebateTopicYear = { year };
    byYear.set(year, created);
    return created;
  };
  for (const item of policy) {
    Object.assign(row(item.year), {
      policy_topic_name: item.policy_topic_name,
      policy_topic_emoji: item.policy_topic_emoji,
      policy_topic: item.policy_topic,
    });
  }
  for (const item of ld) row(item.year).ld_topics = item.ld_topics;
  return [...byYear.values()].sort((a, b) => Number(b.year) - Number(a.year));
}

/** Every pre-2000 season with a known resolution, newest first. */
export const LEGACY_TOPIC_YEARS: readonly DebateTopicYear[] = buildLegacyTopicYears(
  (legacyPolicyData as { data: LegacyPolicyRow[] }).data,
  (legacyLdData as { data: LegacyLdRow[] }).data,
);

/** `topics` followed by the legacy seasons it doesn't already have. */
export function withLegacyTopicYears(topics: readonly DebateTopicYear[]): DebateTopicYear[] {
  const have = new Set(topics.map((entry) => String(entry.year)));
  return [...topics, ...LEGACY_TOPIC_YEARS.filter((entry) => !have.has(String(entry.year)))];
}
