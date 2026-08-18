/**
 * @fileoverview Daily Best Card Challenge banner/widget panel — closes
 * follow-up (c) ("a challenge banner/widget UI") of the "🕵️ Daily Best Card
 * Challenge" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list. It renders today's live leader among persisted card contributions and
 * an "Announce today's winner" action wired to
 * `state/dailyBestCardAnnouncements.ts`'s idempotent `announceDailyBestCard`
 * (closing follow-up (b), "persists/announces the day's winner"), plus the
 * history of previously announced daily winners.
 *
 * Both the live leader and the announced history are
 * `AttributedDailyBestCard`s, so every winner is rendered with the persisted
 * `contributorId` who submitted it alongside the existing helpfulness
 * scoring — reusing `state/contributions.ts`'s day-grouping/winner selection
 * directly rather than introducing new logic here.
 *
 * @module panels/DailyBestCardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Sparkles, Trophy } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  announceDailyBestCard,
  getAnnouncedDailyBestCard,
  getPersistedBestCardForDay,
  listAnnouncedDailyBestCards,
} from "../state/dailyBestCardAnnouncements"
import type { AttributedDailyBestCard } from "../state/contributions"
import { buildDailyBestCardHighlight } from "../lib/daily-best-card"

/** Renders one announced day's winner, with the contributor who submitted it. */
function AnnouncementRow({ announcement }: { announcement: AttributedDailyBestCard }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{buildDailyBestCardHighlight(announcement)}</div>
        <div className="mt-1">
          <Badge variant="outline">{announcement.contribution.contributorId}</Badge>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders today's live Daily Best Card leader, an action to freeze it as the
 * day's official announced winner, and the announced history.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function DailyBestCardPanel() {
  const [today, setToday] = useState<AttributedDailyBestCard | null | undefined>(undefined)
  const [announcedToday, setAnnouncedToday] = useState<AttributedDailyBestCard | undefined>(undefined)
  const [history, setHistory] = useState<AttributedDailyBestCard[]>([])

  const refresh = () => {
    const now = Date.now()
    setToday(getPersistedBestCardForDay(now))
    setAnnouncedToday(getAnnouncedDailyBestCard(new Date(now).toISOString().slice(0, 10)))
    setHistory(listAnnouncedDailyBestCards())
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleAnnounce = () => {
    announceDailyBestCard(Date.now())
    refresh()
  }

  if (today === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading today's leader…</div>
  }

  const pastAnnouncements = history.filter((announcement) => announcement.dayKey !== announcedToday?.dayKey)

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Daily Best Card Challenge</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Today's highest-helpfulness card among submitted evidence, and the history of previously announced
        daily winners.
      </p>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-2 text-sm font-medium text-foreground">Today's leader</div>
        {announcedToday ? (
          <AnnouncementRow announcement={announcedToday} />
        ) : today ? (
          <>
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Card of the day
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">{today.contribution.id}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{today.contribution.contributorId}</Badge>
                  <span>helpfulness {today.breakdown.helpfulnessScore}/100</span>
                  <span>{today.contribution.likes} likes</span>
                  <span>{today.contribution.saves} saves</span>
                  <span>not yet announced</span>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={handleAnnounce}>
              Announce today's winner
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No card submitted today yet. Submit one in the Contributions Feed to compete for today's
            challenge.
          </p>
        )}
      </div>

      <div className="mb-2 text-sm font-medium text-foreground">Announced history</div>
      {pastAnnouncements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prior days have been announced yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pastAnnouncements.map((announcement) => (
            <AnnouncementRow key={announcement.dayKey} announcement={announcement} />
          ))}
        </div>
      )}
    </div>
  )
}
