/**
 * @fileoverview The "Who debated whom" card for a format with no pairing data:
 * the Parli tab, whose National Parliamentary Debate League rankings are
 * published as points per team with no ballots or round pairings to draw.
 * @module @debate-ai/rankings/leaderboard/network/HeadToHeadNetworkEmpty
 */

import { Network } from "lucide-react"

/** The graph card's frame and title with a note in place of the graph. */
export function HeadToHeadNetworkEmpty({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="h2h-network-title" className={`mb-4 rounded-lg border p-3 sm:p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Network className="h-4 w-4 text-violet-500" aria-hidden />
        <h2 id="h2h-network-title" className="text-base font-semibold">
          Who debated whom
        </h2>
      </div>
      <p className="py-6 text-center text-sm text-muted-foreground" data-testid="h2h-network-empty">
        No graph for Parli. The league publishes points per team, not the ballots or pairings behind them.
      </p>
    </section>
  )
}
