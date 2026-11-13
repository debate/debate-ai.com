/**
 * @fileoverview Every resolution in `debate-topics.json`, each with the topic
 * code its Topic Starter address uses (`/docs/vcx27/...`; the scheme is in
 * `./topic-doc-paths`). This is what the format / year / topic picker above the
 * Topic Starters tree lists.
 *
 * Seasonal formats (LD, PF) take their letters in the order the year lists
 * them, which is start-month order: the September LD topic of 2027 is `lda27`,
 * November's `ldb27`, and so on. The letter comes right after the format.
 *
 * Big Questions has one resolution a season, coded `bq<yy>` (`bq27`).
 *
 * The high-school policy topics from before 2000 (1927-28 through 1998-99,
 * `legacy-policy-topics.json`) and the Lincoln-Douglas topics from before 2000
 * (1979-80 through 1998-99, `legacy-ld-topics.json`) are listed after the rest
 * as the picker's "Legacy" group. They take the full year, `vcx1928` and
 * `lda1999`, so a two-digit code never means two seasons a century apart.
 *
 * @module lib/reason-docs/topic-codes
 */

import topicsData from "@debate-ai/rankings/data/debate-topics.json"
import legacyLdData from "@debate-ai/rankings/data/legacy-ld-topics.json"
import legacyPolicyData from "@debate-ai/rankings/data/legacy-policy-topics.json"
import type { DebateTopicYear, SeasonalTopic } from "@debate-ai/rankings/src/topics/debate-topics"
import { DEFAULT_TOPIC_CODE, isTopicCode, normalizeTopicCode } from "./topic-doc-paths"

/** The formats a topic code can name, in picker order. */
export const TOPIC_FORMATS = [
  { id: "vcx", label: "Policy" },
  { id: "ndt", label: "College Policy (NDT)" },
  { id: "ld", label: "Lincoln-Douglas" },
  { id: "pf", label: "Public Forum" },
  { id: "bq", label: "Big Questions" },
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
  /** A pre-2000 policy or LD topic, listed in the picker's "Legacy" group. */
  legacy?: boolean
}

/** One row of `legacy-policy-topics.json`. */
export interface LegacyPolicyTopic {
  /** The season's ending year, as in `debate-topics.json` (1928 is 1927-28). */
  year: number
  policy_topic_name: string
  policy_topic_emoji?: string
  policy_topic: string
}

/** One row of `legacy-ld-topics.json`: a season's LD topics in start-month
 *  order. */
export interface LegacyLdSeason {
  /** The season's ending year (1999 is 1998-99). */
  year: number
  ld_topics: SeasonalTopic[]
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
  if (entry.bq_topic) {
    out.push({
      code: `bq${yy}`,
      format: "bq",
      year,
      name: entry.bq_topic_name?.trim() || "Big Questions topic",
      emoji: entry.bq_topic_emoji,
      text: entry.bq_topic,
    })
  }
  for (const format of ["ld", "pf"] as const) {
    const seasonal = format === "ld" ? entry.ld_topics : entry.pf_topics
    if (!Array.isArray(seasonal)) continue
    seasonal.slice(0, LETTERS.length).forEach((topic, index) => {
      out.push({
        code: `${format}${LETTERS[index]}${yy}`,
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

/** The pre-2000 policy topics, newest first, coded `vcx<yyyy>`. */
export function buildLegacyPolicyCatalog(rows: readonly LegacyPolicyTopic[]): TopicCodeEntry[] {
  return [...rows]
    .sort((a, b) => b.year - a.year)
    .map((row) => ({
      code: `vcx${row.year}`,
      format: "vcx" as const,
      year: row.year,
      name: row.policy_topic_name.trim(),
      emoji: row.policy_topic_emoji,
      text: row.policy_topic,
      legacy: true,
    }))
    .filter((item) => isTopicCode(item.code))
}

/** The pre-2000 LD topics, newest season first, coded `ld<letter><yyyy>`
 *  with the letter in start-month order (`lda1999` is 1998-99's September). */
export function buildLegacyLdCatalog(rows: readonly LegacyLdSeason[]): TopicCodeEntry[] {
  return [...rows]
    .sort((a, b) => b.year - a.year)
    .flatMap((row) =>
      row.ld_topics.slice(0, LETTERS.length).map((topic, index) => ({
        code: `ld${LETTERS[index]}${row.year}`,
        format: "ld" as const,
        year: row.year,
        name: topic.topic_name?.trim() || `LD topic ${index + 1}`,
        emoji: topic.emoji,
        month: topic.start_month?.trim() || undefined,
        text: topic.topic,
        legacy: true,
      })),
    )
    .filter((item) => isTopicCode(item.code))
}

/** Every resolution the site knows, newest year first, the legacy policy and
 *  LD topics last. */
export const TOPIC_CATALOG: readonly TopicCodeEntry[] = [
  ...buildTopicCatalog((topicsData as { data: DebateTopicYear[] }).data),
  ...buildLegacyPolicyCatalog((legacyPolicyData as { data: LegacyPolicyTopic[] }).data),
  ...buildLegacyLdCatalog((legacyLdData as { data: LegacyLdSeason[] }).data),
]

/** A season label from its ending year: 1928 → "1927-28". */
export function seasonLabel(year: number): string {
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`
}

/** The resolution `code` names, or `undefined` for an unknown code. */
export function findTopicByCode(code: string | null | undefined): TopicCodeEntry | undefined {
  if (!code) return undefined
  const wanted = normalizeTopicCode(code)
  return TOPIC_CATALOG.find((item) => item.code === wanted)
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

/** How the picker labels one topic: "Sep · 🚀 Outer Space Colonization". A
 *  legacy topic leads with its season: "1998-99 · Sep · 🕊️ Sanctity of Life". */
export function topicOptionLabel(item: TopicCodeEntry): string {
  const season = item.legacy ? `${seasonLabel(item.year)} · ` : ""
  const month = item.month ? `${item.month.slice(0, 3)} · ` : ""
  const emoji = item.emoji ? `${item.emoji} ` : ""
  return `${season}${month}${emoji}${item.name}`
}
