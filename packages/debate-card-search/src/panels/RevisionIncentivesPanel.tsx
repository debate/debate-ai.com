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
 * Also renders a "Stale evidence digest" section — the "(a) a stale-evidence
 * digest surfaced from the existing staleness signal" follow-up named under
 * the same TODO.md bullet — via `state/evidenceLibraryEntries.ts`'s
 * `buildPersistedStaleEvidenceDigest`, itself a thin composition of
 * `shared-evidence-library.ts`'s pure `buildStaleEvidenceDigest` against the
 * persisted evidence library store. This is the proactive counterpart to the
 * leaderboard below: it surfaces which cards need a refresh before a
 * revision happens, ranked most-urgent (undated, then oldest-cited) first.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isRevisionIncentivesLiveUpdateStorageEvent`, so a revision recorded — or a
 * card edited — in another browser tab refreshes this panel here too — the
 * `storage` event never fires in the tab that made the write, only in other
 * tabs.
 *
 * @module panels/RevisionIncentivesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildPersistedRevisionIncentiveLeaderboard } from "../state/revisionHistory"
import { buildPersistedStaleEvidenceDigest } from "../state/evidenceLibraryEntries"
import { isRevisionIncentivesLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorRevisionStats } from "../lib/revision-incentives"
import type { StaleEvidenceDigestEntry } from "../lib/shared-evidence-library"

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
  const [staleDigest, setStaleDigest] = useState<StaleEvidenceDigestEntry[] | null>(null)

  const refresh = () => {
    setRows(buildPersistedRevisionIncentiveLeaderboard())
    setStaleDigest(buildPersistedStaleEvidenceDigest(new Date().getFullYear()))
  }

  useEffect(() => {
    refresh()
  }, [])

  /**
   * Live-update the leaderboard and stale-evidence digest when another
   * browser tab records a revision or edits a card.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isRevisionIncentivesLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  if (rows === null || staleDigest === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading revision incentives…</div>
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Revision Incentives</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Ranked by total reward points earned improving weak cards, strengthening citations, and
        refreshing stale evidence.
      </p>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-foreground">Stale evidence digest</h2>
        {staleDigest.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stale cards right now — every card's cited evidence is dated and recent.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              {staleDigest.length} card{staleDigest.length === 1 ? "" : "s"} could use a fresher
              citation, most urgent first.{" "}
              <a href="/cards/library" className="underline underline-offset-2">
                Open the Evidence Library
              </a>{" "}
              to revise one and earn reward points.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Argument</TableHead>
                  <TableHead>Topic / case area</TableHead>
                  <TableHead>Cite</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staleDigest.map(({ entry, staleness }) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.argBlock}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.topic} / {entry.caseArea}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.cite || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive" className="whitespace-nowrap">
                        {staleness.ageYears === null ? "Undated" : `${staleness.ageYears}y old`}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </section>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No card revisions recorded yet. The leaderboard fills in as contributors improve weak
          cards, strengthen citations, and refresh stale evidence.
        </p>
      ) : (
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
      )}
    </div>
  )
}
