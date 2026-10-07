/**
 * @fileoverview Modal for grading one speech against the five-category rubric
 * (`round/speech-rubric.ts`). A 1–5 slider per category drives a live radar
 * chart and the /25 total; grades save to the round (`Round.speechGrades`)
 * as the sliders move, so closing the modal never loses a score.
 */

"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ChevronRight, ClipboardCopy, Info, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/primitives/dialog"
import { Button } from "../ui/primitives/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/primitives/tooltip"
import { Textarea } from "../ui/primitives/textarea"
import { useFlowStore } from "../state/store"
import type { Round } from "../types/flow"
import {
  MAX_TOTAL,
  RUBRIC_CATEGORIES,
  SCORE_LABELS,
  SCORE_MAX,
  SCORE_MIN,
  clampScore,
  defaultScores,
  normalizeScores,
  radarPoints,
  scorecardText,
  totalLabel,
  totalScore,
  type RubricScores,
} from "../round/speech-rubric"

const SIZE = 260
const CENTER = SIZE / 2
const RADIUS = 88

function polar(index: number, count: number, fraction: number, radius = RADIUS) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return [CENTER + Math.cos(angle) * radius * fraction, CENTER + Math.sin(angle) * radius * fraction] as const
}

/** Five-spoke radar; each ring is one score point, so the centre is 0. */
export function RubricRadar({ scores, label }: { scores: RubricScores; label: string }) {
  const points = radarPoints(scores)
  const n = points.length
  const polygon = points.map((p, i) => polar(i, n, p.score / SCORE_MAX).join(",")).join(" ")
  const summary = points.map((p) => `${p.label} ${p.score}`).join(", ")
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto aspect-square w-full max-w-[300px]"
      role="img"
      aria-label={`${label} radar chart: ${summary}`}
    >
      {Array.from({ length: SCORE_MAX }, (_, ring) => (
        <polygon
          key={ring}
          points={points.map((_, i) => polar(i, n, (ring + 1) / SCORE_MAX).join(",")).join(" ")}
          fill="none"
          className="stroke-border"
          strokeWidth={ring === SCORE_MAX - 1 ? 1.5 : 1}
        />
      ))}
      {points.map((_, i) => {
        const [x, y] = polar(i, n, 1)
        return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} className="stroke-border" />
      })}
      <polygon points={polygon} className="fill-primary/20 stroke-primary" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => {
        const [x, y] = polar(i, n, p.score / SCORE_MAX)
        return <circle key={p.id} cx={x} cy={y} r={3.5} className="fill-primary" />
      })}
      {points.map((p, i) => {
        const [x, y] = polar(i, n, 1, RADIUS + 16)
        const anchor = Math.abs(x - CENTER) < 4 ? "middle" : x > CENTER ? "start" : "end"
        return (
          <text
            key={p.id}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={10.5}
            className="fill-muted-foreground"
          >
            {p.label}
          </text>
        )
      })}
    </svg>
  )
}

interface SpeechGradeDialogProps {
  round: Round
  /** The speech being graded, e.g. "1AC". */
  speechName: string
  /** Who gave it, shown in the title when known (an email or name). */
  speakerLabel?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SpeechGradeDialog({ round, speechName, speakerLabel, open, onOpenChange }: SpeechGradeDialogProps) {
  const updateRound = useFlowStore((s) => s.updateRound)
  // The store is the source of truth: read the live round, not the prop copy.
  const live = useFlowStore((s) => s.rounds.find((r) => r.id === round.id)) ?? round
  const saved = live.speechGrades?.[speechName]
  const scores = normalizeScores(saved?.scores)
  const notes = saved?.notes ?? ""
  const baseId = useId()

  // Notes are typed locally and flushed on a short debounce so a keystroke
  // doesn't rewrite the whole rounds blob.
  const [draft, setDraft] = useState(notes)
  const lastSaved = useRef(notes)
  useEffect(() => {
    if (open) {
      setDraft(notes)
      lastSaved.current = notes
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, speechName])

  const save = (nextScores: RubricScores, nextNotes: string) => {
    const current = useFlowStore.getState().rounds.find((r) => r.id === round.id)
    updateRound(round.id, {
      speechGrades: {
        ...current?.speechGrades,
        [speechName]: { scores: nextScores, notes: nextNotes, updatedAt: Date.now() },
      },
    })
  }

  useEffect(() => {
    if (!open || draft === lastSaved.current) return
    const timer = setTimeout(() => {
      lastSaved.current = draft
      save(scores, draft)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, open])

  // Flush pending notes when the modal closes mid-debounce.
  const handleOpenChange = (next: boolean) => {
    if (!next && draft !== lastSaved.current) {
      lastSaved.current = draft
      save(scores, draft)
    }
    onOpenChange(next)
  }

  const total = totalScore(scores)
  const title = speakerLabel ? `${speechName} · ${speakerLabel}` : speechName

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scorecardText(title, scores, draft))
      toast.success("Scorecard copied")
    } catch {
      toast.error("Couldn't copy the scorecard")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Grade {title}</DialogTitle>
          <DialogDescription>
            Score each category on its own, 1–5. Excellent cards without explanation can earn a 5 in Evidence and a 2
            in Analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="flex flex-col items-center gap-2">
            <RubricRadar scores={scores} label={title} />
            <div aria-live="polite" className="text-center">
              <div className="text-3xl font-bold tabular-nums">
                {total}
                <span className="text-base font-medium text-muted-foreground"> / {MAX_TOTAL}</span>
              </div>
              <div className="text-sm font-semibold text-primary">{totalLabel(total)}</div>
              <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(total / MAX_TOTAL) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {RUBRIC_CATEGORIES.map((c, i) => {
              const value = scores[c.id]
              const inputId = `${baseId}-${c.id}`
              return (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold tracking-wider text-primary">0{i + 1}</span>
                    <label htmlFor={inputId} className="text-sm font-semibold">
                      {c.title}
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`About ${c.title}`}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">{c.tip}</TooltipContent>
                    </Tooltip>
                    <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">
                      {value} · {SCORE_LABELS[value]}
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">{c.question}</p>
                  <input
                    id={inputId}
                    type="range"
                    min={SCORE_MIN}
                    max={SCORE_MAX}
                    step={1}
                    value={value}
                    onChange={(e) => save({ ...scores, [c.id]: clampScore(e.target.value) }, draft)}
                    className="h-2 w-full cursor-pointer accent-[var(--primary,currentColor)]"
                    aria-valuetext={`${value}, ${SCORE_LABELS[value]}`}
                  />
                  <div className="mt-0.5 flex justify-between px-0.5 text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n}>{n}</span>
                    ))}
                  </div>
                  <details className="group mt-2 border-t pt-2 text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                      <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                      Criteria and examples
                    </summary>
                    <dl className="mt-2 grid gap-2">
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Grades only</dt>
                        <dd>{c.grades}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Does not grade</dt>
                        <dd>{c.excludes}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold">5 — Exceptional</dt>
                        <dd>{c.five}</dd>
                        <dd className="mt-1 italic text-muted-foreground">{c.example5}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold">3 — Competent</dt>
                        <dd>{c.three}</dd>
                        <dd className="mt-1 italic text-muted-foreground">{c.example3}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-2">
          <label htmlFor={`${baseId}-notes`} className="text-sm font-semibold">
            Judge notes
          </label>
          <Textarea
            id={`${baseId}-notes`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Record decisive strengths, weaknesses, and one actionable next step…"
            className="min-h-24"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft("")
              lastSaved.current = ""
              save(defaultScores(), "")
              toast("Rubric reset")
            }}
          >
            <RotateCcw /> Reset
          </Button>
          <Button type="button" onClick={copy}>
            <ClipboardCopy /> Copy scorecard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
