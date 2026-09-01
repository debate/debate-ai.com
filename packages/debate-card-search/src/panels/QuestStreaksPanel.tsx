/**
 * @fileoverview Quest Streaks panel — the "streak/badge widget UI that
 * renders `buildContributorQuestStreak`/`getEarnedStreakBadges`" follow-up
 * named under the "🎮 Gamified Quests" bullet in TODO.md, plus that same
 * bullet's remaining follow-up (a): "a real trigger, i.e. a UI action or
 * scheduled job, to call `computeAndSavePersistedDailyMissionResult` on an
 * actual cadence."
 *
 * Reads every contributor's streak+badge status via
 * `state/dailyMissionResults.ts`'s `buildPersistedQuestStreakRoster` (itself
 * a thin composition against the already-persisted `dailyMissionResults`
 * store) and renders it as a roster: current streak, longest streak, last
 * completed day, and every milestone badge earned so far — reusing the
 * existing streak/badge logic directly rather than introducing new logic
 * here. A "Run today's mission check" action lets a contributor trigger
 * `computeAndSavePersistedDailyMissionResult` for themselves on demand
 * (there is no scheduled-job infra in this repo, and no contributor
 * identity/auth to scope this automatically — the same known gap as
 * `DailyQuestsPanel`/`ContributionsFeedPanel`, so the contributor id is
 * free-text input, mirroring those panels' convention) against today's
 * persisted quest-template roster (`state/dailyQuests.ts`'s
 * `listQuestTemplates`).
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isQuestStreaksLiveUpdateStorageEvent`, so a daily mission result recorded
 * in another tab refreshes this panel's roster without a manual reload —
 * closing the "Every other localStorage-backed panel in this repo still has
 * no cross-tab live-update mechanism" Known gap noted in
 * `shared-flow-sync.md`, for this panel.
 *
 * @module panels/QuestStreaksPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/primitives/table"
import {
  buildPersistedQuestStreakRoster,
  computeAndSavePersistedDailyMissionResult,
} from "../state/dailyMissionResults"
import { listQuestTemplates } from "../state/dailyQuests"
import { isQuestStreaksLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorQuestStreak } from "../lib/gamified-quests"

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Renders the Quest Streaks roster: every contributor with at least one
 * persisted daily mission result, their current and longest streak, the
 * last day they completed their mission, and every streak badge earned —
 * plus a "Run today's mission check" action to compute and save a
 * contributor's mission result on demand.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function QuestStreaksPanel() {
  const [roster, setRoster] = useState<ContributorQuestStreak[] | null>(null)
  const [contributorId, setContributorId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setRoster(buildPersistedQuestStreakRoster(todayUtcDayKey()))
  }

  useEffect(() => {
    refresh()
  }, [])

  /**
   * Live-update the roster when another browser tab logs a daily mission
   * result. A `storage` event never fires in the tab that made the write,
   * only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isQuestStreaksLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleRunCheck = () => {
    const id = contributorId.trim()
    if (!id) {
      setError("Contributor id is required.")
      return
    }
    computeAndSavePersistedDailyMissionResult(id, listQuestTemplates(), Date.now())
    setError(null)
    refresh()
  }

  const trigger = (
    <div className="mb-6 rounded-lg border border-dashed border-border p-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="quest-streak-contributor">Run today's mission check</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="quest-streak-contributor"
            value={contributorId}
            onChange={(e) => setContributorId(e.target.value)}
            placeholder="Contributor id"
            className="max-w-sm"
          />
          <Button type="button" variant="outline" onClick={handleRunCheck}>
            Run check
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Computes and saves this contributor's mission result for today against their real,
          persisted contributions and today's saved quest templates.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading streaks…</div>
  }

  if (roster.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Quest Streaks</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Every contributor's daily-quest streak and the milestone badges it has earned.
        </p>
        {trigger}
        <div className="p-6 text-center text-sm text-muted-foreground">
          No streaks yet. A contributor's streak fills in once they complete a full day of daily
          quests.
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Quest Streaks</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Every contributor's daily-quest streak and the milestone badges it has earned.
      </p>
      {trigger}
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
