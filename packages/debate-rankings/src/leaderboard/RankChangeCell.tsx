/**
 * @fileoverview Table cell showing places moved since last season (`+8`, `-4`, `new`).
 * @module leaderboard/RankChangeCell
 */

"use client"

import { cn } from "./ui/lib/utils"
import { formatRankChange, type RankChange } from "./rankChange"

/**
 * Green for moving up, red for dropping, muted for no change or a newcomer.
 *
 * @param props.change - From `buildRankChanges`; `undefined` renders a dash.
 */
export function RankChangeCell({ change }: { change: RankChange | undefined }) {
  if (change === undefined) return <span className="text-muted-foreground/60">—</span>
  const label =
    change === null
      ? "Not ranked last season"
      : change === 0
        ? "Same rank as last season"
        : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} ${Math.abs(change) === 1 ? "place" : "places"} from last season`
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "font-medium",
        change === null && "text-xs uppercase tracking-wide text-sky-600 dark:text-sky-400",
        change !== null && change > 0 && "text-emerald-600 dark:text-emerald-400",
        change !== null && change < 0 && "text-red-600 dark:text-red-400",
        change === 0 && "text-muted-foreground",
      )}
    >
      {formatRankChange(change)}
    </span>
  )
}
