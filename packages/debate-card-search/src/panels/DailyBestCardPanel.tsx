/**
 * @fileoverview Daily Best Card Challenge panel — the UI follow-up named as
 * "(c) a challenge banner/widget UI" under the "🕵️ Daily Best Card
 * Challenge" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list.
 *
 * Reads every persisted, timestamped card contribution via
 * `state/contributions.ts`'s `buildPersistedDailyBestCards` (itself a thin
 * composition of `lib/daily-best-card.ts`'s pure `buildDailyBestCards`
 * against the persisted store) and renders today's winner as a highlight
 * banner, plus every prior day's winner as a history list — reusing the
 * existing day-grouping/winner-picking/highlight-text logic directly rather
 * than introducing new scoring here.
 *
 * @module panels/DailyBestCardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import { buildPersistedDailyBestCards } from "../state/contributions"
import { buildDailyBestCardHighlight, getUtcDayKey, type DailyBestCard } from "../lib/daily-best-card"

/**
 * Renders the Daily Best Card Challenge: today's highest-helpfulness card
 * submission as a highlight banner, plus a history of every prior day's
 * winner, both derived from persisted, timestamped card contributions.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing. `now` defaults to the
 * render-time clock — this is a UI entry point, not a pure function.
 */
export function DailyBestCardPanel({ now = Date.now() }: { now?: number }) {
  const [bestCards, setBestCards] = useState<DailyBestCard[] | null>(null)

  useEffect(() => {
    setBestCards(buildPersistedDailyBestCards())
  }, [])

  if (bestCards === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading daily best cards…</div>
  }

  const todayKey = getUtcDayKey(now)
  const today = bestCards.find((best) => best.dayKey === todayKey) ?? null
  const priorDays = bestCards.filter((best) => best.dayKey !== todayKey).sort((a, b) => b.dayKey.localeCompare(a.dayKey))

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Daily Best Card Challenge</h1>
        <p className="text-sm text-muted-foreground">
          The community's highest-helpfulness card submission of each day, by likes, saves, and
          quality/reviewer signals.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        {today ? (
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Today's card of the day
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="truncate">
                  {today.contribution.id}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-foreground">{buildDailyBestCardHighlight(today)}</p>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            No card contributions submitted yet today. Submit one from the Contributions Feed to
            start today's challenge.
          </p>
        )}
      </div>

      {priorDays.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-foreground">Past winners</h2>
          <div className="space-y-2">
            {priorDays.map((best) => (
              <div
                key={best.dayKey}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <Badge variant="outline">{best.dayKey}</Badge>
                <span className="font-medium text-foreground">{best.contribution.id}</span>
                <span className="text-xs text-muted-foreground">
                  helpfulness {best.breakdown.helpfulnessScore}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
