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
 * real AI verdict, and appends the result to that round's history log via
 * `hooks/useJudgeDecisions.ts` (`state/judgeDecisions.ts`) — closing idea
 * #5's "(b) a decision history log per round instead of only the latest
 * result" follow-up: every requested decision for a round is now kept and
 * shown, newest-first, instead of overwriting the round's prior verdict.
 * No new decision logic is introduced here — this panel only wires the
 * already-composed pieces together and renders the result.
 *
 * A `?roundId=` query param (read via `next/navigation`'s `useSearchParams`)
 * pre-fills the Round ID field — the deep link
 * `debate-speech-writer`'s `buildJudgeDecisionDeepLink` builds for the
 * "Get AI judge decision →" link on each saved selection in
 * `JudgeParadigmPickerPanel.tsx`, closing the
 * `docs/features/judge-paradigm-selections.md` Known gap that picking a
 * paradigm had no path into actually requesting a decision for it, mirroring
 * `debate-card-search`'s `EvidenceLibraryPanel`/`?checkUrl=` convention.
 *
 * @module panels/JudgeDecisionPanel
 */

"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "debate-round/src/ui/primitives/badge"
import { Button } from "debate-round/src/ui/primitives/button"
import { Input } from "debate-round/src/ui/primitives/input"
import { Label } from "debate-round/src/ui/primitives/label"
import { EmptyState } from "debate-round/src/ui/panels/panel-shell"
import { listJudgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms"
import { requestJudgeDecision } from "../round/judge-decision-client"
import { buildJudgeDecisionInputForParadigm, buildJudgeDecisionInputFromStores } from "../round/judge-decision-store-wiring"
import { generateJudgeDecisionBatchId, type JudgeDecisionRecord } from "../state/judgeDecisions"
import { useJudgeDecisions } from "../hooks/useJudgeDecisions"

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

const PANEL_PARADIGMS = listJudgeParadigms()

/**
 * Renders the AI Judge Decision panel: a form to request an AI decision for
 * a round under its saved judge paradigm, plus every persisted decision,
 * each with a "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function JudgeDecisionPanel() {
  const searchParams = useSearchParams()
  const { groups, synced, appendDecision, deleteDecision, deleteRoundHistory } = useJudgeDecisions()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedParadigmIds, setSelectedParadigmIds] = useState<string[]>([])
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelError, setPanelError] = useState<string | null>(null)

  useEffect(() => {
    const roundId = searchParams?.get("roundId")
    if (roundId) setForm((prev) => ({ ...prev, roundId }))
  }, [searchParams])

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
      appendDecision({
        roundId,
        paradigmName: sources.input.paradigm.name,
        sideNames: sources.input.sideNames,
        result,
        generatedAt: Date.now(),
      })
      setForm(EMPTY_FORM)
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI judge decision failed.")
    } finally {
      setLoading(false)
    }
  }

  const toggleParadigm = (id: string) => {
    setSelectedParadigmIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]))
  }

  const handleRunPanel = async () => {
    const roundId = form.roundId.trim()
    if (!roundId) {
      setPanelError("Round ID is required.")
      return
    }
    if (selectedParadigmIds.length < 2) {
      setPanelError("Select at least 2 paradigms to run a multi-judge panel.")
      return
    }
    const sideNames = {
      primary: form.primarySideName.trim() || "Primary",
      secondary: form.secondarySideName.trim() || "Secondary",
    }
    const selectedParadigms = PANEL_PARADIGMS.filter((paradigm) => selectedParadigmIds.includes(paradigm.id))

    setPanelLoading(true)
    setPanelError(null)
    try {
      const batchId = generateJudgeDecisionBatchId()
      for (const paradigm of selectedParadigms) {
        const sources = buildJudgeDecisionInputForParadigm(roundId, paradigm, sideNames)
        if (!sources.ok) {
          setPanelError(`Missing ${MISSING_SOURCE_LABEL[sources.missing[0]]} for round "${roundId}".`)
          return
        }
        const result = await requestJudgeDecision(sources.input)
        appendDecision({
          roundId,
          paradigmName: paradigm.name,
          sideNames,
          result,
          generatedAt: Date.now(),
          batchId,
        })
      }
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "Multi-judge panel run failed.")
    } finally {
      setPanelLoading(false)
    }
  }

  if (groups === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading judge decisions…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">AI Judge Decision</h1>
        <p className="text-sm text-muted-foreground">
          Get an AI-generated decision for a round, judged under its saved paradigm from the Judge
          Paradigm Picker and its saved flow from Speech Transcript Summaries. Every decision
          requested for a round is kept as history, newest first.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {synced ? "Decision history is synced to your account." : "Sign in to sync your decision history."}
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

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Multi-judge panel</h2>
          <p className="text-xs text-muted-foreground">
            Judge the round above under two or more paradigms at once and see a combined decision,
            using the Round ID and side names entered above.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {PANEL_PARADIGMS.map((paradigm) => (
            <label key={paradigm.id} className="flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-3.5 w-3.5"
                checked={selectedParadigmIds.includes(paradigm.id)}
                onChange={() => toggleParadigm(paradigm.id)}
              />
              {paradigm.name}
            </label>
          ))}
        </div>

        {panelError && <p className="text-sm text-destructive">{panelError}</p>}

        <Button onClick={handleRunPanel} disabled={panelLoading} variant="secondary">
          {panelLoading ? "Running panel…" : "Run multi-judge panel"}
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No AI judge decisions yet." message="Request one above to see it here." />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.roundId} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-foreground">
                  Round {group.roundId} <span className="text-muted-foreground">({group.decisions.length})</span>
                </h2>
                <Button size="sm" variant="ghost" onClick={() => deleteRoundHistory(group.roundId)}>
                  Clear all history for this round
                </Button>
              </div>
              {group.historyItems.map((item) =>
                item.kind === "single" ? (
                  <DecisionCard key={item.decision.id} record={item.decision} onClear={() => deleteDecision(item.decision.id)} />
                ) : (
                  <div key={item.batchId} className="rounded-lg border-2 border-border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Multi-judge panel ({item.decisions.length} paradigms)
                        </Badge>
                        <Badge>
                          {item.combined.winner === "split"
                            ? "Split decision"
                            : `${item.combined.winner === "primary" ? item.decisions[0]!.sideNames.primary : item.decisions[0]!.sideNames.secondary} wins ${item.combined.winner === "primary" ? item.combined.primaryVotes : item.combined.secondaryVotes}-${item.combined.winner === "primary" ? item.combined.secondaryVotes : item.combined.primaryVotes}`}
                        </Badge>
                        {item.combined.unanimous && <Badge variant="outline">Unanimous</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => item.decisions.forEach((decision) => deleteDecision(decision.id))}
                      >
                        Clear this panel run
                      </Button>
                    </div>
                    <div>
                      <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                        Combined key voting issues
                      </h3>
                      <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
                        {item.combined.keyVotingIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                            <th className="py-1 pr-3">Paradigm</th>
                            <th className="py-1 pr-3">Vote</th>
                            <th className="py-1">Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.decisions.map((decision) => (
                            <tr key={decision.id} className="border-b border-border/50 align-top">
                              <td className="py-1.5 pr-3 font-medium text-foreground">{decision.paradigmName}</td>
                              <td className="py-1.5 pr-3">
                                {decision.result.winner === "primary" ? decision.sideNames.primary : decision.sideNames.secondary}
                              </td>
                              <td className="py-1.5 text-muted-foreground">{decision.result.rationale}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DecisionCard({ record, onClear }: { record: JudgeDecisionRecord; onClear: () => void }) {
  const winnerName = record.result.winner === "primary" ? record.sideNames.primary : record.sideNames.secondary
  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{new Date(record.generatedAt).toLocaleString()}</span>
          <Badge variant="outline">{record.paradigmName}</Badge>
          <Badge>{winnerName} wins</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Key Voting Issues</h3>
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
}
