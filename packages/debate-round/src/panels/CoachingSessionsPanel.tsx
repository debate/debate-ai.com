/**
 * @fileoverview AI Coach Mode panel — the UI follow-up named "(b) a
 * coaching-panel UI that reads/writes through the persistence store" under
 * the "🎙️ AI Coach Mode" bullet in TODO.md.
 *
 * Reads every persisted coaching session via `state/coachingSessions.ts`'s
 * `buildCoachingSessionsPanelView` (a stable-order sort of
 * `listCoachingSessions`) and renders each round+side's prompts grouped
 * together, with a "Clear" action that calls the already-persisted
 * `deleteCoachingSession` — no new coaching-prompt generation logic is
 * introduced here.
 *
 * A "Get AI feedback" action per session calls
 * `round/coach-feedback-client.ts`'s `requestCoachFeedback` with the
 * session's own template prompts, saves the result via
 * `saveCoachingSessionAiFeedback`, and renders it under the template
 * prompts — closing follow-up (a), "an actual AI coaching call for
 * open-ended feedback beyond this deterministic template layer."
 *
 * A "Generate coaching session for current round" form reads the round
 * workspace's currently selected flow (`state/store.ts`'s `useFlowStore`,
 * the same mechanism `DrillSetsPanel`'s "Generate drills for current round"
 * action uses) and, given a side, derives and persists that round+side's
 * coaching session via `state/coachingSessions.ts`'s
 * `buildAndSaveCoachingSession` — closing
 * `docs/features/coaching-sessions.md`'s "no affordance in this panel to
 * generate a new coaching session for a round" Known gap. No new
 * coaching-prompt derivation logic is introduced here.
 *
 * A "Download" action per session — the "an exportable coaching-notes
 * document" follow-up named under the "🎙️ AI Coach Mode" bullet in
 * TODO.md — saves the session's template prompts plus its AI feedback (if
 * generated) as a plain-text file via `state/coachingSessions.ts`'s
 * `buildCoachingNotesText`/`coachingNotesFilename`, using the same
 * anchor+Blob download pattern every other completed export follow-up in
 * this repo already uses (e.g. `PreRoundBriefingsPanel.tsx`'s
 * "Download").
 *
 * A "History" toggle per session lists every prior version
 * `state/coachingSessionHistory.ts` snapshotted before a regeneration
 * overwrote it, each with a "Restore this version" action — the "a
 * coaching-session history timeline per round" follow-up named under the
 * "🎙️ AI Coach Mode" bullet in TODO.md, mirroring
 * `CoachMaterialsPanel.tsx`'s identical History/Restore pattern.
 *
 * A "Compare two sessions" section — the "a side-by-side comparison across
 * two rounds" follow-up named under the same bullet, the last one open once
 * History shipped — lets a user pick any two persisted sessions (two sides
 * of one round, or the same side across two different rounds) and renders
 * their prompts kind-by-kind in two columns via
 * `state/coachingSessions.ts#buildCoachingSessionComparison`, plus a
 * "Download comparison" action mirroring the per-session Download button.
 *
 * @module panels/CoachingSessionsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { EmptyState } from "../ui/panels/panel-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select"
import {
  buildAndSaveCoachingSession,
  buildCoachingNotesText,
  buildCoachingSessionComparison,
  buildCoachingSessionComparisonText,
  buildCoachingSessionsPanelView,
  coachingNotesFilename,
  coachingSessionComparisonFilename,
  deleteCoachingSession,
  saveCoachingSession,
  saveCoachingSessionAiFeedback,
  type CoachingSessionComparison,
  type CoachingSessionRecord,
} from "../state/coachingSessions"
import {
  coachingSessionFromVersion,
  listVersionsForCoachingSession,
  type CoachingSessionHistoryEntry,
} from "../state/coachingSessionHistory"
import type { CoachingPromptKind } from "../flow/coach-mode"
import { requestCoachFeedback } from "../round/coach-feedback-client"
import { useFlowStore } from "../state/store"

const COACHING_PROMPT_KIND_LABELS: Record<CoachingPromptKind, string> = {
  extension: "Extension",
  refutation: "Refutation",
  collapse: "Collapse",
  weighing: "Weighing",
}

/**
 * Renders the AI Coach Mode panel: every persisted `CoachingSessionRecord`,
 * grouped by round + side, with a "Clear" action per session.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function CoachingSessionsPanel() {
  const [sessions, setSessions] = useState<CoachingSessionRecord[] | null>(null)
  const [feedbackLoadingKey, setFeedbackLoadingKey] = useState<string | null>(null)
  const [feedbackErrorsByKey, setFeedbackErrorsByKey] = useState<Record<string, string>>({})
  const [generateSideKey, setGenerateSideKey] = useState("")
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [historyOpenKey, setHistoryOpenKey] = useState<string | null>(null)
  const [versions, setVersions] = useState<CoachingSessionHistoryEntry[]>([])
  const [compareAKey, setCompareAKey] = useState("")
  const [compareBKey, setCompareBKey] = useState("")
  const [compareError, setCompareError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<CoachingSessionComparison | null>(null)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)
  const currentFlow = mounted ? flows[selected] : undefined

  useEffect(() => {
    setMounted(true)
    setSessions(buildCoachingSessionsPanelView())
  }, [])

  const refresh = () => setSessions(buildCoachingSessionsPanelView())

  const handleClear = (roundId: string, sideKey: string) => {
    deleteCoachingSession(roundId, sideKey)
    if (historyOpenKey === `${roundId}:${sideKey}`) {
      setHistoryOpenKey(null)
      setVersions([])
    }
    refresh()
  }

  const handleToggleHistory = (roundId: string, sideKey: string) => {
    const key = `${roundId}:${sideKey}`
    if (historyOpenKey === key) {
      setHistoryOpenKey(null)
      return
    }
    setVersions(listVersionsForCoachingSession(roundId, sideKey))
    setHistoryOpenKey(key)
  }

  const handleRestore = (entry: CoachingSessionHistoryEntry) => {
    saveCoachingSession(coachingSessionFromVersion(entry))
    setVersions(listVersionsForCoachingSession(entry.roundId, entry.sideKey))
    refresh()
  }

  /** Mirrors `PreRoundBriefingsPanel.tsx`'s anchor+Blob download pattern. */
  const handleDownload = (session: CoachingSessionRecord) => {
    const text = buildCoachingNotesText(session)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = coachingNotesFilename(session.roundId, session.sideKey)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCompare = () => {
    if (!compareAKey || !compareBKey) {
      setCompareError("Choose two sessions to compare.")
      setComparison(null)
      return
    }
    if (compareAKey === compareBKey) {
      setCompareError("Choose two different sessions to compare.")
      setComparison(null)
      return
    }
    const sessionA = sessions?.find((session) => `${session.roundId}:${session.sideKey}` === compareAKey)
    const sessionB = sessions?.find((session) => `${session.roundId}:${session.sideKey}` === compareBKey)
    if (!sessionA || !sessionB) {
      setCompareError("One of the selected sessions is no longer available.")
      setComparison(null)
      return
    }
    setCompareError(null)
    setComparison(buildCoachingSessionComparison(sessionA, sessionB))
  }

  /** Mirrors `handleDownload`'s anchor+Blob download pattern. */
  const handleDownloadComparison = () => {
    if (!comparison) return
    const text = buildCoachingSessionComparisonText(comparison)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = coachingSessionComparisonFilename(comparison.a, comparison.b)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleGenerate = () => {
    if (!currentFlow) return
    const sideKey = generateSideKey.trim()
    if (!sideKey) {
      setGenerateError("A side (e.g. aff or neg) is required to generate a coaching session.")
      return
    }
    buildAndSaveCoachingSession(currentFlow, String(currentFlow.id), sideKey)
    setGenerateError(null)
    setGenerateSideKey("")
    refresh()
  }

  const handleGetAiFeedback = async (session: CoachingSessionRecord) => {
    const key = `${session.roundId}:${session.sideKey}`
    setFeedbackLoadingKey(key)
    setFeedbackErrorsByKey((prev) => {
      const { [key]: _removed, ...rest } = prev
      return rest
    })
    try {
      const feedback = await requestCoachFeedback({ sideKey: session.sideKey, prompts: session.prompts })
      saveCoachingSessionAiFeedback(session.roundId, session.sideKey, feedback)
      refresh()
    } catch (error) {
      setFeedbackErrorsByKey((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Failed to get AI feedback.",
      }))
    } finally {
      setFeedbackLoadingKey(null)
    }
  }

  if (sessions === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading coaching sessions…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">AI Coach Mode</h1>
        <p className="text-sm text-muted-foreground">
          Coaching prompts generated from each round's flow — what to extend, what to answer,
          where to collapse, and how to weigh the round.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <Label htmlFor="coaching-session-generate-side">Generate coaching session for current round</Label>
          <p className="text-xs text-muted-foreground">
            Uses the round workspace's currently selected flow.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id="coaching-session-generate-side"
            value={generateSideKey}
            onChange={(e) => setGenerateSideKey(e.target.value)}
            placeholder="Side (e.g. aff)"
            className="w-40"
          />
          <Button size="sm" disabled={!currentFlow} onClick={handleGenerate}>
            Generate coaching session
          </Button>
        </div>
        {!currentFlow && (
          <p className="text-sm text-muted-foreground">
            Select a round's flow in the round workspace to generate a coaching session for it.
          </p>
        )}
        {generateError && <p className="text-sm text-destructive">{generateError}</p>}
      </div>

      {sessions.length >= 2 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <Label>Compare two sessions</Label>
            <p className="text-xs text-muted-foreground">
              See two rounds' (or two sides') coaching prompts side by side, grouped by kind.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="coaching-session-compare-a" className="text-xs">
                Session A
              </Label>
              <Select value={compareAKey} onValueChange={setCompareAKey}>
                <SelectTrigger id="coaching-session-compare-a" className="w-56">
                  <SelectValue placeholder="Choose a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem
                      key={`${session.roundId}:${session.sideKey}`}
                      value={`${session.roundId}:${session.sideKey}`}
                    >
                      Round {session.roundId} ({session.sideKey})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="coaching-session-compare-b" className="text-xs">
                Session B
              </Label>
              <Select value={compareBKey} onValueChange={setCompareBKey}>
                <SelectTrigger id="coaching-session-compare-b" className="w-56">
                  <SelectValue placeholder="Choose a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem
                      key={`${session.roundId}:${session.sideKey}`}
                      value={`${session.roundId}:${session.sideKey}`}
                    >
                      Round {session.roundId} ({session.sideKey})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleCompare}>
              Compare
            </Button>
            {comparison && (
              <Button size="sm" variant="outline" onClick={handleDownloadComparison}>
                Download comparison
              </Button>
            )}
          </div>
          {compareError && <p className="text-sm text-destructive">{compareError}</p>}
          {comparison && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-muted-foreground">
                <span>
                  Round {comparison.a.roundId} <span className="font-normal">({comparison.a.sideKey})</span>
                </span>
                <span>
                  Round {comparison.b.roundId} <span className="font-normal">({comparison.b.sideKey})</span>
                </span>
              </div>
              {comparison.rowsByKind.map((row) => (
                <div key={row.kind} className="space-y-1">
                  <Badge variant="outline">{COACHING_PROMPT_KIND_LABELS[row.kind]}</Badge>
                  <div className="grid grid-cols-2 gap-3">
                    {[row.a, row.b].map((prompts, columnIndex) => (
                      <div key={columnIndex} className="space-y-1 rounded-md border border-border p-2">
                        {prompts.length === 0 ? (
                          <p className="text-xs text-muted-foreground">None</p>
                        ) : (
                          prompts.map((prompt, index) => (
                            <p key={index} className="text-sm text-foreground">
                              {prompt.prompt}
                            </p>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sessions.length === 0 && (
        <EmptyState
          title="No coaching sessions yet."
          message="Sessions fill in once a round's flow generates extension, refutation, collapse, and weighing prompts for a side."
        />
      )}
      {sessions.map((session) => (
        <div key={`${session.roundId}:${session.sideKey}`} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Round {session.roundId}{" "}
              <span className="font-normal text-muted-foreground">({session.sideKey})</span>
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleDownload(session)}>
                Download
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleToggleHistory(session.roundId, session.sideKey)}
              >
                {historyOpenKey === `${session.roundId}:${session.sideKey}` ? "Hide history" : "History"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleClear(session.roundId, session.sideKey)}>
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {session.prompts.map((prompt, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Badge variant="outline" className="whitespace-nowrap">
                  {COACHING_PROMPT_KIND_LABELS[prompt.kind]}
                </Badge>
                <p className="text-foreground">{prompt.prompt}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">AI feedback</h3>
              <Button
                size="sm"
                variant="outline"
                disabled={feedbackLoadingKey === `${session.roundId}:${session.sideKey}`}
                onClick={() => handleGetAiFeedback(session)}
              >
                {feedbackLoadingKey === `${session.roundId}:${session.sideKey}`
                  ? "Getting feedback…"
                  : session.aiFeedback
                    ? "Regenerate AI feedback"
                    : "Get AI feedback"}
              </Button>
            </div>
            {feedbackErrorsByKey[`${session.roundId}:${session.sideKey}`] && (
              <p className="text-sm text-destructive">
                {feedbackErrorsByKey[`${session.roundId}:${session.sideKey}`]}
              </p>
            )}
            {session.aiFeedback && (
              <p className="whitespace-pre-wrap text-sm text-foreground">{session.aiFeedback}</p>
            )}
            {!session.aiFeedback && !feedbackErrorsByKey[`${session.roundId}:${session.sideKey}`] && (
              <p className="text-sm text-muted-foreground">
                No AI feedback generated yet — open-ended coaching feedback beyond the template
                prompts above.
              </p>
            )}
          </div>
          {historyOpenKey === `${session.roundId}:${session.sideKey}` && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">History</h3>
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No prior versions — this coaching session hasn't been regenerated yet.
                </p>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs text-muted-foreground">
                        Replaced {new Date(version.replacedAt).toLocaleString()} — {version.prompts.length} prompt
                        {version.prompts.length === 1 ? "" : "s"}
                        {version.aiFeedback ? ", with AI feedback" : ""}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleRestore(version)}>
                      Restore this version
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
