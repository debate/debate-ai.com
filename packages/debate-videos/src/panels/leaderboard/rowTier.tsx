/**
 * @fileoverview Highlight tiers for leaderboard rows, shared by the division
 * tables and the Schools table: the top five ranks are "legendary", and any
 * row whose rating has a bold leading digit of 8 or more (a displayed rating
 * of 80 and up) gets a gold border.
 * @module components/debate/DebateVideos/panels/rowTier
 */

import { Crown } from "lucide-react"

/** A row's highlight tier, or `null` for an ordinary row. */
export type RowTier = "legendary" | "gold" | null

/** Ranks at or above this are legendary. */
export const LEGENDARY_MAX_RANK = 5

/** Ratings at or above this (bold digit 8 or 9) get the gold border. */
export const GOLD_MIN_RATING = 80

/**
 * The tier for a row with this rank and rating. Legendary wins over gold.
 *
 * @param rank - The row's 1-based rank.
 * @param rating - The rating shown in bold (rounded the same way the table does).
 */
export function rowTier(rank: number, rating: number): RowTier {
  if (rank >= 1 && rank <= LEGENDARY_MAX_RANK) return "legendary"
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
      title="Legendary: top five"
    >
      <Crown className="h-2.5 w-2.5" aria-hidden />
      Legendary
    </span>
  )
}
