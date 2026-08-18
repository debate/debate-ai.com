/**
 * @fileoverview Daily Best Card Challenge panel — closes follow-up (c), "a
 * challenge banner/widget UI", named under the "🕵️ Daily Best Card
 * Challenge" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list.
 *
 * Reads every persisted card contribution via `state/contributions.ts`'s
 * `getTodaysBestCardFromStore`/`buildDailyBestCardsFromStore` (themselves a
 * thin composition of `lib/daily-best-card.ts`'s pure day-grouping/winner
 * selection against the persisted Contributions Feed store) and renders
 * today's winner as a highlighted banner plus every past day's winner as a
 * history list — reusing the existing helpfulness scoring and day-grouping
 * directly rather than introducing new logic here.
 *
 * @module panels/DailyBestCardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import {
  buildDailyBestCardsFromStore,
  getTodaysBestCardFromStore,
  type AttributedDailyBestCard,
} from "../state/contributions"
import { buildDailyBestCardHighlight } from "../lib/daily-best-card"

/**
 * Renders the Daily Best Card Challenge: a banner for today's highest-scoring
 * card (if any was submitted today) plus a history list of every past day's
 * winner, most recent first.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function DailyBestCardPanel() {
  const [today, setToday] = useState<AttributedDailyBestCard | null | undefined>(undefined)
  const [history, setHistory] = useState<AttributedDailyBestCard[] | null>(null)

  useEffect(() => {
    setToday(getTodaysBestCardFromStore(Date.now()))
    setHistory(buildDailyBestCardsFromStore())
  }, [])

  if (today === undefined || history === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading daily best card…</div>
  }

  const pastDays = today ? history.filter((day) => day.dayKey !== today.dayKey) : history
  const orderedPastDays = [...pastDays].reverse()

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Daily Best Card Challenge</h1>
        <p className="text-sm text-muted-foreground">
          The highest-helpfulness card submitted today, plus every past day's winner.
        </p>
      </div>

      {today ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
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
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No card submitted today yet. Submit one in the Contributions Feed to compete for today's
          challenge.
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Past winners</h2>
        {orderedPastDays.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No past winners yet.</div>
        ) : (
          <div className="space-y-2">
            {orderedPastDays.map((day) => (
              <div
                key={day.dayKey}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <span className="text-sm text-foreground">{buildDailyBestCardHighlight(day)}</span>
                <Badge variant="outline">{day.contribution.contributorId}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
