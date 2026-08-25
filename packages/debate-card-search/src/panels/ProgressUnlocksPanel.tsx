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
 * @module panels/ProgressUnlocksPanel
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
import { buildUnlockStatusRoster } from "../lib/unlock-streak-status"
import { isOwnContributorRow } from "../lib/session-identity"
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

function nextTierText(status: ContributorUnlockStatusWithStreak): string {
  if (!status.nextTier) return "Top tier reached"
  return `${status.nextTier.contributionsNeeded} contributions, ${status.nextTier.helpfulnessScoreNeeded} pts, or ${status.nextTier.completedTasksNeeded} tasks, to ${status.nextTier.tier}`
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
              <TableCell className="text-sm text-muted-foreground">{nextTierText(status)}</TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
