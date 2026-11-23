/**
 * @fileoverview The 700 philosophical resolutions shown in their own section
 * of the Topics & Statistics page (`/practice/statistics`). Each states a
 * value question both sides can defend ("Society should go nuclear.", "God
 * exists.") and carries one Pro and one Con starting point.
 *
 * Ids use `Prefix.Number` (Nuke.1, Dem.1, Edu.1); numbering restarts in each
 * of the 28 categories. `source` keeps the row's number in the original
 * 700-motion list, matching the hidden "Source topic" comments in the help
 * page `features/topics/value-topics.mdx`, which prints the same rows.
 *
 * The rows live in `src/data/value-resolutions.json`; this module types them
 * and owns the pure search / grouping helpers the explorer uses, so they can
 * be tested without rendering.
 *
 * @module lib/value-resolutions/value-resolutions
 */

import rows from "../../data/value-resolutions.json"

/** One philosophical resolution. */
export interface ValueResolution {
  /** `Prefix.Number`, e.g. "Nuke.1". Unique. */
  id: string
  /** The row's 1-based number in the original 700-motion list. */
  source: number
  /** Philosophical category, e.g. "Nuclear Ethics, Energy, and Security". */
  category: string
  /** Short heading, e.g. "Go nuclear". */
  title: string
  /** The resolution, without the "Resolved:" prefix. */
  resolution: string
  /** The affirmative starting point. */
  pro: string
  /** The negative starting point. */
  con: string
}

/** Every resolution, grouped by category in the help page's order. */
export const VALUE_RESOLUTIONS: readonly ValueResolution[] = rows as ValueResolution[]

/** Categories in the order they first appear. */
export const VALUE_CATEGORIES: readonly string[] = Array.from(new Set(VALUE_RESOLUTIONS.map((r) => r.category)))

/** A resolution's id prefix ("Nuke" for "Nuke.1"). */
export function resolutionPrefix(resolution: Pick<ValueResolution, "id">): string {
  return resolution.id.split(".")[0]
}

/** Lower-cased, whitespace-collapsed text used for matching. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Filters resolutions by category (`"all"` for every one) and a free-text
 * query. The query is split into words and every word must appear somewhere in
 * the id, title, resolution, category or Pro / Con text, so "tax wealth" finds
 * "Society should introduce a wealth tax." and "nuke.3" finds Nuke.3.
 */
export function searchValueResolutions(
  query: string,
  category: string = "all",
  resolutions: readonly ValueResolution[] = VALUE_RESOLUTIONS,
): ValueResolution[] {
  const words = normalize(query).split(" ").filter(Boolean)
  return resolutions.filter((r) => {
    if (category !== "all" && r.category !== category) return false
    if (words.length === 0) return true
    const haystack = normalize([r.id, r.title, r.resolution, r.category, r.pro, r.con].join(" "))
    return words.every((w) => haystack.includes(w))
  })
}

/** Groups resolutions by category, keeping first-seen order. */
export function groupValueResolutions(
  resolutions: readonly ValueResolution[],
): { category: string; resolutions: ValueResolution[] }[] {
  const groups = new Map<string, ValueResolution[]>()
  for (const r of resolutions) {
    const list = groups.get(r.category)
    if (list) list.push(r)
    else groups.set(r.category, [r])
  }
  return Array.from(groups, ([category, list]) => ({ category, resolutions: list }))
}

/** Resolution count per category. */
export function countValueResolutions(
  resolutions: readonly ValueResolution[] = VALUE_RESOLUTIONS,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of resolutions) counts[r.category] = (counts[r.category] ?? 0) + 1
  return counts
}
