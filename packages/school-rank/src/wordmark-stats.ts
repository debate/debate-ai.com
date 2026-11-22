/**
 * @fileoverview How many of a division's top schools have a wordmark.
 * Colleges use the U.S. News top 100 (108 schools with ties). High schools
 * use Niche's top 100 in their category: U.S. News ranks no private schools,
 * and only part of its public top 100 is bundled.
 * @module wordmark-stats
 */

import { schoolsInDivision } from "./schools"
import type { Division, RankedSchool } from "./types"

/** Wordmark coverage for one division's top N. */
export interface WordmarkCoverage {
  division: Division
  /** The ranking that defines "top N". */
  ranking: "U.S. News" | "Niche"
  top: number
  /** Schools ranked `top` or better (more than `top` when there are ties). */
  schools: number
  withWordmark: number
  /** `withWordmark / schools`, 0-1. */
  share: number
  /** The schools that have one, best first. */
  names: string[]
}

/** Coverage of the top `top` (default 100) in a division. */
export function wordmarkCoverage(division: Division, top = 100): WordmarkCoverage {
  const byUsNews = division === "college"
  const rankOf = (s: RankedSchool) => (byUsNews ? s.usNewsRank : s.nicheRank)
  const ranked = schoolsInDivision(division)
    .filter((s) => {
      const rank = rankOf(s)
      return rank !== null && rank <= top
    })
    .sort((a, b) => (rankOf(a) as number) - (rankOf(b) as number))
  const withMark = ranked.filter((s) => s.wordmark)
  return {
    division,
    ranking: byUsNews ? "U.S. News" : "Niche",
    top,
    schools: ranked.length,
    withWordmark: withMark.length,
    share: ranked.length ? withMark.length / ranked.length : 0,
    names: withMark.map((s) => s.name),
  }
}

/** Coverage for all three divisions. */
export function allWordmarkCoverage(top = 100): WordmarkCoverage[] {
  return (["college", "public-high-school", "private-high-school"] as const).map((d) => wordmarkCoverage(d, top))
}
