/**
 * @fileoverview "AI outcome responses" dialog, opened from the speech timer's
 * menu. Sends the whole round so far (every prior speech and the cards read
 * in it, plus the flow) to the AI and shows three candidate approaches to
 * the current speech, each with an outline, the opponent's likely answers,
 * the predicted judge decision, the issues that could lose it, and an
 * estimated success rate. Each candidate's suggested card searches run
 * against CARDS in place and show the highlighted text of the top hits.
 *
 * @module dialogs/AiOutcomeResponsesDialog
 */

"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SpeechMenuAction } from "@debate/timer/src/recorder/SpeechRecordingPlayer"
import { Copy, ExternalLink, Loader2, Search, Sparkles, Trophy } from "lucide-react"
import type {
  SpeechOutcomeCandidate,
  SpeechOutcomeResponsesResult,
} from "@debate/speech-writer/src/prompts/speech-outcome-responses"
import { listJudgeProfiles } from "@debate/speech-writer/src/state/judgeProfiles"
import { getJudgeParadigm, listJudgeParadigms } from "@debate/speech-writer/src/judge/judge-paradigms"
import { buildCardsSearchHref } from "@debate/research-evidence/src/lib/search-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/primitives/dialog"
import { Button } from "../ui/primitives/button"
import { Textarea } from "../ui/primitives/textarea"
import { cn } from "../ui/lib/utils"
import { useFlowStore } from "../state/store"
import type { Flow, Round } from "../types/flow"
import {
  buildOutcomeRoundLabel,
  buildRoundFlowText,
  getOutcomeSpeechSide,
  getPriorSpeechNames,
  getRoundFlows,
  pickLikelyOutcomeJudge,
} from "../round/outcome-responses-context"
import {
  loadPriorSpeeches,
  requestSpeechOutcomeResponses,
  searchOutcomeCards,
  type OutcomeCardHit,
} from "../round/outcome-responses-client"

export interface AiOutcomeResponsesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The speech being prepared, e.g. `"2AC"`. */
  speechName: string
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => {})
}

function rateColor(rate: number): string {
  if (rate >= 60) return "bg-emerald-500"
  if (rate >= 40) return "bg-amber-500"
  return "bg-red-500"
}

function sideName(side: "aff" | "neg"): string {
  return side === "aff" ? "Aff" : "Neg"
}

type CardSearchState = { loading: boolean; hits?: OutcomeCardHit[]; error?: string }

function CardSearches({ queries }: { queries: string[] }) {
  const [searches, setSearches] = useState<Record<string, CardSearchState>>({})

  const run = async (query: string) => {
    setSearches((s) => ({ ...s, [query]: { loading: true } }))
    try {
      const hits = await searchOutcomeCards(query)
      setSearches((s) => ({ ...s, [query]: { loading: false, hits } }))
    } catch (e) {
      setSearches((s) => ({ ...s, [query]: { loading: false, error: e instanceof Error ? e.message : String(e) } }))
    }
  }

  if (queries.length === 0) return null
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Cards to find</h4>
      {queries.map((query) => {
        const state = searches[query]
        return (
          <div key={query} className="space-y-1">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => void run(query)}
                disabled={state?.loading}
              >
                {state?.loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                {query}
              </Button>
              <a
                href={buildCardsSearchHref({ q: query })}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
                title="Open this search in CARDS"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
            {state?.hits && state.hits.length === 0 && <p className="text-xs text-muted-foreground">No cards found.</p>}
            {state?.hits?.map((hit) => (
              <div key={hit.id} className="rounded border bg-muted/30 p-1.5 text-xs space-y-0.5">
                <div className="flex items-start gap-1">
                  <p className="flex-1 font-semibold">{hit.tag}</p>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    title="Copy card"
                    onClick={() => copyText(`${hit.tag}\n${hit.cite}\n${hit.highlighted}`)}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                {hit.cite && <p className="text-muted-foreground">{hit.cite}</p>}
                {hit.highlighted && (
                  <p className="line-clamp-4">
                    <mark className="bg-yellow-200/70 dark:bg-yellow-500/30 text-inherit">{hit.highlighted}</mark>
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </section>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="space-y-0.5">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h4>
      <ul className="list-disc pl-4 space-y-0.5 text-xs">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function CandidateCard({
  candidate,
  index,
  recommended,
  side,
}: {
  candidate: SpeechOutcomeCandidate
  index: number
  recommended: boolean
  side: "aff" | "neg"
}) {
  const winsForUs = candidate.judgeDecision.winner === side
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 min-w-0",
        recommended && "border-primary ring-1 ring-primary/40",
      )}
    >
      <header className="space-y-1">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold">
            {index + 1}. {candidate.title}
          </h3>
          {recommended && (
            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Trophy className="h-3 w-3" /> Best bet
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" title="Estimated chance this approach wins the round">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full", rateColor(candidate.successRate))} style={{ width: `${candidate.successRate}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums">{candidate.successRate}%</span>
        </div>
        <p className="text-xs text-muted-foreground">{candidate.strategy}</p>
      </header>

      <section className="space-y-0.5">
        <div className="flex items-center">
          <h4 className="flex-1 text-xs font-semibold uppercase text-muted-foreground">Outline</h4>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            title="Copy outline"
            onClick={() => copyText(`${candidate.title}\n${candidate.outline.map((b) => `• ${b}`).join("\n")}`)}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <ol className="list-decimal pl-4 space-y-0.5 text-xs">
          {candidate.outline.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ol>
      </section>

      <ListSection title="Opponent likely answers" items={candidate.opponentAnswers} />

      <section className="space-y-0.5">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Judge decision</h4>
        <p className="text-xs">
          <span className={cn("font-semibold", winsForUs ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {sideName(candidate.judgeDecision.winner)} wins
          </span>
          {candidate.judgeDecision.rationale && <> · {candidate.judgeDecision.rationale}</>}
        </p>
      </section>

      <ListSection title="Issues" items={candidate.issues} />
      <CardSearches queries={candidate.cardSearches} />
    </article>
  )
}

const AUTO_PARADIGM = "auto"

export function AiOutcomeResponsesDialog({ open, onOpenChange, speechName }: AiOutcomeResponsesDialogProps) {
  const { flows, rounds, selected } = useFlowStore()
  const flow: Flow | undefined = flows[selected]
  const round: Round | undefined = flow?.roundId != null ? rounds.find((r) => r.id === flow.roundId) : undefined

  const side = getOutcomeSpeechSide(speechName) ?? "aff"
  const priorNames = useMemo(() => (flow ? getPriorSpeechNames(flow.columns, speechName) : []), [flow, speechName])
  const likelyJudge = useMemo(
    () => (open ? pickLikelyOutcomeJudge(round?.judges ?? [], listJudgeProfiles()) : null),
    [open, round],
  )

  const [paradigmId, setParadigmId] = useState<string>(AUTO_PARADIGM)
  const [focus, setFocus] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpeechOutcomeResponsesResult | null>(null)
  const requestId = useRef(0)

  const judge = useMemo(() => {
    if (!likelyJudge) return null
    const override = paradigmId !== AUTO_PARADIGM ? getJudgeParadigm(paradigmId) : null
    return override ? { ...likelyJudge, paradigm: override } : likelyJudge
  }, [likelyJudge, paradigmId])

  const generate = useCallback(async () => {
    if (!flow || !judge) return
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const roundFlows = getRoundFlows(flow, flows)
      const priorSpeeches = await loadPriorSpeeches(flow, roundFlows, priorNames)
      const next = await requestSpeechOutcomeResponses({
        speechName,
        side,
        roundLabel: buildOutcomeRoundLabel(round),
        priorSpeeches,
        flowText: buildRoundFlowText(roundFlows),
        judge,
        focus,
      })
      if (id === requestId.current) setResult(next)
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : String(e))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [flow, flows, judge, priorNames, speechName, side, round, focus])

  // A new speech starts fresh; opening the dialog runs the first simulation.
  useEffect(() => {
    requestId.current++
    setResult(null)
    setError(null)
    setLoading(false)
  }, [speechName, flow?.id])

  useEffect(() => {
    if (open && !result && !loading && !error) void generate()
    // Only the open transition should auto-run; later runs are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI outcome responses · {speechName}
          </DialogTitle>
          <DialogDescription>
            Three ways to give this {sideName(side)} speech, each simulated against your opponent's likely answers
            and {judge ? `${judge.name} (${judge.paradigm.name})` : "the judge"}. Uses{" "}
            {priorNames.length === 0 ? "no prior speeches" : `${priorNames.join(", ")}`} and the round's flow.
          </DialogDescription>
        </DialogHeader>

        {!flow ? (
          <p className="text-sm text-muted-foreground">Open a flow to simulate this speech.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Judge paradigm</span>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-sm"
                  value={paradigmId}
                  onChange={(e) => setParadigmId(e.target.value)}
                >
                  <option value={AUTO_PARADIGM}>
                    Most likely{likelyJudge ? ` (${likelyJudge.paradigm.name})` : ""}
                  </option>
                  {listJudgeParadigms().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Focus (optional)</span>
                <Textarea
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="e.g. Go for the DA, I'm short on prep"
                  className="min-h-8 h-8 text-sm"
                />
              </label>
              <Button onClick={() => void generate()} disabled={loading} className="shrink-0">
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {result ? "Regenerate" : "Generate"}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {loading && !result && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading the round and simulating three speeches…
              </p>
            )}

            {result && (
              <div className={cn("grid gap-3 md:grid-cols-3", loading && "opacity-60")}>
                {result.candidates.map((candidate, i) => (
                  <CandidateCard
                    key={i}
                    candidate={candidate}
                    index={i}
                    recommended={i === result.recommendedIndex}
                    side={side}
                  />
                ))}
              </div>
            )}
            {result && (
              <p className="text-[11px] text-muted-foreground">
                Success rates are AI estimates from the flow, not guarantees. Check every card before you read it.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * The timer menu's "AI outcome responses" item plus the dialog it opens —
 * spread `action` into `SpeechRecordingMenu`'s `actions` and render `dialog`.
 */
export function useAiOutcomeResponsesAction(speechName: string): {
  action: SpeechMenuAction
  dialog: React.ReactNode
} {
  const [open, setOpen] = useState(false)
  return {
    action: {
      key: "ai-outcome-responses",
      label: "AI Outcome Responses",
      icon: <Sparkles className="h-4 w-4 mr-2" />,
      onSelect: () => setOpen(true),
    },
    dialog: <AiOutcomeResponsesDialog open={open} onOpenChange={setOpen} speechName={speechName} />,
  }
}
