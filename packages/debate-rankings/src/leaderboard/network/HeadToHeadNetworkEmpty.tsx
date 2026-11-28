/**
 * @fileoverview The "Who debated whom" card's empty state for the Parli tab:
 * the National Parliamentary Debate League publishes points per team with no
 * ballots or round pairings, so this card shows until Tabroom rounds are
 * available for the season (see `ParliRecordSheets`).
 * @module @debate-ai/rankings/leaderboard/network/HeadToHeadNetworkEmpty
 */

import { Network } from "lucide-react"

/** The graph card's frame and title with a note in place of the graph. */
export function HeadToHeadNetworkEmpty({
  className = "",
  message = "No Tabroom round data for Parli yet. The league publishes points per team, not the ballots or pairings behind them; record sheets appear here once its Tabroom tournaments are synced.",
}: {
  className?: string
  message?: string
}) {
  return (
    <section aria-labelledby="h2h-network-title" className={`mb-4 rounded-lg border p-3 sm:p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Network className="h-4 w-4 text-violet-500" aria-hidden />
        <h2 id="h2h-network-title" className="text-base font-semibold">
          Who debated whom
        </h2>
      </div>
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="h2h-network-empty">
        {message}
      </p>
    </section>
  )
}
