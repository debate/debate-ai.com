/**
 * @fileoverview The resolutions behind the Topic Areas explorer, the middle
 * section of the Topics & Statistics page (`/practice/statistics`): every
 * NDT, Policy, LD and PF resolution since 1927-28, each filed under one of 40
 * research-domain "topic areas", plus the counting the explorer's bar chart
 * and year-by-year trend line need.
 *
 * The area assignments are heuristic research categories, not official NSDA
 * or NDT classifications — the page says so in its footer. Each resolution's
 * area is its `category` in `@debate-ai/rankings`' topic data
 * (`debate-topics.json` plus the pre-2000 `legacy-*-topics.json` files), so
 * the topics timeline and this explorer read one source. The areas and their
 * emojis and colors live in `areas.json`.
 *
 * @module lib/topic-areas/topic-areas
 */

import debateTopics from "@debate-ai/rankings/data/debate-topics.json"
import type { DebateTopicYear } from "@debate-ai/rankings/src/topics/debate-topics"
import { withLegacyTopicYears } from "@debate-ai/rankings/src/topics/legacy-topics"

import data from "./areas.json"

/** A debate format the explorer can filter to. */
export type TopicFormat = "ndt" | "policy" | "ld" | "pf"

/** The explorer's format filter: one format, or every format at once. */
export type TopicFormatFilter = TopicFormat | "all"

export interface TopicResolution {
  year: number
  format: TopicFormat
  /** Name of the {@link TopicArea} this resolution is filed under. */
  area: string
  topic: string
}

export interface TopicArea {
  name: string
  /** The area's own emoji, shown beside its name in the poll and the charts. */
  emoji: string
  /** The area's hex color, shared by its bar and its trend line. */
  color: string
}

/** One bar in the area-distribution chart. */
export interface TopicAreaCount extends TopicArea {
  count: number
}

export const TOPIC_AREAS: TopicArea[] = data.areas

/**
 * Every categorized NDT, Policy, LD and PF resolution in `topics`, oldest
 * season first. Big Questions and untitled legacy HTML strings are skipped —
 * the explorer has no panel for the former and the latter carry no category.
 */
export function topicResolutionsFrom(topics: readonly DebateTopicYear[]): TopicResolution[] {
  const out: TopicResolution[] = []
  const add = (year: number, format: TopicFormat, area: string | undefined, topic: string | undefined) => {
    if (area && topic) out.push({ year, format, area, topic })
  }
  for (const entry of topics) {
    const year = Number(entry.year)
    if (!Number.isFinite(year)) continue
    add(year, "ndt", entry.ndt_topic_category, entry.ndt_topic)
    add(year, "policy", entry.policy_topic_category, entry.policy_topic)
    for (const t of entry.ld_topics ?? []) add(year, "ld", t.category, t.topic)
    for (const t of entry.pf_topics ?? []) add(year, "pf", t.category, t.topic)
  }
  return out.sort((a, b) => a.year - b.year)
}

export const TOPIC_RESOLUTIONS: TopicResolution[] = topicResolutionsFrom(
  withLegacyTopicYears((debateTopics as { data: DebateTopicYear[] }).data),
)

/** The explorer's panels, in display order. */
export const TOPIC_FORMAT_FILTERS: { id: TopicFormatFilter; label: string }[] = [
  { id: "all", label: "All formats" },
  { id: "ndt", label: "NDT" },
  { id: "policy", label: "Policy" },
  { id: "ld", label: "Lincoln–Douglas" },
  { id: "pf", label: "Public Forum" },
]

/** Short label for a resolution's format pill. */
export const TOPIC_FORMAT_LABELS: Record<TopicFormat, string> = {
  ndt: "NDT",
  policy: "Policy",
  ld: "Lincoln–Douglas",
  pf: "Public Forum",
}

/** First and last season the trend line spans, inclusive: the oldest and
 *  newest seasons with a categorized resolution. */
export const TOPIC_FIRST_YEAR = Math.min(...TOPIC_RESOLUTIONS.map((r) => r.year))
export const TOPIC_LAST_YEAR = Math.max(...TOPIC_RESOLUTIONS.map((r) => r.year))

/** Every resolution in `format`, or all of them for `"all"`. */
export function resolutionsForFormat(format: TopicFormatFilter): TopicResolution[] {
  return format === "all" ? TOPIC_RESOLUTIONS : TOPIC_RESOLUTIONS.filter((r) => r.format === format)
}

/**
 * Areas with at least one resolution in `resolutions`, most resolutions
 * first, ties broken alphabetically.
 */
export function countByArea(resolutions: TopicResolution[]): TopicAreaCount[] {
  const counts = new Map<string, number>()
  for (const r of resolutions) counts.set(r.area, (counts.get(r.area) ?? 0) + 1)
  return TOPIC_AREAS.filter((a) => counts.has(a.name))
    .map((a) => ({ ...a, count: counts.get(a.name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** The resolutions filed under `area`, newest first, ties alphabetical. */
export function resolutionsInArea(resolutions: TopicResolution[], area: string): TopicResolution[] {
  return resolutions
    .filter((r) => r.area === area)
    .sort((a, b) => b.year - a.year || a.topic.localeCompare(b.topic))
}

/**
 * How many of `resolutions` fall in each season from {@link TOPIC_FIRST_YEAR}
 * to {@link TOPIC_LAST_YEAR} — one entry per year, zeros included, so the
 * trend line has a point for every season.
 */
export function countByYear(resolutions: TopicResolution[]): { year: number; count: number }[] {
  const years: { year: number; count: number }[] = []
  for (let year = TOPIC_FIRST_YEAR; year <= TOPIC_LAST_YEAR; year++) {
    years.push({ year, count: resolutions.filter((r) => r.year === year).length })
  }
  return years
}
