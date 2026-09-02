/**
 * @fileoverview Progress Unlocks panel — the UI follow-up named "(b) a
 * progress/unlock UI" under the "🔓 Progress Unlocks" bullet in TODO.md.
 *
 * Reads every contributor's unlock+streak status via
 * `lib/unlock-streak-status.ts`'s `buildUnlockStatusRoster` (itself a thin
 * composition against the already-persisted `state/contributions.ts`/
 * `state/researchProgress.ts`/`state/dailyMissionResults.ts` stores) and
 * renders it as a roster table: tier, unlocked task skill level, completed
 * research-task count, badges, current streak, and progress toward the next
 * tier — reusing every existing tier/badge/streak slice directly rather
 * than introducing new logic here.
 *
 * An optional `signedInContributorId` prop (built from
 * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
 * against a real signed-in session) highlights that contributor's own row
 * with a "You" badge via `isOwnContributorRow` — this roster always shows
 * every contributor, so unlike Task Inbox's "My tasks" prefill there is
 * nothing to filter or prefill here, only to highlight.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isProgressUnlocksLiveUpdateStorageEvent`, so a contribution, completed
 * task, or daily mission result recorded in another tab refreshes this
 * panel's roster without a manual reload — closing the "Every other
 * localStorage-backed panel in this repo still has no cross-tab
 * live-update mechanism" Known gap noted in `shared-flow-sync.md`, for this
 * panel.
 *
 * @module panels/ProgressUnlocksPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { MeterBar } from "debate-ui/src/panels/panel-shell"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildUnlockStatusRoster } from "../lib/unlock-streak-status"
import { isOwnContributorRow } from "../lib/session-identity"
import { isProgressUnlocksLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorUnlockStatusWithStreak } from "../lib/unlock-streak-status"

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

const TIER_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  novice: "outline",
  apprentice: "secondary",
  veteran: "secondary",
  expert: "default",
}

function nextTierDetailText(nextTier: NonNullable<ContributorUnlockStatusWithStreak["nextTier"]>): string {
  return `${nextTier.contributionsNeeded} contributions, ${nextTier.helpfulnessScoreNeeded} pts, or ${nextTier.completedTasksNeeded} tasks, to ${nextTier.tier}`
}

/**
 * Renders the Progress Unlocks roster: every contributor with at least one
 * persisted contribution, their unlock tier, the task skill level that tier
 * grants, every badge earned (tier + streak), their current daily-quest
 * streak, and how far they are from the next tier.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export interface ProgressUnlocksPanelProps {
  /**
   * A contributor id to highlight as "You" in the roster, typically derived
   * from a real signed-in session via `deriveContributorIdFromSessionIdentity`.
   * This roster always shows every contributor — this only highlights a
   * matching row, it never filters the others out.
   */
  signedInContributorId?: string
}

export function ProgressUnlocksPanel({ signedInContributorId }: ProgressUnlocksPanelProps = {}) {
  const [roster, setRoster] = useState<ContributorUnlockStatusWithStreak[] | null>(null)

  useEffect(() => {
    setRoster(buildUnlockStatusRoster(todayUtcDayKey()))
  }, [])

  /**
   * Live-update the roster when another browser tab records a contribution,
   * completes a task, or logs a daily mission result. A `storage` event
   * never fires in the tab that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isProgressUnlocksLiveUpdateStorageEvent(event)) return
      setRoster(buildUnlockStatusRoster(todayUtcDayKey()))
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading progress…</div>
  }

  if (roster.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No contributors yet. Unlock status fills in as contributors submit cards, summaries, and
        analytics.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Progress Unlocks</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Every contributor's unlock tier, badges, and streak — and how far they are from the next
        tier.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contributor</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Unlocked tasks</TableHead>
            <TableHead className="text-right">Tasks completed</TableHead>
            <TableHead className="text-right">Streak</TableHead>
            <TableHead>Badges</TableHead>
            <TableHead>Next tier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((status) => {
            const isMe = isOwnContributorRow(status.contributorId, signedInContributorId)
            return (
            <TableRow key={status.contributorId} className={isMe ? "bg-primary/5" : undefined}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-1.5">
                  {status.contributorId}
                  {isMe && (
                    <Badge variant="outline" className="whitespace-nowrap">
                      You
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={TIER_VARIANT[status.tier] ?? "outline"} className="capitalize">
                  {status.tier}
                </Badge>
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">{status.unlockedSkillLevel}</TableCell>
              <TableCell className="text-right">{status.completedTaskCount}</TableCell>
              <TableCell className="text-right">
                {status.streak.currentStreak > 0 ? `🔥 ${status.streak.currentStreak}` : "—"}
              </TableCell>
              <TableCell>
                {status.badges.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {status.badges.map((badge) => (
                      <Badge key={badge} variant="outline" className="whitespace-nowrap">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="min-w-40">
                {status.nextTier ? (
                  <MeterBar
                    value={Math.round(status.nextTier.progressRatio * 100)}
                    max={100}
                    caption={`${Math.round(status.nextTier.progressRatio * 100)}% to ${status.nextTier.tier}`}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Top tier reached</span>
                )}
                {status.nextTier && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {nextTierDetailText(status.nextTier)}
                  </div>
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
