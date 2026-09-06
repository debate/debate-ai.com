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
 * Also renders a "Recent revisions" section — the "before/after revision
 * diff viewer" follow-up named under the same TODO.md bullet — listing the
 * most recently recorded revisions with a "View diff" toggle per row that
 * expands `state/revisionHistory.ts`'s `getRevisionTextDiff` into a
 * word-level before/after comparison of the card's argument block, cut
 * text, and citation, mirroring `debate-round`'s `SharedFlowSyncPanel` diff
 * styling.
 *
 * @module panels/RevisionIncentivesPanel
 */

"use client"

import { Fragment, useEffect, useState } from "react"
import { cn } from "../ui/lib/utils"
import { toneSurfaceClass } from "../ui/panels/panel-shell"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import {
  buildPersistedRevisionIncentiveLeaderboard,
  getRevisionTextDiff,
  listRecentRevisionHistory,
  type CardRevisionRecord,
} from "../state/revisionHistory"
import { buildPersistedStaleEvidenceDigest } from "../state/evidenceLibraryEntries"
import { isRevisionIncentivesLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorRevisionStats } from "../lib/revision-incentives"
import type { StaleEvidenceDigestEntry } from "../lib/shared-evidence-library"
import type { CardRevisionFieldDiff, DiffSegment } from "../lib/revision-text-diff"

/** How many of the most recent revisions to list before/after diffs for. */
const RECENT_REVISIONS_LIMIT = 20

const FIELD_LABELS: Record<CardRevisionFieldDiff["field"], string> = {
  argBlock: "Argument block",
  text: "Card text",
  cite: "Citation",
}

/** Renders one side's diffed words, highlighting this side's own changes. */
function DiffText({ segments }: { segments: DiffSegment[] }) {
  if (segments.length === 0) {
    return <span className="italic text-muted-foreground">(empty)</span>
  }
  return (
    <>
      {segments.map((segment, i) =>
        segment.type === "equal" ? (
          <span key={i}>{segment.text}</span>
        ) : (
          <span
            key={i}
            className={cn(
              "rounded-sm px-0.5",
              toneSurfaceClass(segment.type === "removed" ? "critical" : "positive"),
              segment.type === "removed" && "line-through",
            )}
          >
            {segment.text}
          </span>
        ),
      )}
    </>
  )
}

/** Expanded before/after diff for one revision record, one row per changed field. */
function RevisionDiffView({ record }: { record: CardRevisionRecord }) {
  const diff = getRevisionTextDiff(record)
  if (!diff) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No before/after text was captured for this revision.
      </p>
    )
  }

  const changedFields = diff.filter((field) => field.changed)
  if (changedFields.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No text fields changed in this revision.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {changedFields.map((field) => (
        <div key={field.field} className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div className="sm:col-span-2 font-medium text-muted-foreground">{FIELD_LABELS[field.field]}</div>
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-1 font-medium text-muted-foreground">Before</div>
            <p className="whitespace-pre-wrap break-words">
              <DiffText segments={field.before} />
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-1 font-medium text-muted-foreground">After</div>
            <p className="whitespace-pre-wrap break-words">
              <DiffText segments={field.after} />
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

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
  const [recentRevisions, setRecentRevisions] = useState<CardRevisionRecord[] | null>(null)
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(null)

  const refresh = () => {
    setRows(buildPersistedRevisionIncentiveLeaderboard())
    setStaleDigest(buildPersistedStaleEvidenceDigest(new Date().getFullYear()))
    setRecentRevisions(listRecentRevisionHistory(RECENT_REVISIONS_LIMIT))
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

  if (rows === null || staleDigest === null || recentRevisions === null) {
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
                  <TableHead className="text-right">
                    <span className="sr-only">Revise</span>
                  </TableHead>
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
                    <TableCell className="text-right">
                      <a
                        href={`/cards/library?q=${encodeURIComponent(entry.argBlock)}`}
                        className="whitespace-nowrap text-xs underline underline-offset-2"
                        aria-label={`Revise "${entry.argBlock}" in the Evidence Library`}
                      >
                        Revise
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-base font-semibold text-foreground">Leaderboard</h2>
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
      </section>

      <section>
        <h2 className="mb-1 text-base font-semibold text-foreground">Recent revisions</h2>
        {recentRevisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No card revisions recorded yet.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              The {recentRevisions.length} most recent revision{recentRevisions.length === 1 ? "" : "s"},
              newest first. Expand a row to see exactly what changed.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead>Contributor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRevisions.map((record) => {
                  const isExpanded = expandedRevisionId === record.id
                  return (
                    <Fragment key={record.id}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(record.revisedAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-medium">{record.cardId}</TableCell>
                        <TableCell>{record.contributorId}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRevisionId(isExpanded ? null : record.id)}
                          >
                            {isExpanded ? "Hide diff" : "View diff"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={4} className="bg-muted/10">
                            <RevisionDiffView record={record} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </section>
    </div>
  )
}
