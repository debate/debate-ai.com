/**
 * @fileoverview Every resolution in `debate-topics.json`, each with the topic
 * code its Topic Starter address uses (`/docs/vcx27/...`; the scheme is in
 * `./topic-doc-paths`). This is what the format / year / topic picker above the
 * Topic Starters tree lists.
 *
 * Seasonal formats (LD, PF) take their letters in the order the year lists
 * them, which is start-month order: the September LD topic of 2027 is `ld27a`,
 * November's `ld27b`, and so on.
 *
 * @module lib/reason-docs/topic-codes
 */

import topicsData from "@debate-ai/rankings-adapter/data/debate-topics.json"
import type { DebateTopicYear } from "@debate-ai/types"
import { DEFAULT_TOPIC_CODE, isTopicCode } from "./topic-doc-paths"

/** The formats a topic code can name, in picker order. */
export const TOPIC_FORMATS = [
  { id: "vcx", label: "Policy" },
  { id: "ndt", label: "College Policy (NDT)" },
  { id: "ld", label: "Lincoln-Douglas" },
  { id: "pf", label: "Public Forum" },
] as const

export type TopicFormat = (typeof TOPIC_FORMATS)[number]["id"]

/** One resolution with its code. */
export interface TopicCodeEntry {
  code: string
  format: TopicFormat
  year: number
  /** Short name, e.g. "National Health Insurance". */
  name: string
  emoji?: string
  /** The month a seasonal topic started. */
  month?: string
  /** The full resolution. */
  text: string
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz"

/** The codes one year of `debate-topics.json` contributes, in picker order. */
export function topicCodesForYear(entry: DebateTopicYear): TopicCodeEntry[] {
  const year = Number(entry.year)
  if (!Number.isFinite(year)) return []
  const yy = String(year % 100).padStart(2, "0")
  const out: TopicCodeEntry[] = []
  if (entry.policy_topic) {
    out.push({
      code: `vcx${yy}`,
      format: "vcx",
      year,
      name: entry.policy_topic_name?.trim() || "Policy topic",
      emoji: entry.policy_topic_emoji,
      text: entry.policy_topic,
    })
  }
  if (entry.ndt_topic) {
    out.push({
      code: `ndt${yy}`,
      format: "ndt",
      year,
      name: entry.ndt_topic_name?.trim() || "NDT topic",
      emoji: entry.ndt_topic_emoji,
      text: entry.ndt_topic,
    })
  }
  for (const format of ["ld", "pf"] as const) {
    const seasonal = format === "ld" ? entry.ld_topics : entry.pf_topics
    if (!Array.isArray(seasonal)) continue
    seasonal.slice(0, LETTERS.length).forEach((topic, index) => {
      out.push({
        code: `${format}${yy}${LETTERS[index]}`,
        format,
        year,
        name: topic.topic_name?.trim() || `${format.toUpperCase()} topic ${index + 1}`,
        emoji: topic.emoji,
        month: topic.start_month?.trim() || undefined,
        text: topic.topic,
      })
    })
  }
  return out.filter((item) => isTopicCode(item.code))
}

/** Builds the catalogue from `debate-topics.json`'s rows, newest year first. */
export function buildTopicCatalog(years: readonly DebateTopicYear[]): TopicCodeEntry[] {
  return [...years]
    .sort((a, b) => Number(b.year) - Number(a.year))
    .flatMap(topicCodesForYear)
}

/** Every resolution the site knows, newest year first. */
export const TOPIC_CATALOG: readonly TopicCodeEntry[] = buildTopicCatalog(
  (topicsData as { data: DebateTopicYear[] }).data,
)

/** The resolution `code` names, or `undefined` for an unknown code. */
export function findTopicByCode(code: string | null | undefined): TopicCodeEntry | undefined {
  if (!code) return undefined
  return TOPIC_CATALOG.find((item) => item.code === code)
}

/** The years a format has topics for, newest first. */
export function yearsForFormat(format: TopicFormat): number[] {
  return [...new Set(TOPIC_CATALOG.filter((item) => item.format === format).map((item) => item.year))]
}

/** All of a format's topics, newest year first. */
export function topicsForFormat(format: TopicFormat): TopicCodeEntry[] {
  return TOPIC_CATALOG.filter((item) => item.format === format)
}

/** The resolution the picker shows when the address names none (or one this
 *  data doesn't have). */
export function topicOrDefault(code: string | null | undefined): TopicCodeEntry | undefined {
  return findTopicByCode(code) ?? findTopicByCode(DEFAULT_TOPIC_CODE) ?? TOPIC_CATALOG[0]
}

/** How the picker labels one topic: "Sep · 🚀 Outer Space Colonization". */
export function topicOptionLabel(item: TopicCodeEntry): string {
  const month = item.month ? `${item.month.slice(0, 3)} · ` : ""
  const emoji = item.emoji ? `${item.emoji} ` : ""
  return `${month}${emoji}${item.name}`
}
