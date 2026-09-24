/**
 * @fileoverview The "Outcomes" view inside a speech on the watch page: what
 * the speaker could have said instead, and how the ballot would likely have
 * gone after each alternative.
 *
 * Nothing runs until the reader asks — each run is an AI request — and the
 * last run per speech and judge lens is kept in this browser (see
 * `state/speechOutcomeCache.ts`), so stepping back to a speech shows it
 * again. The view has three parts:
 *
 *   - **Win-probability chart.** One row for the speech as given and one per
 *     alternative, each a single aff/neg split bar with the 50% line marked,
 *     so a ballot that flips is visible at a glance. The swing badge is
 *     measured for the side that gave the speech (see {@link speakerSwing}).
 *   - **Alternative cards.** Strategy tag, outline in speaking order, the
 *     trade-off and the predicted RFD. The one that helps the speaker most is
 *     marked, and one whose ballot flips says so.
 *   - **Key clash** — what the decision turns on after this speech.
 *
 * Everything here is labelled as Claude's prediction. Ballots are not real
 * results, and the source it reasons from is a rough transcript.
 * @module components/watch/WatchSpeechOutcomes
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronDown, Copy, RefreshCw, Sparkles, Trophy } from "lucide-react"
import { ScrollArea } from "../../ui/primitives/scroll-area"
import type { RoundSpeech } from "../../lib/round-speeches"
import {
  DEFAULT_ALTERNATIVE_COUNT,
  DEFAULT_JUDGE_LENS,
  JUDGE_LENSES,
  MAX_ALTERNATIVES,
  MIN_ALTERNATIVES,
  bestAlternativeIndex,
  speakerSwing,
  speechOutcomesToMarkdown,
  swingSideLabel,
  type JudgeLens,
  type PredictedBallot,
  type SpeechOutcomeSimulation,
} from "../../lib/speech-outcomes"
import { requestSpeechOutcomes } from "../../lib/speech-outcomes-client"
import { readCachedSpeechOutcome, writeCachedSpeechOutcome } from "../../state/speechOutcomeCache"
import { SPEECH_SIDE_STYLES } from "./speech-side-styles"

/** Where the reader's judge lens is remembered. */
export const OUTCOME_LENS_STORAGE_KEY = "debate-videos:outcome-lens"

function readLens(): JudgeLens {
  try {
    const stored = window.localStorage.getItem(OUTCOME_LENS_STORAGE_KEY)
    return JUDGE_LENSES.some((lens) => lens.id === stored) ? (stored as JudgeLens) : DEFAULT_JUDGE_LENS
  } catch {
    return DEFAULT_JUDGE_LENS
  }
}

interface WatchSpeechOutcomesProps {
  videoId: string
  videoTitle?: string
  speeches: RoundSpeech[]
  /** Index of the speech being re-imagined. */
  index: number
  /** Tells the tab strip a run landed, so it can mark the speech. */
  onSimulated?: (speechKey: string) => void
}

type Status = { state: "idle" } | { state: "loading" } | { state: "error"; message: string }

export function WatchSpeechOutcomes({ videoId, videoTitle, speeches, index, onSimulated }: WatchSpeechOutcomesProps) {
  const speech = speeches[index]
  const [lens, setLensState] = useState<JudgeLens>(DEFAULT_JUDGE_LENS)
  const [count, setCount] = useState(DEFAULT_ALTERNATIVE_COUNT)
  const [simulation, setSimulation] = useState<SpeechOutcomeSimulation | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>({ state: "idle" })
  const [open, setOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLensState(readLens())
  }, [])

  const setLens = useCallback((value: JudgeLens) => {
    setLensState(value)
    try {
      window.localStorage.setItem(OUTCOME_LENS_STORAGE_KEY, value)
    } catch {
      // Storage blocked — the choice still holds for this page.
    }
  }, [])

  // A different speech or lens shows its own last run, and abandons any run
  // still in flight for the one being left.
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    const cached = speech ? readCachedSpeechOutcome(videoId, speech.key, lens) : null
    setSimulation(cached?.simulation ?? null)
    setSavedAt(cached?.savedAt ?? null)
    setStatus({ state: "idle" })
    setOpen(null)
  }, [videoId, speech, lens])

  useEffect(() => () => abortRef.current?.abort(), [])

  const run = async () => {
    if (!speech) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ state: "loading" })
    try {
      const result = await requestSpeechOutcomes(
        { videoTitle, speeches, index, lens, count },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      const now = Date.now()
      writeCachedSpeechOutcome({ videoId, speechKey: speech.key, lens, simulation: result, savedAt: now })
      setSimulation(result)
      setSavedAt(now)
      setStatus({ state: "idle" })
      setOpen(bestAlternativeIndex(speech.side, result))
      onSimulated?.(speech.key)
    } catch (error) {
      if (controller.signal.aborted) return
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) })
    }
  }

  const copy = async () => {
    if (!speech || !simulation) return
    try {
      await navigator.clipboard.writeText(speechOutcomesToMarkdown(speech, simulation, lens))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked; nothing useful to add.
    }
  }

  if (!speech) return null

  const loading = status.state === "loading"
  const best = simulation ? bestAlternativeIndex(speech.side, simulation) : -1
  const lensInfo = JUDGE_LENSES.find((option) => option.id === lens) ?? JUDGE_LENSES[0]
  const swingFor = swingSideLabel(speech.side)

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
        <label className="sr-only" htmlFor="outcome-lens">
          Judge
        </label>
        <select
          id="outcome-lens"
          value={lens}
          onChange={(event) => setLens(event.target.value as JudgeLens)}
          disabled={loading}
          title={lensInfo.description}
          className="h-6 rounded-md border border-border bg-background px-1.5 text-[11px]"
        >
          {JUDGE_LENSES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="outcome-count">
          Alternatives
        </label>
        <select
          id="outcome-count"
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          disabled={loading}
          className="h-6 rounded-md border border-border bg-background px-1.5 text-[11px] tabular-nums"
        >
          {Array.from({ length: MAX_ALTERNATIVES - MIN_ALTERNATIVES + 1 }, (_, i) => MIN_ALTERNATIVES + i).map((n) => (
            <option key={n} value={n}>
              {n} alternatives
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          {simulation && (
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[11px] hover:bg-accent transition-colors"
              aria-label="Copy outcomes as Markdown"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {simulation ? (
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {loading ? "Simulating…" : simulation ? "Run again" : "Simulate"}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-3" aria-live="polite" aria-busy={loading}>
          {status.state === "error" && (
            <p role="alert" className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {status.message}
            </p>
          )}

          {loading && !simulation && <OutcomeSkeleton rows={count} />}

          {!simulation && !loading && status.state !== "error" && (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <p>
                What else could the <span className="font-medium text-foreground">{speech.label}</span> have done?
                Claude drafts {count} alternative {speech.side === "cx" ? "lines of questioning" : "responses"} and
                predicts how a {lensInfo.label.toLowerCase()} would vote after each, next to the speech as it was
                given.
              </p>
              <p className="text-[11px]">{lensInfo.description}</p>
            </div>
          )}

          {simulation && (
            <div className={`space-y-3 ${loading ? "opacity-50" : ""}`}>
              <section aria-label="Predicted win probability" className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>Aff win chance</span>
                  <span>Swing for {swingFor}</span>
                </div>
                <BallotBar label="As given" ballot={simulation.actual.ballot} emphasis />
                {simulation.alternatives.map((alternative, i) => (
                  <BallotBar
                    key={i}
                    label={`${i + 1}. ${alternative.title}`}
                    ballot={alternative.ballot}
                    swing={speakerSwing(speech.side, simulation.actual.ballot, alternative.ballot)}
                    best={i === best}
                    onClick={() => setOpen(i)}
                  />
                ))}
              </section>

              <section className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold">As given</h4>
                  <WinnerChip ballot={simulation.actual.ballot} />
                </div>
                <p className="text-xs">{simulation.actual.assessment}</p>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium">RFD:</span> {simulation.actual.ballot.rfd}
                </p>
              </section>

              <ol className="space-y-1.5">
                {simulation.alternatives.map((alternative, i) => {
                  const swing = speakerSwing(speech.side, simulation.actual.ballot, alternative.ballot)
                  const flips = alternative.ballot.winner !== simulation.actual.ballot.winner
                  const isOpen = open === i
                  return (
                    <li key={i} className={`rounded-md border ${i === best ? "border-primary/50" : "border-border"}`}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : i)}
                        className="flex w-full items-start gap-2 p-2 text-left hover:bg-accent/40 transition-colors"
                      >
                        <span className="mt-px text-[11px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="block text-xs font-medium leading-snug">{alternative.title}</span>
                          <span className="flex flex-wrap items-center gap-1">
                            <span className="rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                              {alternative.approach}
                            </span>
                            {i === best && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-px text-[10px] text-primary">
                                <Trophy className="h-2.5 w-2.5" /> Strongest
                              </span>
                            )}
                            {flips && (
                              <span className="rounded bg-amber-500/15 px-1 py-px text-[10px] text-amber-700 dark:text-amber-300">
                                Ballot flips
                              </span>
                            )}
                          </span>
                        </span>
                        <SwingBadge swing={swing} side={swingFor} />
                        <ChevronDown
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="space-y-2 border-t border-border px-2.5 py-2">
                          {alternative.outline.length > 0 && (
                            <ul className="list-disc space-y-0.5 pl-4 text-xs">
                              {alternative.outline.map((line, j) => (
                                <li key={j}>{line}</li>
                              ))}
                            </ul>
                          )}
                          {alternative.tradeoff && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium">Trade-off:</span> {alternative.tradeoff}
                            </p>
                          )}
                          <div className="flex items-start gap-2 rounded bg-muted/40 p-1.5">
                            <WinnerChip ballot={alternative.ballot} />
                            <p className="text-[11px] text-muted-foreground">{alternative.ballot.rfd}</p>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>

              {simulation.keyClash.length > 0 && (
                <section className="space-y-1">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Key clash</h4>
                  <ul className="flex flex-wrap gap-1">
                    {simulation.keyClash.map((item, i) => (
                      <li key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      <p className="flex items-start gap-1 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground shrink-0">
        <Sparkles className="mt-px h-3 w-3 shrink-0" />
        <span>
          Simulated responses and ballots are Claude's predictions from a rough transcript, not real results. Each run
          is a new AI request{savedAt ? `; this one was saved in this browser ${new Date(savedAt).toLocaleString()}` : ""}.
        </span>
      </p>
    </div>
  )
}

function WinnerChip({ ballot }: { ballot: PredictedBallot }) {
  const chance = ballot.winner === "aff" ? ballot.affWinProbability : 100 - ballot.affWinProbability
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold tabular-nums ${SPEECH_SIDE_STYLES[ballot.winner].solid}`}
    >
      {ballot.winner.toUpperCase()} {chance}%
    </span>
  )
}

function SwingBadge({ swing, side }: { swing: number; side: string }) {
  const tone =
    swing > 0
      ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300"
      : swing < 0
        ? "text-rose-700 bg-rose-500/10 dark:text-rose-300"
        : "text-muted-foreground bg-muted"
  return (
    <span className={`shrink-0 rounded px-1 py-px text-[10px] font-semibold tabular-nums ${tone}`} title={`Change in ${side}'s win chance versus the speech as given`}>
      {swing > 0 ? "+" : swing < 0 ? "−" : "±"}
      {Math.abs(swing)}
    </span>
  )
}

interface BallotBarProps {
  label: string
  ballot: PredictedBallot
  swing?: number
  emphasis?: boolean
  best?: boolean
  onClick?: () => void
}

/** One row of the chart: an aff/neg split bar with the 50% line marked. */
function BallotBar({ label, ballot, swing, emphasis, best, onClick }: BallotBarProps) {
  const aff = ballot.affWinProbability
  const Row = onClick ? "button" : "div"
  return (
    <Row
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`grid w-full grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-2 text-left ${onClick ? "rounded hover:bg-accent/40" : ""}`}
      aria-label={`${label}: affirmative ${aff}%, negative ${100 - aff}%${swing !== undefined ? `, swing ${swing}` : ""}`}
    >
      <span className={`truncate text-[11px] ${emphasis ? "font-semibold" : ""} ${best ? "text-primary" : ""}`} title={label}>
        {label}
      </span>
      <span className="relative flex h-3 overflow-hidden rounded-sm bg-muted" aria-hidden>
        <span className={`${SPEECH_SIDE_STYLES.aff.dot} transition-[width] duration-500`} style={{ width: `${aff}%` }} />
        <span className={`${SPEECH_SIDE_STYLES.neg.dot} flex-1 opacity-80`} />
        <span className="absolute inset-y-0 left-1/2 w-px bg-background" />
      </span>
      <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground" aria-hidden>
        {swing === undefined ? `${aff}%` : `${swing > 0 ? "+" : swing < 0 ? "−" : "±"}${Math.abs(swing)}`}
      </span>
    </Row>
  )
}

function OutcomeSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 animate-pulse motion-reduce:animate-none" aria-label="Simulating">
      {Array.from({ length: rows + 1 }, (_, i) => (
        <div key={i} className="grid grid-cols-[7rem_1fr] gap-2">
          <div className="h-3 rounded bg-muted" />
          <div className="h-3 rounded bg-muted" />
        </div>
      ))}
      <div className="h-16 rounded-md bg-muted" />
    </div>
  )
}
