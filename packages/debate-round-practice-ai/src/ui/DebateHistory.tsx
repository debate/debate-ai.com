/**
 * @fileoverview Debate history — a list of the signed-in user's past
 * Practice vs AI rounds, reachable from the bot picker.
 *
 * Not part of the upstream port: `practice_vs_ai_debates` already keeps a
 * full transcript per round (see `apps/debate-ai.com/lib/practice-vs-ai/store.ts`),
 * but nothing surfaced it, so a finished round was effectively unreadable
 * again after leaving the scorecard. This screen lists every saved round
 * (topic, opponent, result, date) and expands one in place to show its full
 * transcript, reusing the same `GET /api/vsbot/history` response instead of
 * a second per-debate fetch.
 *
 * An expanded round shows its saved **Coach debrief** above the transcript,
 * when the scorecard kept one (`DebateVsBotRecord.debrief`), and the Judge
 * feedback style its verdict was written in (`judgeFeedbackStyle`), when
 * the round was judged after that was stored.
 *
 * Above the list, "Fallacy hints across your speeches" runs the offline
 * fallacy heuristic over the user's own speeches in those same rows
 * (`practiceDebateUserSpeeches`); nothing extra is fetched or stored.
 *
 * @module ui/DebateHistory
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { resolveResultStatus, type DebateVsBotRecord } from "../backend"
import { DEFAULT_COACH_PERSONA_ID, resolveCoachPersona } from "@debate-ai/speech-writer"
import { Button } from "@debate-ai/speech-writer/src/ui/primitives/button"
import { FallacyFrequencySummary } from "@debate-ai/speech-writer/src/ui/FallacyFrequencySummary"
import { listDebateHistory } from "../client"
import { practiceDebateUserSpeeches } from "./history-fallacy-speeches"

export interface DebateHistoryProps {
  /** Where the client fetches from. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
  /** Called when the user asks to return to the bot picker. */
  onBack: () => void
  /** A round to open expanded on arrival (a `?debate=` deep link). */
  initialExpandedId?: string | null
}

/** A short, colored label for a round's outcome. Empty outcome means "still in progress". */
function resultBadge(outcome: string | undefined): { label: string; className: string } {
  if (!outcome) return { label: "In progress", className: "bg-muted text-muted-foreground" }
  if (outcome === "User conceded") return { label: "Conceded", className: "bg-red-500/15 text-red-600" }

  switch (resolveResultStatus(outcome)) {
    case "win":
      return { label: "Won", className: "bg-green-500/15 text-green-600" }
    case "loss":
      return { label: "Lost", className: "bg-red-500/15 text-red-600" }
    case "draw":
      return { label: "Draw", className: "bg-yellow-500/15 text-yellow-600" }
    default:
      return { label: "In progress", className: "bg-muted text-muted-foreground" }
  }
}

function formatDate(createdAt: number): string {
  return new Date(createdAt * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/** The Coach debrief the scorecard kept with a round. */
function SavedDebrief({ debrief }: { debrief: NonNullable<DebateVsBotRecord["debrief"]> }) {
  const persona = resolveCoachPersona(debrief.personaId)
  return (
    <section
      aria-label="Coach debrief"
      data-testid="debate-history-debrief"
      className="mt-3 rounded-md bg-muted p-3"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Coach debrief</h3>
        {persona.id !== DEFAULT_COACH_PERSONA_ID && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {persona.name} coach
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{debrief.text}</p>
    </section>
  )
}

export function DebateHistory({ apiBaseUrl, onBack, initialExpandedId = null }: DebateHistoryProps) {
  const [debates, setDebates] = useState<DebateVsBotRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId)
  const userSpeeches = useMemo(() => practiceDebateUserSpeeches(debates ?? []), [debates])

  useEffect(() => {
    let cancelled = false
    listDebateHistory({ baseUrl: apiBaseUrl })
      .then((result) => {
        if (!cancelled) setDebates(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load debate history")
      })
    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-wide text-foreground">Debate History</h1>
        <Button variant="outline" onClick={onBack}>
          Back to picker
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!error && debates === null && <p className="text-sm text-muted-foreground">Loading your past debates…</p>}
      {!error && debates !== null && debates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No debates yet — finish a round against an AI opponent to see it here.
        </p>
      )}

      {!error && debates !== null && debates.length > 0 && (
        <section
          aria-labelledby="debate-history-fallacy-heading"
          className="mb-4 space-y-2 rounded-md border border-border bg-card p-3 shadow-sm"
        >
          <h2 id="debate-history-fallacy-heading" className="text-sm font-semibold text-foreground">
            Fallacy hints across your speeches
          </h2>
          <p className="text-xs text-muted-foreground">
            Counted from your own speeches in the rounds below; the opponent&apos;s speeches are left out.
          </p>
          <FallacyFrequencySummary
            speeches={userSpeeches}
            emptyMessage="None of these rounds has a speech of yours yet — send one in a round to see how often the fallacy hints fire."
          />
        </section>
      )}

      <div className="flex flex-col gap-3">
        {debates?.map((debate) => {
          const badge = resultBadge(debate.outcome)
          const isExpanded = expandedId === debate.id
          return (
            <div
              key={debate.id}
              ref={debate.id === initialExpandedId ? (node) => node?.scrollIntoView?.({ block: "center" }) : undefined}
              className="rounded-md border border-border bg-card p-3 shadow-sm"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : debate.id)}
              >
                <div>
                  <p className="font-medium text-foreground">{debate.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    vs {debate.botName} · {formatDate(debate.createdAt)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              </button>

              {isExpanded && debate.judgeFeedbackStyle && (
                <p className="mt-3 text-xs text-muted-foreground" data-testid="debate-history-judge-style">
                  Judged in the {resolveCoachPersona(debate.judgeFeedbackStyle).name} feedback style
                </p>
              )}
              {isExpanded && debate.debrief && <SavedDebrief debrief={debate.debrief} />}
              {isExpanded && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  {debate.history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No transcript recorded for this round.</p>
                  ) : (
                    debate.history.map((message, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-semibold text-foreground">{message.sender}:</span>{" "}
                        <span className="text-muted-foreground">{message.text}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DebateHistory
