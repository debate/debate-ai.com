/**
 * @fileoverview AI Coach Mode panel — the UI follow-up named "(b) a
 * coaching-panel UI that reads/writes through the persistence store" under
 * the "🎙️ AI Coach Mode" bullet in TODO.md.
 *
 * Reads every persisted coaching session via `state/coachingSessions.ts`'s
 * `buildCoachingSessionsPanelView` (a stable-order sort of
 * `listCoachingSessions`) and renders each round+side's prompts grouped
 * together, with a "Clear" action that calls the already-persisted
 * `deleteCoachingSession` — no new coaching-prompt generation logic is
 * introduced here.
 *
 * @module panels/CoachingSessionsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  buildCoachingSessionsPanelView,
  deleteCoachingSession,
  type CoachingSessionRecord,
} from "../state/coachingSessions"
import type { CoachingPromptKind } from "../flow/coach-mode"

const COACHING_PROMPT_KIND_LABELS: Record<CoachingPromptKind, string> = {
  extension: "Extension",
  refutation: "Refutation",
  collapse: "Collapse",
  weighing: "Weighing",
}

/**
 * Renders the AI Coach Mode panel: every persisted `CoachingSessionRecord`,
 * grouped by round + side, with a "Clear" action per session.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function CoachingSessionsPanel() {
  const [sessions, setSessions] = useState<CoachingSessionRecord[] | null>(null)

  useEffect(() => {
    setSessions(buildCoachingSessionsPanelView())
  }, [])

  const refresh = () => setSessions(buildCoachingSessionsPanelView())

  const handleClear = (roundId: string, sideKey: string) => {
    deleteCoachingSession(roundId, sideKey)
    refresh()
  }

  if (sessions === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading coaching sessions…</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No coaching sessions yet. Sessions fill in once a round's flow generates extension,
        refutation, collapse, and weighing prompts for a side.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">AI Coach Mode</h1>
        <p className="text-sm text-muted-foreground">
          Coaching prompts generated from each round's flow — what to extend, what to answer,
          where to collapse, and how to weigh the round.
        </p>
      </div>
      {sessions.map((session) => (
        <div key={`${session.roundId}:${session.sideKey}`} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Round {session.roundId}{" "}
              <span className="font-normal text-muted-foreground">({session.sideKey})</span>
            </h2>
            <Button size="sm" variant="ghost" onClick={() => handleClear(session.roundId, session.sideKey)}>
              Clear
            </Button>
          </div>
          <div className="space-y-2">
            {session.prompts.map((prompt, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Badge variant="outline" className="whitespace-nowrap">
                  {COACHING_PROMPT_KIND_LABELS[prompt.kind]}
                </Badge>
                <p className="text-foreground">{prompt.prompt}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
