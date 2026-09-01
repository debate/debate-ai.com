/**
 * @fileoverview Contribution Leaderboard panel — the UI follow-up named
 * under both the "Contribution Leaderboard" bullet ("(c) a leaderboard UI
 * that reads through the persistence store") and idea #11 "Community-Rated
 * Summaries and Highlights" ("(c) a leaderboard/ranked-feed UI") in TODO.md.
 *
 * Reads every persisted contribution via `state/researchProgress.ts`'s
 * `buildPersistedLeaderboardWithCompletedTasks` (a thin composition of
 * `contribution-leaderboard.ts`'s pure `buildLeaderboard` against the
 * persisted contribution store plus each contributor's persisted
 * completed-task count) and renders it as a ranked table, merging in each
 * contributor's tier/streak status from `lib/unlock-streak-status.ts`'s
 * `buildContributorUnlockStatusWithStreakFromStore` — reusing every existing
 * scoring/tier/streak slice directly rather than introducing new logic here.
 *
 * An optional `signedInContributorId` prop (built from
 * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
 * against a real signed-in session) highlights that contributor's own row
 * with a "You" badge via `isOwnContributorRow` — this roster always shows
 * every contributor, so unlike Task Inbox's "My tasks" prefill there is
 * nothing to filter or prefill here, only to highlight.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isContributionLeaderboardLiveUpdateStorageEvent`, so a contribution,
 * completed task, or streak update logged in another tab refreshes this
 * panel's roster without a manual reload — closing the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 *
 * The intro line now carries an Info-icon tooltip (via `community-rating.ts`'s
 * `buildHelpfulnessScoreExplanation`) spelling out the popularity/quality/
 * reviewer-weight blend, closing idea #11's third named follow-up in
 * TODO.md — mirrors the existing `ELO_TOOLTIP`/`LeaderboardTableHeader`
 * pattern in `debate-videos`.
 *
 * @module panels/ContributionLeaderboardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Info } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "debate-ui/src/primitives/tooltip"
import { buildPersistedLeaderboardWithCompletedTasks } from "../state/researchProgress"
import { buildContributorUnlockStatusWithStreakFromStore } from "../lib/unlock-streak-status"
import { isOwnContributorRow } from "../lib/session-identity"
import { isContributionLeaderboardLiveUpdateStorageEvent } from "../state/live-update"
import { buildHelpfulnessScoreExplanation } from "../lib/community-rating"
import type { ContributorStats } from "../lib/contribution-leaderboard"

const HELPFULNESS_SCORE_EXPLANATION = buildHelpfulnessScoreExplanation()

/** One leaderboard row: a contributor's raw stats plus their derived tier/streak status. */
interface LeaderboardRow extends ContributorStats {
  tier: string
  badges: string[]
  currentStreak: number
}

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildLeaderboardRows(): LeaderboardRow[] {
  const asOfDayKey = todayUtcDayKey()
  return buildPersistedLeaderboardWithCompletedTasks().map((stats) => {
    const status = buildContributorUnlockStatusWithStreakFromStore(stats.contributorId, asOfDayKey)
    return {
      ...stats,
      tier: status.tier,
      badges: status.badges,
      currentStreak: status.streak.currentStreak,
    }
  })
}

const TIER_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  novice: "outline",
  apprentice: "secondary",
  veteran: "secondary",
  expert: "default",
}

/**
 * Renders the Contribution Leaderboard: every contributor with at least one
 * persisted contribution, ranked by total helpfulness score, with their
 * unlock tier, earned badges, and current daily-quest streak.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export interface ContributionLeaderboardPanelProps {
  /**
   * A contributor id to highlight as "You" in the leaderboard, typically
   * derived from a real signed-in session via
   * `deriveContributorIdFromSessionIdentity`. The leaderboard always shows
   * every contributor — this only highlights a matching row, it never
   * filters the others out.
   */
  signedInContributorId?: string
}

export function ContributionLeaderboardPanel({ signedInContributorId }: ContributionLeaderboardPanelProps = {}) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)

  useEffect(() => {
    setRows(buildLeaderboardRows())
  }, [])

  /**
   * Live-update the roster when another browser tab submits a contribution,
   * completes a research task, or logs quest/streak activity. A `storage`
   * event never fires in the tab that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isContributionLeaderboardLiveUpdateStorageEvent(event)) return
      setRows(buildLeaderboardRows())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  if (rows === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading leaderboard…</div>
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No contributions yet. The leaderboard fills in as contributors submit cards, summaries, and
        analytics.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Contribution Leaderboard</h1>
      <p className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        Ranked by total
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="cursor-help inline-flex items-center gap-1 underline decoration-dotted">
              helpfulness score
              <Info className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs leading-relaxed">{HELPFULNESS_SCORE_EXPLANATION}</p>
          </TooltipContent>
        </Tooltip>
        — a blend of popularity, quality, and reviewer signals.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Contributor</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Contributions</TableHead>
            <TableHead className="text-right">Total score</TableHead>
            <TableHead className="text-right">Avg score</TableHead>
            <TableHead className="text-right">Completed tasks</TableHead>
            <TableHead className="text-right">Streak</TableHead>
            <TableHead>Badges</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const isMe = isOwnContributorRow(row.contributorId, signedInContributorId)
            return (
            <TableRow key={row.contributorId} className={isMe ? "bg-primary/5" : undefined}>
              <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {row.contributorId}
                  {isMe && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      You
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={TIER_VARIANT[row.tier] ?? "outline"} className="capitalize">
                  {row.tier}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{row.contributionCount}</TableCell>
              <TableCell className="text-right">{row.totalHelpfulnessScore}</TableCell>
              <TableCell className="text-right">{row.averageHelpfulnessScore}</TableCell>
              <TableCell className="text-right">{row.completedTaskCount}</TableCell>
              <TableCell className="text-right">{row.currentStreak > 0 ? `🔥 ${row.currentStreak}` : "—"}</TableCell>
              <TableCell>
                {row.badges.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {row.badges.map((badge) => (
                      <Badge key={badge} variant="outline" className="whitespace-nowrap">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
