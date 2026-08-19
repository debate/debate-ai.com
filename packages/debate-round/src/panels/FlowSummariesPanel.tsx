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
 * Also renders a "Generate from raw speech text" form for the same idea's
 * follow-up (a): a round ID, speech label, and pasted transcript are sent
 * to `round/transcript-extraction-client.ts`'s `requestTranscriptExtraction`,
 * and the AI-extracted claim/warrant/impact/evidence arguments are appended
 * to that round's saved flow summary via `round/transcript-extraction-ai.ts`'s
 * `buildFlowRowSummariesFromExtraction`, so an extracted argument renders
 * exactly like one derived from a manually flowed grid.
 *
 * @module panels/FlowSummariesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  buildFlowSummariesPanelView,
  deleteFlowSummary,
  getFlowSummary,
  saveFlowSummary,
  type FlowSummaryRecord,
} from "../state/flowSummaries"
import {
  buildFlowSummaryTextFromRows,
  suggestCrossExamQuestions,
  suggestExtensionIdeas,
} from "../flow/flow-transcript-summary"
import { buildFlowRowSummariesFromExtraction } from "../round/transcript-extraction-ai"
import { requestTranscriptExtraction } from "../round/transcript-extraction-client"

/**
 * Renders the Speech Transcript Summaries panel: every persisted
 * `FlowSummaryRecord`, one card per round, with a "Clear" action per round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function FlowSummariesPanel() {
  const [records, setRecords] = useState<FlowSummaryRecord[] | null>(null)
  const [extractRoundId, setExtractRoundId] = useState("")
  const [extractSpeech, setExtractSpeech] = useState("")
  const [extractTranscriptText, setExtractTranscriptText] = useState("")
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  useEffect(() => {
    setRecords(buildFlowSummariesPanelView())
  }, [])

  const refresh = () => setRecords(buildFlowSummariesPanelView())

  const handleClear = (roundId: string) => {
    deleteFlowSummary(roundId)
    refresh()
  }

  const handleExtract = async () => {
    const roundId = extractRoundId.trim()
    const speech = extractSpeech.trim()
    const transcriptText = extractTranscriptText.trim()
    if (!roundId || !speech || !transcriptText) {
      setExtractError("Round ID, speech, and transcript text are all required.")
      return
    }

    setExtractLoading(true)
    setExtractError(null)
    try {
      const extractedArguments = await requestTranscriptExtraction({ speech, transcriptText })
      const existing = getFlowSummary(roundId)
      const startIndex = existing
        ? existing.summaries.reduce((max, row) => Math.max(max, row.rowIndex + 1), 0)
        : 0
      const newRows = buildFlowRowSummariesFromExtraction(speech, extractedArguments, startIndex)
      saveFlowSummary({
        roundId,
        summaries: [...(existing?.summaries ?? []), ...newRows],
      })
      setExtractSpeech("")
      setExtractTranscriptText("")
      refresh()
    } catch (e) {
      setExtractError(e instanceof Error ? e.message : "Transcript extraction failed.")
    } finally {
      setExtractLoading(false)
    }
  }

  if (records === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading flow summaries…</div>
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

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Generate from raw speech text</h2>
          <p className="text-sm text-muted-foreground">
            Paste a speech transcript and let AI extract its claims, warrants, impacts, and evidence
            into this round's flow summary — no manually flowed grid required.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="flow-summaries-extract-round-id">Round ID</Label>
            <Input
              id="flow-summaries-extract-round-id"
              value={extractRoundId}
              onChange={(e) => setExtractRoundId(e.target.value)}
              placeholder="round-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flow-summaries-extract-speech">Speech</Label>
            <Input
              id="flow-summaries-extract-speech"
              value={extractSpeech}
              onChange={(e) => setExtractSpeech(e.target.value)}
              placeholder="1AC"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flow-summaries-extract-transcript">Transcript text</Label>
          <Textarea
            id="flow-summaries-extract-transcript"
            value={extractTranscriptText}
            onChange={(e) => setExtractTranscriptText(e.target.value)}
            placeholder="Paste the speech's text here…"
            rows={5}
          />
        </div>

        {extractError && <p className="text-sm text-destructive">{extractError}</p>}

        <Button onClick={handleExtract} disabled={extractLoading}>
          {extractLoading ? "Extracting…" : "Extract with AI"}
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No flow summaries yet. Summaries fill in once a round's flow is derived into per-argument
          summaries and saved, or generated above from raw speech text.
        </div>
      ) : (
        records.map((record) => {
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
        })
      )}
    </div>
  )
}
