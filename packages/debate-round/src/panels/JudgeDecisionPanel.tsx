/**
 * @fileoverview AI Judge Decision panel — the UI half of follow-up (a)
 * under idea #5 ("AI Judge Decision Modes") in TODO.md's Product Feature
 * Ideas list: "an AI judge-decision call that uses
 * `buildJudgeParadigmPrompt` output instead of (or alongside) the existing
 * static `judgeDecisionPrompt`".
 *
 * Lets a user request an AI verdict for a round that already has a saved
 * flow summary (`/summaries`) and judge paradigm selection (`/paradigms`):
 * `round/judge-decision-from-stores.ts`'s `buildJudgeDecisionAiInputFromStores`
 * composes those two persisted stores into a request, which
 * `round/judge-decision-client.ts`'s `requestJudgeDecision` sends to the
 * existing `/api/reason-ai` Anthropic proxy. The resulting verdict is
 * persisted via `state/judgeDecisions.ts` and rendered alongside every
 * other persisted decision. A round missing either prerequisite, or a
 * malformed/failed AI response, shows an inline error instead of crashing
 * the panel — no new judge-decision logic beyond composing the pieces
 * above is introduced here.
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
import { buildJudgeDecisionAiInputFromStores } from "../round/judge-decision-from-stores"
import {
  buildJudgeDecisionsPanelView,
  deleteJudgeDecision,
  saveJudgeDecision,
  type JudgeDecisionRecord,
} from "../state/judgeDecisions"

type FormState = { roundId: string; sideA: string; sideB: string }

const EMPTY_FORM: FormState = { roundId: "", sideA: "Affirmative", sideB: "Negative" }

/**
 * Renders the AI Judge Decision panel: a form to request a round's AI
 * verdict, plus every persisted verdict with a "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function JudgeDecisionPanel() {
  const [records, setRecords] = useState<JudgeDecisionRecord[] | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setRecords(buildJudgeDecisionsPanelView())
  }, [])

  const refresh = () => setRecords(buildJudgeDecisionsPanelView())

  const handleGetDecision = async () => {
    const roundId = form.roundId.trim()
    const sideA = form.sideA.trim()
    const sideB = form.sideB.trim()
    if (!roundId) {
      setError("Round ID is required.")
      return
    }
    if (!sideA || !sideB) {
      setError("Both side labels are required.")
      return
    }

    const input = buildJudgeDecisionAiInputFromStores(roundId, [sideA, sideB])
    if (!input) {
      setError(
        `Round "${roundId}" needs a saved flow summary (see Speech Transcript Summaries) and a ` +
          "saved judge paradigm (see Judge Paradigm Picker) before an AI decision can be requested.",
      )
      return
    }

    setError(null)
    setIsLoading(true)
    try {
      const verdict = await requestJudgeDecision(input)
      saveJudgeDecision({ roundId, paradigm: input.paradigm, sideLabels: [sideA, sideB], verdict })
      setForm(EMPTY_FORM)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI judge decision failed.")
    } finally {
      setIsLoading(false)
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
          Request an AI verdict for a round under its saved judge paradigm, weighing the round's
          saved flow summary.
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
            <Label htmlFor="judge-decision-side-a">Side A label</Label>
            <Input
              id="judge-decision-side-a"
              value={form.sideA}
              onChange={(e) => setForm((prev) => ({ ...prev, sideA: e.target.value }))}
              placeholder="Affirmative"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="judge-decision-side-b">Side B label</Label>
            <Input
              id="judge-decision-side-b"
              value={form.sideB}
              onChange={(e) => setForm((prev) => ({ ...prev, sideB: e.target.value }))}
              placeholder="Negative"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button disabled={isLoading} onClick={handleGetDecision}>
          {isLoading ? "Deciding…" : "Get AI decision"}
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No AI judge decisions yet. Request one above to see it here.
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.roundId} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Round {record.roundId}</span>
                  <Badge variant="outline">{record.paradigm.name}</Badge>
                  <Badge variant="secondary">Winner: {record.verdict.winner}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                  Clear
                </Button>
              </div>
              <p className="text-sm text-foreground">{record.verdict.ballotText}</p>
              <ul className="space-y-1">
                {record.verdict.reasoning.map((reason, index) => (
                  <li
                    key={index}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
