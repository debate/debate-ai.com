/**
 * @fileoverview Pre-Round Briefings panel — the "(b) a briefing panel UI
 * that renders it on a round-information page" follow-up named in idea #12
 * ("Pre-Round Intelligence Panel") in TODO.md.
 *
 * Reads every persisted briefing via `state/preRoundBriefings.ts`'s
 * `buildPreRoundBriefingsPanelView` (a stable `roundId` sort of
 * `listPreRoundBriefings`) and renders each round's event summary, prior
 * head-to-head record, and briefing sections, with a "Clear" action per
 * round that calls the already-persisted `deletePreRoundBriefing` — no new
 * briefing-composition logic is introduced here.
 *
 * @module panels/PreRoundBriefingsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  buildPreRoundBriefingsPanelView,
  deletePreRoundBriefing,
} from "../state/preRoundBriefings"
import type { PreRoundBriefingRecord } from "../state/preRoundBriefings"

/**
 * Renders the Pre-Round Briefings panel: every persisted
 * `PreRoundBriefingRecord`, sorted by `roundId`, with a "Clear" action per
 * round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PreRoundBriefingsPanel() {
  const [briefings, setBriefings] = useState<PreRoundBriefingRecord[] | null>(null)

  useEffect(() => {
    setBriefings(buildPreRoundBriefingsPanelView())
  }, [])

  const refresh = () => setBriefings(buildPreRoundBriefingsPanelView())

  const handleClear = (roundId: string) => {
    deletePreRoundBriefing(roundId)
    refresh()
  }

  if (briefings === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading briefings…</div>
  }

  if (briefings.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No pre-round briefings yet. A briefing fills in once one is generated for a round.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Pre-Round Briefings</h1>
        <p className="text-sm text-muted-foreground">
          Opponent scouting, judge tendencies, head-to-head record, and prep notes, combined into
          one focused briefing per round.
        </p>
      </div>
      {briefings.map(({ roundId, briefing }) => (
        <div key={roundId} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Round {roundId}{" "}
              <span className="font-normal text-muted-foreground">
                — {briefing.event.tournamentName}, {briefing.event.division},{" "}
                {briefing.event.roundLabel}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="whitespace-nowrap">
                {briefing.priorMeetings.meetings === 0
                  ? "No prior meetings"
                  : `${briefing.priorMeetings.wins}-${briefing.priorMeetings.losses} vs. opponent`}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => handleClear(roundId)}>
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {briefing.sections.map((section) => (
              <div
                key={section.title}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <p className="mb-1 font-medium text-foreground">{section.title}</p>
                <p className="whitespace-pre-line text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
