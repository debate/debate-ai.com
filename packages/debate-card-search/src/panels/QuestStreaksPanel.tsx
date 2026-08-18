/**
 * @fileoverview Quest Streaks panel — the "streak/badge widget UI that
 * renders `buildContributorQuestStreak`/`getEarnedStreakBadges`" follow-up
 * named under the "🎮 Gamified Quests" bullet in TODO.md.
 *
 * Reads every contributor's streak+badge status via
 * `state/dailyMissionResults.ts`'s `buildPersistedQuestStreakRoster` (itself
 * a thin composition against the already-persisted `dailyMissionResults`
 * store) and renders it as a roster: current streak, longest streak, last
 * completed day, and every milestone badge earned so far — reusing the
 * existing streak/badge logic directly rather than introducing new logic
 * here.
 *
 * @module panels/QuestStreaksPanel
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
import { buildPersistedQuestStreakRoster } from "../state/dailyMissionResults"
import type { ContributorQuestStreak } from "../lib/gamified-quests"

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Renders the Quest Streaks roster: every contributor with at least one
 * persisted daily mission result, their current and longest streak, the
 * last day they completed their mission, and every streak badge earned.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function QuestStreaksPanel() {
  const [roster, setRoster] = useState<ContributorQuestStreak[] | null>(null)

  useEffect(() => {
    setRoster(buildPersistedQuestStreakRoster(todayUtcDayKey()))
  }, [])

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading streaks…</div>
  }

  if (roster.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No streaks yet. A contributor's streak fills in once they complete a full day of daily
        quests.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Quest Streaks</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Every contributor's daily-quest streak and the milestone badges it has earned.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contributor</TableHead>
            <TableHead className="text-right">Current streak</TableHead>
            <TableHead className="text-right">Longest streak</TableHead>
            <TableHead>Last completed</TableHead>
            <TableHead>Badges</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((status) => (
            <TableRow key={status.contributorId}>
              <TableCell className="font-medium">{status.contributorId}</TableCell>
              <TableCell className="text-right">
                {status.streak.currentStreak > 0 ? `🔥 ${status.streak.currentStreak}` : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{status.streak.longestStreak}</TableCell>
              <TableCell className="text-muted-foreground">
                {status.streak.lastCompletedDayKey ?? "—"}
              </TableCell>
              <TableCell>
                {status.earnedBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {status.earnedBadges.map((badge) => (
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
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
