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
 * A "Get AI script" action per drill calls `round/drill-script-client.ts`'s
 * `requestDrillScript` with that drill and its round's side, saves the
 * result via `saveDrillAiScript`, and renders it under the template prompt
 * — closing follow-up (b), "an actual AI-generated (rather than templated)
 * script."
 *
 * @module panels/DrillSetsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  buildDrillSetsPanelView,
  deleteDrillSet,
  saveDrillAiScript,
  type DrillSetRecord,
} from "../state/drillSets"
import type { DrillKind } from "../flow/drill-generator"
import { requestDrillScript } from "../round/drill-script-client"

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
  const [scriptLoadingKey, setScriptLoadingKey] = useState<string | null>(null)
  const [scriptErrorsByKey, setScriptErrorsByKey] = useState<Record<string, string>>({})

  useEffect(() => {
    setDrillSets(buildDrillSetsPanelView())
  }, [])

  const refresh = () => setDrillSets(buildDrillSetsPanelView())

  const handleClear = (roundId: string) => {
    deleteDrillSet(roundId)
    refresh()
  }

  const handleGetAiScript = async (set: DrillSetRecord, drillIndex: number) => {
    const key = `${set.roundId}:${drillIndex}`
    setScriptLoadingKey(key)
    setScriptErrorsByKey((prev) => {
      const { [key]: _removed, ...rest } = prev
      return rest
    })
    try {
      const script = await requestDrillScript({ sideKey: set.sideKey, drill: set.drills[drillIndex] })
      saveDrillAiScript(set.roundId, drillIndex, script)
      refresh()
    } catch (error) {
      setScriptErrorsByKey((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Failed to get AI script.",
      }))
    } finally {
      setScriptLoadingKey(null)
    }
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
            {set.drills.map((drill, index) => {
              const key = `${set.roundId}:${index}`
              const aiScript = set.aiScripts?.[index]
              return (
                <div key={index} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="whitespace-nowrap">
                        {DRILL_KIND_LABELS[drill.kind]}
                      </Badge>
                      <p className="text-foreground">{drill.prompt}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={scriptLoadingKey === key}
                      onClick={() => handleGetAiScript(set, index)}
                    >
                      {scriptLoadingKey === key
                        ? "Getting script…"
                        : aiScript
                          ? "Regenerate AI script"
                          : "Get AI script"}
                    </Button>
                  </div>
                  {scriptErrorsByKey[key] && (
                    <p className="mt-2 text-sm text-destructive">{scriptErrorsByKey[key]}</p>
                  )}
                  {aiScript && (
                    <p className="mt-2 whitespace-pre-wrap border-t border-border pt-2 text-sm text-foreground">
                      {aiScript}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
