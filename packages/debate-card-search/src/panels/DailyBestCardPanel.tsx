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
 * @module panels/DailyBestCardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { Button } from "debate-ui/src/primitives/button"
import {
  announceDailyBestCard,
  getAnnouncedDailyBestCard,
  getPersistedBestCardForDay,
  listAnnouncedDailyBestCards,
} from "../state/dailyBestCardAnnouncements"
import { buildDailyBestCardHighlight, type DailyBestCard } from "../lib/daily-best-card"

/** Renders one announced day's winner as a row. */
function AnnouncementRow({ announcement }: { announcement: DailyBestCard }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{buildDailyBestCardHighlight(announcement)}</div>
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
  const [today, setToday] = useState<DailyBestCard | null | undefined>(undefined)
  const [announcedToday, setAnnouncedToday] = useState<DailyBestCard | undefined>(undefined)
  const [history, setHistory] = useState<DailyBestCard[]>([])

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
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-dashed border-border p-4">
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{buildDailyBestCardHighlight(today)}</div>
                <div className="mt-1">
                  <span className="text-xs text-muted-foreground">not yet announced</span>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={handleAnnounce}>
              Announce today's winner
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No cards submitted yet today.</p>
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
