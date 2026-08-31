/**
 * @fileoverview Top Contributor Awards panel — the UI follow-up named as
 * "(c) an awards UI in `debate-card-search` that renders
 * `buildAwardsAnnouncementText`" under the "🏆 Top Contributor Awards" bullet
 * in TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * Reads every persisted contribution via `state/contributions.ts`'s
 * `buildTopContributorAwardsFromStore` (itself a thin composition of
 * `contributor-awards.ts`'s pure `buildTopContributorAwards` against the
 * persisted store) and renders one card per category winner — reusing the
 * existing per-category selection/scoring directly rather than introducing
 * new logic here.
 *
 * Also closes follow-up (b), "a scheduled job that periodically calls
 * `buildTopContributorAwards` and persists/announces the winners" — this
 * repo has no scheduled-job infrastructure, so (mirroring
 * `state/dailyBestCardAnnouncements.ts`'s identical "Daily Best Card
 * Challenge" pattern) an **Announce today's awards** action freezes the
 * current standings for the day via `state/contributorAwardAnnouncements.ts`.
 * Once a day is announced, the panel shows that frozen snapshot instead of
 * the live standings for the rest of the day.
 *
 * @module panels/ContributorAwardsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Award } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  announceContributorAwards,
  buildPersistedTopContributorAwards,
  getAnnouncedContributorAwards,
  listAnnouncedContributorAwards,
  type AnnouncedContributorAwards,
} from "../state/contributorAwardAnnouncements"
import { isContributorAwardsLiveUpdateStorageEvent } from "../state/live-update"
import type { ContributorAward } from "../lib/contributor-awards"

/** Renders one category winner card. */
function AwardCard({ award }: { award: ContributorAward }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Award className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{award.label}</div>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary" className="truncate">
            {award.contributorId}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {award.contributionCount} contribution{award.contributionCount === 1 ? "" : "s"} ·{" "}
          {award.totalHelpfulnessScore} pts
        </div>
      </div>
    </div>
  )
}

/** Renders one previously announced day's frozen award standings. */
function AnnouncementGroup({ announcement }: { announcement: AnnouncedContributorAwards }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {announcement.dayKey}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {announcement.awards.map((award) => (
          <AwardCard key={award.kind} award={award} />
        ))}
      </div>
    </div>
  )
}

/**
 * Renders the Top Contributor Awards: one category winner per
 * `ContributionKind` present among persisted contributions, ranked by total
 * helpfulness score within that category. An **Announce today's awards**
 * action freezes the current UTC day's standings; once announced, the panel
 * shows that frozen result instead of the live standings for the rest of the
 * day, plus the history of every previously announced day.
 *
 * Reads localStorage on mount, then live-updates when another same-origin
 * tab submits a contribution or announces awards (a `storage` event never
 * fires in the tab that made the write itself, only in others — see
 * `state/live-update.ts#isContributorAwardsLiveUpdateStorageEvent`). Renders
 * a loading state during SSR/hydration rather than throwing.
 */
export function ContributorAwardsPanel() {
  const [live, setLive] = useState<ContributorAward[] | null>(null)
  const [announcedToday, setAnnouncedToday] = useState<AnnouncedContributorAwards | undefined>(undefined)
  const [history, setHistory] = useState<AnnouncedContributorAwards[]>([])

  const refresh = () => {
    const now = Date.now()
    setLive(buildPersistedTopContributorAwards())
    setAnnouncedToday(getAnnouncedContributorAwards(new Date(now).toISOString().slice(0, 10)))
    setHistory(listAnnouncedContributorAwards())
  }

  useEffect(() => {
    refresh()
  }, [])

  /**
   * Live-update the displayed winners/history when another browser tab
   * submits a contribution or announces awards. Same-tab changes already
   * refresh via `handleAnnounce` below.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isContributorAwardsLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleAnnounce = () => {
    announceContributorAwards(Date.now())
    refresh()
  }

  if (live === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading awards…</div>
  }

  const awardsToShow = announcedToday?.awards ?? live
  const pastAnnouncements = history.filter((announcement) => announcement.dayKey !== announcedToday?.dayKey)

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Top Contributor Awards</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Current category winners, ranked by total helpfulness score within each contribution kind.
      </p>

      {awardsToShow.length === 0 ? (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No awards yet. Categories fill in as contributors submit cards, summaries, highlights,
          annotations, original arguments, and refutations.
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {awardsToShow.map((award) => (
            <AwardCard key={award.kind} award={award} />
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3 text-xs text-muted-foreground">
        {announcedToday ? (
          <span>Today's awards are announced and frozen.</span>
        ) : (
          <>
            <span>Not yet announced today.</span>
            <Button size="sm" onClick={handleAnnounce} disabled={live.length === 0}>
              Announce today's awards
            </Button>
          </>
        )}
      </div>

      <div className="mb-2 text-sm font-medium text-foreground">Announced history</div>
      {pastAnnouncements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prior days have been announced yet.</p>
      ) : (
        pastAnnouncements.map((announcement) => (
          <AnnouncementGroup key={announcement.dayKey} announcement={announcement} />
        ))
      )}
    </div>
  )
}
