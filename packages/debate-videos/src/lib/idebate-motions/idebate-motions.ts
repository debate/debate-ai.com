/**
 * @fileoverview The iDebate motions shown in their own section of the Topics &
 * Statistics page (`/practice/statistics`): 700 "This House…"-style motions
 * from the iDebate debatabase, each with its theme, its source page (when
 * there is one) and two short pro arguments.
 *
 * The rows live in `src/data/idebate-motions.json`; this module types them and
 * owns the pure search / grouping helpers the explorer uses, so they can be
 * tested without rendering.
 *
 * @module lib/idebate-motions/idebate-motions
 */

import rows from "../../data/idebate-motions.json"

/** One iDebate motion. */
export interface IdebateMotion {
  /** Stable 1-based id from the source list. */
  id: number
  /** Broad theme, e.g. "Education" or "Economy". */
  theme: string
  /** The motion, phrased "Society should…". */
  topic: string
  /** The motion's idebate.net debatabase page, when the source had one. */
  url?: string
  /** Short pro arguments, in source order (usually two). */
  pro: string[]
}

/** Every motion, in source order. */
export const IDEBATE_MOTIONS: readonly IdebateMotion[] = rows as IdebateMotion[]

/** Themes in the order they first appear in the source list. */
export const IDEBATE_THEMES: readonly string[] = Array.from(new Set(IDEBATE_MOTIONS.map((m) => m.theme)))

/** Lower-cased, whitespace-collapsed text used for matching. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Filters motions by theme (`"all"` for every theme) and a free-text query.
 * The query is split into words and every word must appear somewhere in the
 * motion's topic, theme or pro arguments, so "tax wealth" finds "Society
 * should introduce a wealth tax".
 */
export function searchIdebateMotions(
  query: string,
  theme: string = "all",
  motions: readonly IdebateMotion[] = IDEBATE_MOTIONS,
): IdebateMotion[] {
  const words = normalize(query).split(" ").filter(Boolean)
  return motions.filter((m) => {
    if (theme !== "all" && m.theme !== theme) return false
    if (words.length === 0) return true
    const haystack = normalize([m.topic, m.theme, ...m.pro].join(" "))
    return words.every((w) => haystack.includes(w))
  })
}

/** Groups motions by theme, keeping first-seen theme order and source order within each. */
export function groupIdebateMotionsByTheme(motions: readonly IdebateMotion[]): { theme: string; motions: IdebateMotion[] }[] {
  const groups = new Map<string, IdebateMotion[]>()
  for (const m of motions) {
    const list = groups.get(m.theme)
    if (list) list.push(m)
    else groups.set(m.theme, [m])
  }
  return Array.from(groups, ([theme, list]) => ({ theme, motions: list }))
}

/** Motion count per theme, in {@link IDEBATE_THEMES} order. */
export function countIdebateMotionsByTheme(motions: readonly IdebateMotion[] = IDEBATE_MOTIONS): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const m of motions) counts[m.theme] = (counts[m.theme] ?? 0) + 1
  return counts
}
