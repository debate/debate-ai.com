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
 * Also renders a "Recent challenge results" digest below the roster table —
 * idea #13's own further follow-up ("a digest notification summarizing
 * challenge results instead of requiring a panel visit"), scoped to this
 * program's own roster rather than the feed-wide announcement
 * `state/newsStream.ts`'s `groupChallengeNews()` already posts — via
 * `state/coachingProgramRosterAnalytics.ts`'s
 * `buildPersistedCoachingProgramChallengeDigest`.
 *
 * Also subscribes to the browser's `storage` event via
 * `state/live-update.ts`'s `isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent`,
 * so a challenge created/completed, a win recorded, a mission result saved,
 * or a sprint note logged in another browser tab refreshes this panel's
 * rendered roster, digest, and calendar here too — the `storage` event never
 * fires in the tab that made the write, only in other tabs.
 *
 * Also renders a "Program calendar" section — idea #13's own further
 * follow-up ("a calendar/schedule view across a program's drills, sprints,
 * and challenges") — a chronological list of the program's roster-scoped
 * group-challenge start/end dates, plus (once a topic is typed) that
 * topic's sprint-note dates, via `state/coachingProgramCalendar.ts`'s
 * `buildPersistedCoachingProgramCalendar`.
 *
 * @module panels/CoachingProgramRosterAnalyticsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
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
import { buildChallengeCompletionAnnouncementText } from "debate-team-collaboration/src/lib/group-challenges"
import type { CompletedGroupChallengeEvent } from "debate-team-collaboration/src/state/challengeWinEvents"
import {
  buildPersistedCoachingProgramChallengeDigest,
  buildPersistedCoachingProgramRosterAnalytics,
} from "../state/coachingProgramRosterAnalytics"
import { buildPersistedCoachingProgramCalendar } from "../state/coachingProgramCalendar"
import type { CoachingProgramRosterMemberAnalytics } from "../lib/coaching-program-roster-analytics"
import {
  groupCoachingProgramCalendarEventsByDay,
  type CoachingProgramCalendarDay,
  type CoachingProgramCalendarEventKind,
} from "../lib/coaching-program-calendar"

/** How many of the digest's most recent challenge results to render at once. */
const MAX_VISIBLE_DIGEST_ENTRIES = 10

const CALENDAR_EVENT_KIND_LABELS: Record<CoachingProgramCalendarEventKind, string> = {
  "challenge-start": "Challenge starts",
  "challenge-end": "Challenge ends",
  "sprint-note": "Sprint note",
}

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
  const [challengeDigest, setChallengeDigest] = useState<CompletedGroupChallengeEvent[]>([])
  const [calendarTopic, setCalendarTopic] = useState("")
  const [calendarDays, setCalendarDays] = useState<CoachingProgramCalendarDay[]>([])

  const refreshCalendar = (programId: string, topic: string) => {
    const events = programId ? buildPersistedCoachingProgramCalendar(programId, topic) ?? [] : []
    setCalendarDays(groupCoachingProgramCalendarEventsByDay(events))
  }

  const refresh = (programId: string) => {
    setPrograms(buildCoachingProgramsPanelView())
    setAnalytics(programId ? buildPersistedCoachingProgramRosterAnalytics(programId, Date.now()) ?? [] : [])
    setChallengeDigest(programId ? buildPersistedCoachingProgramChallengeDigest(programId) ?? [] : [])
    refreshCalendar(programId, calendarTopic)
  }

  useEffect(() => {
    const initialPrograms = buildCoachingProgramsPanelView()
    setPrograms(initialPrograms)
    const initialProgramId = initialPrograms[0]?.id ?? ""
    setSelectedProgramId(initialProgramId)
    if (initialProgramId) {
      setAnalytics(buildPersistedCoachingProgramRosterAnalytics(initialProgramId, Date.now()) ?? [])
      setChallengeDigest(buildPersistedCoachingProgramChallengeDigest(initialProgramId) ?? [])
      refreshCalendar(initialProgramId, "")
    }
  }, [])

  /**
   * Live-update the roster analytics, digest, and calendar when another
   * browser tab creates a program, changes a challenge, records a win,
   * saves a mission result, or logs a sprint note.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent(event)) return
      refresh(selectedProgramId)
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [selectedProgramId, calendarTopic])

  const handleSelectProgram = (programId: string) => {
    setSelectedProgramId(programId)
    setAnalytics(programId ? buildPersistedCoachingProgramRosterAnalytics(programId, Date.now()) ?? [] : [])
    setChallengeDigest(programId ? buildPersistedCoachingProgramChallengeDigest(programId) ?? [] : [])
    refreshCalendar(programId, calendarTopic)
  }

  const handleCalendarTopicChange = (topic: string) => {
    setCalendarTopic(topic)
    refreshCalendar(selectedProgramId, topic)
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

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Recent challenge results</h2>
            {challengeDigest.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No completed group challenges for this program's roster yet.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {challengeDigest.slice(0, MAX_VISIBLE_DIGEST_ENTRIES).map((entry) => (
                  <li key={entry.challengeId} className="rounded-md border border-border/60 px-3 py-2">
                    <span className="text-muted-foreground">
                      {new Date(entry.completedAt).toLocaleDateString()}
                    </span>
                    {" — "}
                    {buildChallengeCompletionAnnouncementText(entry)}
                  </li>
                ))}
              </ul>
            )}
            {challengeDigest.length > MAX_VISIBLE_DIGEST_ENTRIES ? (
              <p className="text-xs text-muted-foreground">
                Showing the {MAX_VISIBLE_DIGEST_ENTRIES} most recent of {challengeDigest.length} results.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Program calendar</h2>
            <p className="text-sm text-muted-foreground">
              This program's group-challenge start/end dates. Type a topic below to also include that
              topic's sprint notes.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="roster-analytics-calendar-topic" className="text-sm font-medium text-foreground">
                Topic (optional, for sprint notes)
              </label>
              <Input
                id="roster-analytics-calendar-topic"
                value={calendarTopic}
                onChange={(e) => handleCalendarTopicChange(e.target.value)}
                placeholder="e.g. Warming"
                className="max-w-sm"
              />
            </div>
            {calendarDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No dated events yet — no group challenges scoped to this roster, and no sprint notes
                for the typed topic.
              </p>
            ) : (
              <ul className="space-y-2">
                {calendarDays.map((day) => (
                  <li key={day.dayKey} className="rounded-md border border-border/60 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">
                      {new Date(`${day.dayKey}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC" })}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {day.events.map((event, index) => (
                        <li key={`${event.kind}-${index}`} className="flex flex-wrap items-start gap-2 text-sm">
                          <Badge variant={event.kind === "sprint-note" ? "secondary" : "outline"}>
                            {CALENDAR_EVENT_KIND_LABELS[event.kind]}
                          </Badge>
                          <span className="text-muted-foreground">
                            {event.label}
                            {event.detail ? ` — ${event.detail}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
