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
 * Each row also has a "History" toggle that expands an inline endorsement
 * history list for that contributor — closing idea #11's "An endorsement
 * history list per contributor" follow-up in TODO.md — reading
 * `state/contributions.ts`'s new `listEndorsementsByContributor` (direction
 * `"received"`: every endorsement made on that contributor's own
 * contributions, newest first).
 *
 * When `signedInContributorId` is supplied, a "My endorsement activity"
 * toggle above the table renders that same history list with `direction:
 * "given"` — every endorsement the signed-in visitor made as a reviewer,
 * across every contributor's contributions. This closes idea #11's
 * next-named follow-up in TODO.md: wiring the store's already-built
 * `direction: "given"` query into a "my endorsement activity" view. Both
 * directions share one `EndorsementHistoryList` renderer, parameterized by
 * `direction`, and `state/contributions.ts`'s new
 * `endorsementHistoryCounterpartId` resolves which id ("who endorsed me" vs.
 * "who I endorsed") to display per entry.
 *
 * A "Category" dropdown next to the range select scopes the whole roster to
 * one contribution `kind` at a time (card/summary/highlight/annotation/
 * original-argument/refutation), or "All categories" — closing the
 * "per-category (kind) leaderboards alongside the overall one" follow-up
 * named under the "Contribution Leaderboard" bullet in TODO.md.
 *
 * @module panels/ContributionLeaderboardPanel
 */

"use client"

import { Fragment, useEffect, useState } from "react"
import { Info } from "lucide-react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-research-evidence/src/ui/primitives/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-research-evidence/src/ui/primitives/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "debate-research-evidence/src/ui/primitives/tooltip"
import { buildPersistedLeaderboardWithCompletedTasks } from "debate-team-collaboration/src/state/researchProgress"
import { buildContributorUnlockStatusWithStreakFromStore } from "../lib/unlock-streak-status"
import { isOwnContributorRow } from "debate-research-evidence/src/lib/session-identity"
import { isContributionLeaderboardLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import { buildHelpfulnessScoreExplanation } from "debate-research-evidence/src/lib/community-rating"
import {
  endorsementHistoryCounterpartId,
  listEndorsementsByContributor,
  type EndorsementHistoryDirection,
} from "debate-research-evidence/src/state/contributions"
import type { ContributionCategoryFilter, ContributorStats, LeaderboardRange } from "debate-research-evidence/src/lib/contribution-leaderboard"

const RANGE_LABELS: Record<LeaderboardRange, string> = {
  "all-time": "All time",
  weekly: "This week",
  monthly: "This month",
}

const CATEGORY_LABELS: Record<ContributionCategoryFilter, string> = {
  all: "All categories",
  card: "Cards",
  summary: "Summaries",
  highlight: "Highlights",
  annotation: "Annotations",
  "original-argument": "Original arguments",
  refutation: "Refutations",
}

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

function buildLeaderboardRows(range: LeaderboardRange, category: ContributionCategoryFilter): LeaderboardRow[] {
  const asOfDayKey = todayUtcDayKey()
  return buildPersistedLeaderboardWithCompletedTasks(undefined, range, undefined, category).map((stats) => {
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
  const [expandedContributorId, setExpandedContributorId] = useState<string | null>(null)
  const [showMyActivity, setShowMyActivity] = useState(false)
  const [range, setRange] = useState<LeaderboardRange>("all-time")
  const [category, setCategory] = useState<ContributionCategoryFilter>("all")

  useEffect(() => {
    setRows(buildLeaderboardRows(range, category))
  }, [range, category])

  /**
   * Live-update the roster when another browser tab submits a contribution,
   * completes a research task, or logs quest/streak activity. A `storage`
   * event never fires in the tab that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isContributionLeaderboardLiveUpdateStorageEvent(event)) return
      setRows(buildLeaderboardRows(range, category))
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [range, category])

  if (rows === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading leaderboard…</div>
  }

  const rangeSelect = (
    <div className="space-y-1.5">
      <Label htmlFor="leaderboard-range">Range</Label>
      <Select value={range} onValueChange={(value) => setRange(value as LeaderboardRange)}>
        <SelectTrigger id="leaderboard-range" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(RANGE_LABELS) as LeaderboardRange[]).map((value) => (
            <SelectItem key={value} value={value}>
              {RANGE_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const categorySelect = (
    <div className="space-y-1.5">
      <Label htmlFor="leaderboard-category">Category</Label>
      <Select value={category} onValueChange={(value) => setCategory(value as ContributionCategoryFilter)}>
        <SelectTrigger id="leaderboard-category" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(CATEGORY_LABELS) as ContributionCategoryFilter[]).map((value) => (
            <SelectItem key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (rows.length === 0) {
    const isFiltered = range !== "all-time" || category !== "all"
    return (
      <div className="p-4 sm:p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Contribution Leaderboard</h1>
        <div className="mb-4 flex flex-wrap gap-3">
          {rangeSelect}
          {categorySelect}
        </div>
        <div className="p-6 text-center text-sm text-muted-foreground">
          {isFiltered
            ? `No ${category === "all" ? "contributions" : CATEGORY_LABELS[category].toLowerCase()} ${range === "all-time" ? "yet" : `in ${RANGE_LABELS[range].toLowerCase()}`}. Try widening the range or category filter to see the full roster.`
            : "No contributions yet. The leaderboard fills in as contributors submit cards, summaries, and analytics."}
        </div>
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
      <div className="mb-4 flex flex-wrap gap-3">
        {rangeSelect}
        {categorySelect}
      </div>
      {signedInContributorId && (
        <div className="mb-4">
          <Button size="sm" variant="outline" onClick={() => setShowMyActivity((expanded) => !expanded)}>
            {showMyActivity ? "Hide my endorsement activity" : "My endorsement activity"}
          </Button>
          {showMyActivity && (
            <div className="mt-2 rounded-md border border-border bg-muted/30 px-3">
              <EndorsementHistoryList contributorId={signedInContributorId} direction="given" />
            </div>
          )}
        </div>
      )}
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
            <TableHead>Endorsements</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const isMe = isOwnContributorRow(row.contributorId, signedInContributorId)
            const isExpanded = expandedContributorId === row.contributorId
            return (
            <Fragment key={row.contributorId}>
            <TableRow className={isMe ? "bg-primary/5" : undefined}>
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
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpandedContributorId(isExpanded ? null : row.contributorId)}
                >
                  {isExpanded ? "Hide" : "History"}
                </Button>
              </TableCell>
            </TableRow>
            {isExpanded && (
              <TableRow>
                <TableCell colSpan={10} className="bg-muted/30">
                  <EndorsementHistoryList contributorId={row.contributorId} direction="received" />
                </TableCell>
              </TableRow>
            )}
            </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Renders `contributorId`'s endorsement history for `direction` — one line
 * per endorsement, newest first. `direction: "received"` names the
 * endorsing reviewer ("{reviewer} endorsed a {kind}"); `direction: "given"`
 * names who `contributorId` endorsed as a reviewer ("You endorsed
 * {contributor}'s {kind}"). Reads `state/contributions.ts` directly rather
 * than the parent panel holding this data up front, since at most one
 * received-history row and the given-history section are ever expanded at
 * once.
 */
function EndorsementHistoryList({
  contributorId,
  direction,
}: {
  contributorId: string
  direction: EndorsementHistoryDirection
}) {
  const entries = listEndorsementsByContributor(contributorId, direction)

  if (entries.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {direction === "received" ? "No endorsements received yet." : "No endorsements given yet."}
      </p>
    )
  }

  return (
    <ul className="space-y-1 py-2 text-sm">
      {entries.map((entry, index) => (
        <li key={`${entry.contributionId}-${entry.reviewerId}-${entry.endorsedAt}-${index}`} className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          {direction === "received" ? (
            <>
              <span className="font-medium text-foreground">{endorsementHistoryCounterpartId(entry, direction)}</span>
              endorsed a
            </>
          ) : (
            <>
              You endorsed
              <span className="font-medium text-foreground">{endorsementHistoryCounterpartId(entry, direction)}'s</span>
            </>
          )}
          <Badge variant="outline" className="capitalize">
            {entry.contributionKind}
          </Badge>
          <span>(weight {entry.reviewerWeight.toFixed(2)})</span>
          <span>· {new Date(entry.endorsedAt).toLocaleDateString()}</span>
        </li>
      ))}
    </ul>
  )
}
