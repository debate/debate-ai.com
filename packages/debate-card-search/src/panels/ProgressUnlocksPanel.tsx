/**
 * @fileoverview Progress Unlocks panel — the UI follow-up named "(b) a
 * progress/unlock UI" under the "🔓 Progress Unlocks" bullet in TODO.md.
 *
 * Reads every contributor's unlock+streak status via
 * `lib/unlock-streak-status.ts`'s `buildUnlockStatusRoster` (itself a thin
 * composition against the already-persisted `state/contributions.ts`/
 * `state/dailyMissionResults.ts`/`state/researchProgress.ts` stores) and
 * renders it as a roster table: tier, unlocked task skill level, badges,
 * current streak, completed research-task count, and progress toward the
 * next tier (which now also names how many more tasks need finishing) —
 * reusing every existing tier/badge/streak/progress slice directly rather
 * than introducing new logic here.
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
  const taskPart = status.nextTier.tasksNeeded > 0 ? `, ${status.nextTier.tasksNeeded} tasks` : ""
  return `${status.nextTier.contributionsNeeded} contributions, ${status.nextTier.helpfulnessScoreNeeded} pts${taskPart} to ${status.nextTier.tier}`
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
export function ProgressUnlocksPanel() {
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
            <TableHead className="text-right">Streak</TableHead>
            <TableHead className="text-right">Tasks done</TableHead>
            <TableHead>Badges</TableHead>
            <TableHead>Next tier</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((status) => (
            <TableRow key={status.contributorId}>
              <TableCell className="font-medium">{status.contributorId}</TableCell>
              <TableCell>
                <Badge variant={TIER_VARIANT[status.tier] ?? "outline"} className="capitalize">
                  {status.tier}
                </Badge>
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">{status.unlockedSkillLevel}</TableCell>
              <TableCell className="text-right">
                {status.streak.currentStreak > 0 ? `🔥 ${status.streak.currentStreak}` : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{status.completedTaskCount}</TableCell>
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
