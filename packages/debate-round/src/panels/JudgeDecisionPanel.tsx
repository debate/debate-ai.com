/**
 * @fileoverview AI Judge Decision panel — the AI judge-decision-call UI for
 * idea #5's ("AI Judge Decision Modes") follow-up (a) in TODO.md: "an AI
 * judge-decision call that uses `buildJudgeParadigmPrompt` output instead
 * of (or alongside) the existing static `judgeDecisionPrompt`."
 *
 * Given a round ID and side labels, resolves the round's already-persisted
 * flow summary (`state/flowSummaries.ts`) and judge-paradigm selection
 * (`debate-speech-writer`'s `state/judgeParadigmSelections.ts`) via
 * `round/judge-decision-store-wiring.ts`'s `buildJudgeDecisionInputFromStores`,
 * calls `round/judge-decision-client.ts`'s `requestJudgeDecision` for a
 * real AI verdict, and saves the result through `state/judgeDecisions.ts`.
 * No new decision logic is introduced here — this panel only wires the
 * already-composed pieces together and renders the result.
 *
 * @module panels/JudgeDecisionPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { requestJudgeDecision } from "../round/judge-decision-client"
import { buildJudgeDecisionInputFromStores } from "../round/judge-decision-store-wiring"
import {
  buildJudgeDecisionsPanelView,
  deleteJudgeDecision,
  saveJudgeDecision,
  type JudgeDecisionRecord,
} from "../state/judgeDecisions"

type FormState = {
  roundId: string
  primarySideName: string
  secondarySideName: string
}

const EMPTY_FORM: FormState = { roundId: "", primarySideName: "Affirmative", secondarySideName: "Negative" }

const MISSING_SOURCE_LABEL: Record<string, string> = {
  flowSummary: "a saved flow summary (Speech Transcript Summaries)",
  judgeParadigm: "a saved judge paradigm (Judge Paradigm Picker)",
}

/**
 * Renders the AI Judge Decision panel: a form to request an AI decision for
 * a round under its saved judge paradigm, plus every persisted decision,
 * each with a "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function JudgeDecisionPanel() {
  const [records, setRecords] = useState<JudgeDecisionRecord[] | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRecords(buildJudgeDecisionsPanelView())
  }, [])

  const refresh = () => setRecords(buildJudgeDecisionsPanelView())

  const handleGetDecision = async () => {
    const roundId = form.roundId.trim()
    if (!roundId) {
      setError("Round ID is required.")
      return
    }
    const primaryName = form.primarySideName.trim() || "Primary"
    const secondaryName = form.secondarySideName.trim() || "Secondary"

    const sources = buildJudgeDecisionInputFromStores(roundId, {
      primary: primaryName,
      secondary: secondaryName,
    })
    if (!sources.ok) {
      setError(
        `Missing ${sources.missing.map((source) => MISSING_SOURCE_LABEL[source]).join(" and ")} for round "${roundId}".`,
      )
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await requestJudgeDecision(sources.input)
      saveJudgeDecision({
        roundId,
        paradigmName: sources.input.paradigm.name,
        sideNames: sources.input.sideNames,
        result,
        generatedAt: Date.now(),
      })
      setForm(EMPTY_FORM)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI judge decision failed.")
    } finally {
      setLoading(false)
    }
  }

  const handleClear = (roundId: string) => {
    deleteJudgeDecision(roundId)
    refresh()
  }

  if (records === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading judge decisions…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">AI Judge Decision</h1>
        <p className="text-sm text-muted-foreground">
          Get an AI-generated decision for a round, judged under its saved paradigm from the Judge
          Paradigm Picker and its saved flow from Speech Transcript Summaries.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="judge-decision-round-id">Round ID</Label>
            <Input
              id="judge-decision-round-id"
              value={form.roundId}
              onChange={(e) => setForm((prev) => ({ ...prev, roundId: e.target.value }))}
              placeholder="round-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-decision-primary">Primary side name</Label>
            <Input
              id="judge-decision-primary"
              value={form.primarySideName}
              onChange={(e) => setForm((prev) => ({ ...prev, primarySideName: e.target.value }))}
              placeholder="Affirmative"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-decision-secondary">Secondary side name</Label>
            <Input
              id="judge-decision-secondary"
              value={form.secondarySideName}
              onChange={(e) => setForm((prev) => ({ ...prev, secondarySideName: e.target.value }))}
              placeholder="Negative"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleGetDecision} disabled={loading}>
          {loading ? "Asking the AI judge…" : "Get AI judge decision"}
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No AI judge decisions yet. Request one above to see it here.
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const winnerName =
              record.result.winner === "primary" ? record.sideNames.primary : record.sideNames.secondary
            return (
              <div key={record.roundId} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Round {record.roundId}</span>
                    <Badge variant="outline">{record.paradigmName}</Badge>
                    <Badge>{winnerName} wins</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                    Clear
                  </Button>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Key Voting Issues
                  </h3>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
                    {record.result.keyVotingIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Rationale</h3>
                  <p className="text-sm text-foreground">{record.result.rationale}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
