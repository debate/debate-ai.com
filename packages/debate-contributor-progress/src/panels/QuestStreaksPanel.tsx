/**
 * @fileoverview Quest Streaks panel — the "streak/badge widget UI that
 * renders `buildContributorQuestStreak`/`getEarnedStreakBadges`" follow-up
 * named under the "🎮 Gamified Quests" bullet in TODO.md, plus that same
 * bullet's follow-up (a): "a real trigger, i.e. a UI action or scheduled
 * job, to call `computeAndSavePersistedDailyMissionResult` on an actual
 * cadence", and its "a streak-freeze/grace-day mechanic for a missed day"
 * follow-up.
 *
 * Reads every contributor's streak+badge status via
 * `state/streakFreezes.ts`'s `buildQuestStreakRosterWithFreezes` (a thin
 * composition of the already-persisted `dailyMissionResults` store with
 * any persisted streak freezes applied on top) and renders it as a roster:
 * current streak, longest streak, last completed day, every milestone badge
 * earned so far, and a "Streak freeze" column — reusing the existing
 * streak/badge logic directly rather than introducing new logic here. A
 * "Run today's mission check" action lets a contributor trigger
 * `computeAndSavePersistedDailyMissionResult` for themselves on demand
 * (there is no scheduled-job infra in this repo, and no contributor
 * identity/auth to scope this automatically — the same known gap as
 * `DailyQuestsPanel`/`ContributionsFeedPanel`, so the contributor id is
 * free-text input, mirroring those panels' convention) against today's
 * persisted quest-template roster (`state/dailyQuests.ts`'s
 * `listQuestTemplates`).
 *
 * The "Streak freeze" column shows each contributor's remaining freeze
 * allowance (`lib/gamified-quests.ts#buildStreakFreezeAvailabilityText`) and,
 * when yesterday broke an in-progress streak
 * (`lib/gamified-quests.ts#findFreezableStreakGapDayKey`), a "Use a grace
 * day for …" action that spends one via
 * `state/streakFreezes.ts#applyPersistedStreakFreeze` — bridging the gap so
 * the streak continues instead of resetting to zero.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isQuestStreaksLiveUpdateStorageEvent`, so a daily mission result or streak
 * freeze recorded in another tab refreshes this panel's roster without a
 * manual reload — closing the "Every other localStorage-backed panel in this
 * repo still has no cross-tab live-update mechanism" Known gap noted in
 * `shared-flow-sync.md`, for this panel.
 *
 * The "Reminder" column closes that same bullet's "an opt-in reminder
 * notification before a streak lapses" follow-up: a per-contributor 🔔
 * toggle (`state/streakLapseReminders.ts`) that, once on, shows a warning
 * banner on that row whenever their streak is at risk of lapsing today
 * (`lib/gamified-quests.ts#getStreakLapseRiskLength`) — i.e. an in-progress
 * streak coming into today that today's mission hasn't yet saved. There is
 * no push-notification/scheduled-job infrastructure in this repo, so the
 * "notification" is this in-app banner, seen whenever a contributor visits
 * the panel while at risk, not a real push notification.
 *
 * An optional `signedInContributorId` prop (built from
 * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
 * against a real signed-in session) highlights that contributor's own row
 * with a "You" badge, mirroring `ResearchProgressPanel.tsx`'s convention,
 * and syncs *that one contributor's* reminder opt-in and spent streak
 * freezes to their account across devices via
 * `hooks/useQuestStreakSync.ts` — the "account-syncing reminder
 * opt-ins/streak freezes across devices" follow-up named under the "🎮
 * Gamified Quests" bullet in TODO.md. Every other row in this roster stays
 * local-only, same as before.
 *
 * @module panels/QuestStreaksPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-research-evidence/src/ui/primitives/table"
import {
  computeAndSavePersistedDailyMissionResult,
  listDailyMissionResultsForContributor,
} from "../state/dailyMissionResults"
import { listQuestTemplates } from "debate-team-collaboration/src/state/dailyQuests"
import { isQuestStreaksLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import { isOwnContributorRow } from "debate-research-evidence/src/lib/session-identity"
import {
  applyPersistedStreakFreeze,
  buildQuestStreakRosterWithFreezes,
  getPersistedAvailableStreakFreezes,
  listStreakFreezeDayKeysForContributor,
} from "../state/streakFreezes"
import {
  getPersistedStreakLapseReminderInfo,
  setStreakLapseReminderEnabled,
} from "../state/streakLapseReminders"
import {
  buildStreakFreezeAvailabilityText,
  buildStreakLapseReminderText,
  findFreezableStreakGapDayKey,
} from "../lib/gamified-quests"
import type { ContributorQuestStreak, StreakFreezeDenialReason } from "../lib/gamified-quests"
import { useQuestStreakSync } from "../hooks/useQuestStreakSync"

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Denial reasons mapped to a short, actionable message for the "Use a grace day" action. */
const FREEZE_DENIAL_MESSAGES: Record<StreakFreezeDenialReason, string> = {
  "future-day": "That day hasn't happened yet.",
  "already-complete": "That day's mission was already completed.",
  "already-frozen": "That day is already frozen.",
  "no-freezes-available": "No streak freezes left in the rolling window.",
}

/** A contributor's grace-day standing: the missed day (if any) eligible for a freeze, and freezes remaining. */
interface StreakFreezeInfo {
  gapDayKey: string | null
  availableFreezes: number
}

function buildStreakFreezeInfo(contributorId: string, asOfDayKey: string): StreakFreezeInfo {
  const frozenDayKeys = listStreakFreezeDayKeysForContributor(contributorId)
  return {
    gapDayKey: findFreezableStreakGapDayKey(
      listDailyMissionResultsForContributor(contributorId),
      frozenDayKeys,
      asOfDayKey,
    ),
    availableFreezes: getPersistedAvailableStreakFreezes(contributorId, asOfDayKey),
  }
}

export interface QuestStreaksPanelProps {
  /**
   * A contributor id whose reminder opt-in and spent streak freezes sync to
   * their account across devices, typically derived from a real signed-in
   * session via `deriveContributorIdFromSessionIdentity`. Also highlighted
   * as "You" in the roster. This roster always shows every contributor —
   * this only syncs and highlights a matching row, it never filters the
   * others out.
   */
  signedInContributorId?: string
}

/**
 * Renders the Quest Streaks roster: every contributor with at least one
 * persisted daily mission result or streak freeze, their current and
 * longest streak, the last day they completed their mission, every streak
 * badge earned, and their streak-freeze standing — plus a "Run today's
 * mission check" action to compute and save a contributor's mission result
 * on demand.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function QuestStreaksPanel({ signedInContributorId }: QuestStreaksPanelProps = {}) {
  const [roster, setRoster] = useState<ContributorQuestStreak[] | null>(null)
  const [contributorId, setContributorId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [freezeError, setFreezeError] = useState<string | null>(null)

  const refresh = () => {
    setRoster(buildQuestStreakRosterWithFreezes(todayUtcDayKey()))
  }

  useEffect(() => {
    refresh()
  }, [])

  // Merges the signed-in visitor's own reminder opt-in/spent freezes down
  // from their account on mount, then refreshes the roster if that merge
  // actually changed anything locally.
  const { pushLocalState: pushQuestStreakSync } = useQuestStreakSync(signedInContributorId, refresh)

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

  const handleUseFreeze = (id: string, gapDayKey: string) => {
    const result = applyPersistedStreakFreeze(id, gapDayKey, todayUtcDayKey())
    if (!result.applied) {
      setFreezeError(`${id}: ${FREEZE_DENIAL_MESSAGES[result.reason]}`)
      return
    }
    setFreezeError(null)
    refresh()
    if (id === signedInContributorId) pushQuestStreakSync()
  }

  const handleToggleReminder = (id: string, enabled: boolean) => {
    setStreakLapseReminderEnabled(id, enabled)
    refresh()
    if (id === signedInContributorId) pushQuestStreakSync()
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
      {freezeError && <p className="mb-3 text-sm text-destructive">{freezeError}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contributor</TableHead>
            <TableHead className="text-right">Current streak</TableHead>
            <TableHead className="text-right">Longest streak</TableHead>
            <TableHead>Last completed</TableHead>
            <TableHead>Badges</TableHead>
            <TableHead>Streak freeze</TableHead>
            <TableHead>Reminder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((status) => {
            const today = todayUtcDayKey()
            const freezeInfo = buildStreakFreezeInfo(status.contributorId, today)
            const reminderInfo = getPersistedStreakLapseReminderInfo(status.contributorId, today)
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
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {buildStreakFreezeAvailabilityText(freezeInfo.availableFreezes)}
                    </p>
                    {freezeInfo.gapDayKey && freezeInfo.availableFreezes > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUseFreeze(status.contributorId, freezeInfo.gapDayKey!)}
                      >
                        Use a grace day for {freezeInfo.gapDayKey}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant={reminderInfo.enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleReminder(status.contributorId, !reminderInfo.enabled)}
                    >
                      {reminderInfo.enabled ? "🔔 Reminder on" : "🔕 Remind me"}
                    </Button>
                    {reminderInfo.enabled && reminderInfo.riskLength !== null && (
                      <p className="text-xs text-destructive">
                        {buildStreakLapseReminderText(reminderInfo.riskLength)}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
