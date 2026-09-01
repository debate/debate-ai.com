/**
 * @fileoverview Revision Incentives panel — the "(b) a reward-notification/
 * incentives-leaderboard UI" follow-up named under the "🔁 Revision
 * Incentives" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list.
 *
 * Reads every persisted revision record via `state/revisionHistory.ts`'s
 * `buildPersistedRevisionIncentiveLeaderboard` (itself a thin composition of
 * `revision-incentives.ts`'s pure `buildRevisionIncentiveLeaderboard` against
 * the persisted store) and renders it as a ranked table — reusing the
 * existing scoring/aggregation logic directly rather than introducing new
 * logic here.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isRevisionIncentivesLiveUpdateStorageEvent`, so a revision recorded in
 * another browser tab refreshes this leaderboard here too — the `storage`
 * event never fires in the tab that made the write, only in other tabs.
 *
 * @module panels/RevisionIncentivesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import { buildPersistedRevisionIncentiveLeaderboard } from "../state/revisionHistory"
import { isRevisionIncentivesLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorRevisionStats } from "../lib/revision-incentives"

/**
 * Renders the Revision Incentives leaderboard: every contributor with at
 * least one persisted card revision, ranked by total reward points earned
 * for meaningful quality gains, citation strengthening, and evidence
 * refreshes.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function RevisionIncentivesPanel() {
  const [rows, setRows] = useState<ContributorRevisionStats[] | null>(null)

  useEffect(() => {
    setRows(buildPersistedRevisionIncentiveLeaderboard())
  }, [])

  /**
   * Live-update the leaderboard when another browser tab records a
   * revision.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isRevisionIncentivesLiveUpdateStorageEvent(event)) return
      setRows(buildPersistedRevisionIncentiveLeaderboard())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  if (rows === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading revision incentives…</div>
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No card revisions recorded yet. The leaderboard fills in as contributors improve weak
        cards, strengthen citations, and refresh stale evidence.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Revision Incentives</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Ranked by total reward points earned improving weak cards, strengthening citations, and
        refreshing stale evidence.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Contributor</TableHead>
            <TableHead className="text-right">Revisions</TableHead>
            <TableHead className="text-right">Rewarded</TableHead>
            <TableHead className="text-right">Reward points</TableHead>
            <TableHead className="text-right">Weak cards improved</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.contributorId}>
              <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">{row.contributorId}</TableCell>
              <TableCell className="text-right">{row.revisionCount}</TableCell>
              <TableCell className="text-right">{row.rewardedRevisionCount}</TableCell>
              <TableCell className="text-right">{row.totalRewardPoints}</TableCell>
              <TableCell className="text-right">
                {row.weakCardsImprovedCount > 0 ? (
                  <Badge variant="outline" className="whitespace-nowrap">
                    🌱 {row.weakCardsImprovedCount}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
