/**
 * @fileoverview Highlight tiers for leaderboard rows, shared by the division
 * tables and the Schools table. Each list picks its own legendary cutoff (see
 * {@link legendaryCount}), and any other row whose rating has a bold leading
 * digit of 8 or more (a displayed rating of 80 and up) gets a gold border.
 * @module components/debate/DebateVideos/panels/rowTier
 */

import { Crown } from "lucide-react"

/** A row's highlight tier, or `null` for an ordinary row. */
export type RowTier = "legendary" | "gold" | null

/** The legendary group size a list aims for. */
export const LEGENDARY_TARGET = 5

/** A list never has more legendary rows than this. */
export const LEGENDARY_MAX_COUNT = 7

/** Ratings at or above this (bold digit 8 or 9) get the gold border. */
export const GOLD_MIN_RATING = 80

/**
 * How many of a list's top ranks are legendary. Counts the rows rated 90+,
 * 80+, 70+ and so on down by tens, takes the non-empty count closest to
 * {@link LEGENDARY_TARGET} (the higher cutoff on a tie), and caps it at
 * {@link LEGENDARY_MAX_COUNT}. So a list with four 90+ rows and fourteen 80+
 * rows has four legendary rows, and one with no 90s and four 80+ rows has
 * four. Decided per list, from the whole list rather than a search-filtered view.
 *
 * @param ratings - Every row's bold rating in the list.
 */
export function legendaryCount(ratings: readonly number[]): number {
  const rounded = ratings.map(Math.round)
  let best = 0
  for (let cutoff = 90; cutoff > 0; cutoff -= 10) {
    const count = rounded.filter((r) => r >= cutoff).length
    if (count === 0) continue
    if (best === 0 || Math.abs(count - LEGENDARY_TARGET) < Math.abs(best - LEGENDARY_TARGET)) best = count
    if (count >= LEGENDARY_TARGET) break
  }
  return Math.min(best, LEGENDARY_MAX_COUNT)
}

/**
 * The tier for a row with this rank and rating. Legendary wins over gold.
 *
 * @param rank - The row's 1-based rank.
 * @param rating - The rating shown in bold (rounded the same way the table does).
 * @param legendary - How many top ranks are legendary in this list ({@link legendaryCount}).
 */
export function rowTier(rank: number, rating: number, legendary: number): RowTier {
  if (rank >= 1 && rank <= legendary) return "legendary"
  if (Math.round(rating) >= GOLD_MIN_RATING) return "gold"
  return null
}

/** Row classes per tier: a gold outline, and for legendary a glow and warm tint as well. */
export const ROW_TIER_CLASS: Record<Exclude<RowTier, null>, string> = {
  gold: "outline outline-1 -outline-offset-1 outline-amber-400/80",
  legendary:
    "outline outline-2 -outline-offset-2 outline-amber-500 bg-amber-400/10 shadow-[0_0_12px_rgb(251_191_36/0.5)] hover:bg-amber-400/20",
}

/** The small "Legendary" label shown beside a legendary row's rank. */
export function LegendaryBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-sm bg-amber-500/90 px-1 py-px align-middle text-[9px] font-bold uppercase tracking-wide text-white"
      title="Legendary: the small group at the top of this list"
    >
      <Crown className="h-2.5 w-2.5" aria-hidden />
      Legendary
    </span>
  )
}
