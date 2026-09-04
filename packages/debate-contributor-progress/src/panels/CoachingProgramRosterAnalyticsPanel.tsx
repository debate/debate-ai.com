/**
 * @fileoverview Coaching Program Roster Analytics panel — the "coach-facing
 * roster analytics dashboard (completion rates, streaks, standings in one
 * place)" follow-up named under idea #13 ("Coaching Programs and Group
 * Challenges") in TODO.md.
 *
 * Lets a coach pick one of their persisted coaching programs
 * (`debate-team-collaboration`'s `state/coachingPrograms.ts`) and renders
 * every roster member's group-challenge standing and daily-quest streak in
 * one table, via `state/coachingProgramRosterAnalytics.ts`'s
 * `buildPersistedCoachingProgramRosterAnalytics` — closing the gap where a
 * coach previously had to visit the Group Challenges panel and this
 * package's own Quest Streaks panel separately to see the same information
 * for a squad.
 *
 * Also subscribes to the browser's `storage` event via
 * `state/live-update.ts`'s `isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent`,
 * so a challenge created/completed, a win recorded, or a mission result
 * saved in another browser tab refreshes this panel's rendered roster here
 * too — the `storage` event never fires in the tab that made the write,
 * only in other tabs.
 *
 * @module panels/CoachingProgramRosterAnalyticsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-research-evidence/src/ui/primitives/table"
import { isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import { buildCoachingProgramsPanelView } from "debate-team-collaboration/src/state/coachingPrograms"
import type { CoachingProgramConfig } from "debate-team-collaboration/src/round/coaching-program"
import { buildPersistedCoachingProgramRosterAnalytics } from "../state/coachingProgramRosterAnalytics"
import type { CoachingProgramRosterMemberAnalytics } from "../lib/coaching-program-roster-analytics"

/**
 * Renders the Coaching Program Roster Analytics panel: a program picker
 * (every persisted `CoachingProgramConfig`) plus a table of the selected
 * program's roster, each row showing that member's group-challenge standing
 * (challenges completed/participated, how many they're leading) and
 * daily-quest streak (current, longest, badges) side by side.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function CoachingProgramRosterAnalyticsPanel() {
  const [programs, setPrograms] = useState<CoachingProgramConfig[] | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [analytics, setAnalytics] = useState<CoachingProgramRosterMemberAnalytics[]>([])

  const refresh = (programId: string) => {
    setPrograms(buildCoachingProgramsPanelView())
    setAnalytics(programId ? buildPersistedCoachingProgramRosterAnalytics(programId, Date.now()) ?? [] : [])
  }

  useEffect(() => {
    const initialPrograms = buildCoachingProgramsPanelView()
    setPrograms(initialPrograms)
    const initialProgramId = initialPrograms[0]?.id ?? ""
    setSelectedProgramId(initialProgramId)
    if (initialProgramId) {
      setAnalytics(buildPersistedCoachingProgramRosterAnalytics(initialProgramId, Date.now()) ?? [])
    }
  }, [])

  /**
   * Live-update the roster analytics when another browser tab creates a
   * program, changes a challenge, records a win, or saves a mission result.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent(event)) return
      refresh(selectedProgramId)
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [selectedProgramId])

  const handleSelectProgram = (programId: string) => {
    setSelectedProgramId(programId)
    setAnalytics(programId ? buildPersistedCoachingProgramRosterAnalytics(programId, Date.now()) ?? [] : [])
  }

  if (programs === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading roster analytics…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Roster Analytics</h1>
        <p className="text-sm text-muted-foreground">
          A coaching program's group-challenge standings and daily-quest streaks, side by side, for
          the whole squad.
        </p>
      </div>

      {programs.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No coaching programs yet. Create one above to see its roster analytics here.
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label htmlFor="roster-analytics-program" className="text-sm font-medium text-foreground">
              Coaching program
            </label>
            <select
              id="roster-analytics-program"
              value={selectedProgramId}
              onChange={(e) => handleSelectProgram(e.target.value)}
              className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
            >
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>

          {analytics.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              This program has no roster members yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Current streak</TableHead>
                  <TableHead className="text-right">Longest streak</TableHead>
                  <TableHead>Streak badges</TableHead>
                  <TableHead className="text-right">Challenges completed</TableHead>
                  <TableHead className="text-right">Challenges leading</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.map((row) => (
                  <TableRow key={row.contributorId}>
                    <TableCell className="font-medium">{row.contributorId}</TableCell>
                    <TableCell className="text-right">
                      {row.questStreak.streak.currentStreak > 0
                        ? `🔥 ${row.questStreak.streak.currentStreak}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.questStreak.streak.longestStreak}
                    </TableCell>
                    <TableCell>
                      {row.questStreak.earnedBadges.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.questStreak.earnedBadges.map((badge) => (
                            <Badge key={badge} variant="outline" className="whitespace-nowrap">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.challengeStanding.challengesParticipated === 0
                        ? "—"
                        : `${row.challengeStanding.challengesCompleted}/${row.challengeStanding.challengesParticipated}`}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.challengeStanding.challengesLeading > 0 ? (
                        <Badge variant="default">🏆 {row.challengeStanding.challengesLeading}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  )
}
