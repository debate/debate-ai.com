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
 * @module ui/DebateHistory
 */

"use client"

import { useEffect, useState } from "react"
import { resolveResultStatus, type DebateVsBotRecord } from "../backend"
import { Button } from "debate-speech-writer/src/ui/primitives/button"
import { listDebateHistory } from "../client"

export interface DebateHistoryProps {
  /** Where the client fetches from. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
  /** Called when the user asks to return to the bot picker. */
  onBack: () => void
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

export function DebateHistory({ apiBaseUrl, onBack }: DebateHistoryProps) {
  const [debates, setDebates] = useState<DebateVsBotRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

      <div className="flex flex-col gap-3">
        {debates?.map((debate) => {
          const badge = resultBadge(debate.outcome)
          const isExpanded = expandedId === debate.id
          return (
            <div key={debate.id} className="rounded-md border border-border bg-card p-3 shadow-sm">
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
