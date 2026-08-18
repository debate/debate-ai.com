/**
 * @fileoverview Speech Transcript Summaries panel — the UI follow-up named
 * "(b) a summary/cross-ex panel UI in debate-round that renders
 * buildFlowSummaryText/suggestCrossExamQuestions/suggestExtensionIdeas ...
 * and reads/writes through the persistence store" under idea #6 ("Speech
 * Transcript Summaries and Answers") in TODO.md.
 *
 * Reads every persisted flow summary via `state/flowSummaries.ts`'s
 * `buildFlowSummariesPanelView` (a stable-order sort of `listFlowSummaries`)
 * and renders each round's per-argument summary text alongside suggested
 * cross-examination questions and extension ideas for anything still
 * unanswered, with a "Clear" action that calls the already-persisted
 * `deleteFlowSummary` — no new summary-derivation logic is introduced here.
 *
 * @module panels/FlowSummariesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import {
  buildFlowSummariesPanelView,
  deleteFlowSummary,
  type FlowSummaryRecord,
} from "../state/flowSummaries"
import {
  buildFlowSummaryTextFromRows,
  suggestCrossExamQuestions,
  suggestExtensionIdeas,
} from "../flow/flow-transcript-summary"

/**
 * Renders the Speech Transcript Summaries panel: every persisted
 * `FlowSummaryRecord`, one card per round, with a "Clear" action per round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function FlowSummariesPanel() {
  const [records, setRecords] = useState<FlowSummaryRecord[] | null>(null)

  useEffect(() => {
    setRecords(buildFlowSummariesPanelView())
  }, [])

  const refresh = () => setRecords(buildFlowSummariesPanelView())

  const handleClear = (roundId: string) => {
    deleteFlowSummary(roundId)
    refresh()
  }

  if (records === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading flow summaries…</div>
  }

  if (records.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No flow summaries yet. Summaries fill in once a round's flow is
        derived into per-argument summaries and saved.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Speech Transcript Summaries</h1>
        <p className="text-sm text-muted-foreground">
          Per-argument summaries derived from each round's flow, with suggested
          cross-examination questions and extension ideas for anything still unanswered.
        </p>
      </div>
      {records.map((record) => {
        const rows = record.summaries.filter((row) => !row.isHeading)
        const unanswered = rows.filter((row) => row.isUnanswered)
        const crossExamQuestions = suggestCrossExamQuestions(rows)
        const extensionIdeas = suggestExtensionIdeas(rows)

        return (
          <div key={record.roundId} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Round {record.roundId}</h2>
              <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                Clear
              </Button>
            </div>
            <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
              {buildFlowSummaryTextFromRows(rows)}
            </pre>
            {unanswered.length > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Cross-Examination Questions
                  </h3>
                  <ul className="space-y-1.5">
                    {crossExamQuestions.map((question, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
                      >
                        <Badge variant="outline" className="whitespace-nowrap">Q</Badge>
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Extension Ideas
                  </h3>
                  <ul className="space-y-1.5">
                    {extensionIdeas.map((idea, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
                      >
                        <Badge variant="outline" className="whitespace-nowrap">Ext</Badge>
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
