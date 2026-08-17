/**
 * @fileoverview Practice Drills panel — the UI follow-up named "(a) a
 * drill-panel UI that reads/writes through the persistence store" under the
 * "📚 AI Drill Generator" bullet in TODO.md.
 *
 * Reads every persisted drill set via `state/drillSets.ts`'s
 * `buildDrillSetsPanelView` (a stable-order sort of `listDrillSets`) and
 * renders each round's drills grouped by round, with a "Clear" action that
 * calls the already-persisted `deleteDrillSet` — no new drill-generation
 * logic is introduced here.
 *
 * @module panels/DrillSetsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { buildDrillSetsPanelView, deleteDrillSet, type DrillSetRecord } from "../state/drillSets"
import type { DrillKind } from "../flow/drill-generator"

const DRILL_KIND_LABELS: Record<DrillKind, string> = {
  overview: "Overview",
  frontline: "Frontline",
  cross_ex: "Cross-Ex",
  collapse: "Collapse",
}

/**
 * Renders the Practice Drills panel: every persisted `DrillSetRecord`,
 * grouped by round, with a "Clear" action per round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function DrillSetsPanel() {
  const [drillSets, setDrillSets] = useState<DrillSetRecord[] | null>(null)

  useEffect(() => {
    setDrillSets(buildDrillSetsPanelView())
  }, [])

  const refresh = () => setDrillSets(buildDrillSetsPanelView())

  const handleClear = (roundId: string) => {
    deleteDrillSet(roundId)
    refresh()
  }

  if (drillSets === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading drills…</div>
  }

  if (drillSets.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No practice drills yet. Drills fill in once a round's flow generates a drill set.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Practice Drills</h1>
        <p className="text-sm text-muted-foreground">
          Quick practice drills generated from each round's flow — overview, frontline, cross-ex,
          and collapse-scenario prompts.
        </p>
      </div>
      {drillSets.map((set) => (
        <div key={set.roundId} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Round {set.roundId}{" "}
              <span className="font-normal text-muted-foreground">({set.sideKey})</span>
            </h2>
            <Button size="sm" variant="ghost" onClick={() => handleClear(set.roundId)}>
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {set.drills.map((drill, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Badge variant="outline" className="whitespace-nowrap">
                  {DRILL_KIND_LABELS[drill.kind]}
                </Badge>
                <p className="text-foreground">{drill.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
