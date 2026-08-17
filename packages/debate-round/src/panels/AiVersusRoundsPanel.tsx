/**
 * @fileoverview Online Debate Versus AI round-setup + submission panel —
 * the "(b) a round-setup + submission UI in `debate-round` that lets a user
 * pick a format/side, type or record a speech, calls
 * `validateSpeechSubmission`, and reads/writes through the persistence
 * store" follow-up named under idea #3 ("Online Debate Versus AI") in
 * TODO.md's Product Feature Ideas list.
 *
 * Lets a user pick a round ID, a `debate-timer` timed format, and which
 * side they're debating, then walks the turn order produced by
 * `ai-versus-speech-order.ts`'s `buildAiVersusSpeechOrder`. On the user's
 * turn, a typed speech is checked with `validateSpeechSubmission` and
 * appended to the round's `submittedSpeeches`; on the AI's turn (since
 * follow-up (a), the actual AI speech-generation call, isn't wired up yet)
 * the AI's response is entered manually instead, using
 * `buildAiResponseRequest` only to show which slot/prior speeches it would
 * respond to. Every round reads/writes through the already-persisted
 * `state/aiVersusRounds.ts` (`saveAiVersusRound`, `getAiVersusRound`,
 * `deleteAiVersusRound`). No AI/model API is called anywhere in this file.
 *
 * @module panels/AiVersusRoundsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import {
  debateStyleMap,
  debateStyleNames,
  type DebateStyleKey,
} from "debate-timer/src/formats/debate-format-times"
import {
  buildAiResponseRequest,
  buildAiVersusSpeechOrder,
  getNextSpeechSlot,
  isUsersTurn,
  validateSpeechSubmission,
  type AiVersusSide,
} from "../round/ai-versus-speech-order"
import {
  buildAiVersusRoundsPanelView,
  deleteAiVersusRound,
  getAiVersusRound,
  saveAiVersusRound,
  type AiVersusRoundRecord,
} from "../state/aiVersusRounds"

const STYLE_LABELS: Record<DebateStyleKey, string> = debateStyleMap.reduce(
  (labels, key, index) => ({ ...labels, [key]: debateStyleNames[index] }),
  {} as Record<DebateStyleKey, string>,
)

const SIDE_LABELS: Record<AiVersusSide, string> = {
  primary: "Primary (e.g. Aff/Pro)",
  secondary: "Secondary (e.g. Neg/Con)",
}

/**
 * Renders the Online Debate Versus AI panel: a setup form for a round's ID,
 * format, and side, then a turn-by-turn submission flow through
 * `buildAiVersusSpeechOrder`, plus every persisted round below with a
 * "Resume" affordance and a "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function AiVersusRoundsPanel() {
  const [rounds, setRounds] = useState<AiVersusRoundRecord[] | null>(null)
  const [roundId, setRoundId] = useState("")
  const [styleKey, setStyleKey] = useState<DebateStyleKey>(debateStyleMap[0])
  const [userSide, setUserSide] = useState<AiVersusSide>("primary")
  const [active, setActive] = useState<AiVersusRoundRecord | null>(null)
  const [speechText, setSpeechText] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRounds(buildAiVersusRoundsPanelView())
  }, [])

  const refresh = () => setRounds(buildAiVersusRoundsPanelView())

  const handleStart = () => {
    const trimmedRoundId = roundId.trim()
    if (!trimmedRoundId) {
      setError("Round ID is required.")
      return
    }

    const existing = getAiVersusRound(trimmedRoundId)
    if (existing) {
      loadRound(existing)
      return
    }

    const record: AiVersusRoundRecord = {
      roundId: trimmedRoundId,
      styleKey,
      userSide,
      submittedSpeeches: [],
    }
    saveAiVersusRound(record)
    setError(null)
    setActive(record)
    setSpeechText("")
    refresh()
  }

  const loadRound = (record: AiVersusRoundRecord) => {
    setRoundId(record.roundId)
    setStyleKey(record.styleKey)
    setUserSide(record.userSide)
    setActive(record)
    setSpeechText("")
    setError(null)
  }

  const handleClear = (id: string) => {
    deleteAiVersusRound(id)
    if (active?.roundId === id) {
      setActive(null)
      setRoundId("")
      setSpeechText("")
    }
    refresh()
  }

  const handleSubmitSpeech = (speaker: "user" | "ai", expectedName: string) => {
    if (!active) return
    const order = buildAiVersusSpeechOrder(active.styleKey, active.userSide)
    const validation = validateSpeechSubmission(order, active.submittedSpeeches.length, expectedName)
    if (!validation.valid) {
      setError(validation.reason)
      return
    }

    const updated: AiVersusRoundRecord = {
      ...active,
      submittedSpeeches: [
        ...active.submittedSpeeches,
        { name: expectedName, speaker, text: speechText },
      ],
    }
    saveAiVersusRound(updated)
    setError(null)
    setActive(updated)
    setSpeechText("")
    refresh()
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading AI-versus rounds…</div>
  }

  const order = active ? buildAiVersusSpeechOrder(active.styleKey, active.userSide) : []
  const submittedCount = active?.submittedSpeeches.length ?? 0
  const nextSlot = active ? getNextSpeechSlot(order, submittedCount) : null
  const usersTurn = active ? isUsersTurn(order, submittedCount) : false
  const aiRequest = active ? buildAiResponseRequest(order, submittedCount, active.submittedSpeeches) : null

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Online Debate Versus AI</h1>
        <p className="text-sm text-muted-foreground">
          Practice an online round against an AI opponent — pick a format and side, then submit
          speeches in turn order.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-versus-round-id">Round ID</Label>
            <Input
              id="ai-versus-round-id"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              placeholder="round-1"
              className="max-w-xs"
              disabled={Boolean(active)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-versus-style">Format</Label>
            <Select
              value={styleKey}
              onValueChange={(value) => setStyleKey(value as DebateStyleKey)}
              disabled={Boolean(active)}
            >
              <SelectTrigger id="ai-versus-style" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {debateStyleMap.map((key) => (
                  <SelectItem key={key} value={key}>
                    {STYLE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-versus-side">Which side are you?</Label>
            <Select
              value={userSide}
              onValueChange={(value) => setUserSide(value as AiVersusSide)}
              disabled={Boolean(active)}
            >
              <SelectTrigger id="ai-versus-side" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SIDE_LABELS) as AiVersusSide[]).map((side) => (
                  <SelectItem key={side} value={side}>
                    {SIDE_LABELS[side]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!active && (
          <Button onClick={handleStart}>Start / resume round</Button>
        )}

        {active && (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Turn order</p>
              <ol className="space-y-1">
                {order.map((slot, index) => {
                  const delivered = index < submittedCount
                  return (
                    <li
                      key={`${slot.index}:${slot.name}`}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <Badge variant={slot.speaker === "user" ? "default" : "secondary"}>
                        {slot.speaker === "user" ? "You" : "AI"}
                      </Badge>
                      <span className="text-foreground">{slot.name}</span>
                      {slot.cxRoles && (
                        <span className="text-xs text-muted-foreground">(cross-examination)</span>
                      )}
                      {delivered && <Badge variant="outline">✓ delivered</Badge>}
                    </li>
                  )
                })}
              </ol>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {!nextSlot && (
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                Round complete — every speech in the turn order has been submitted.
              </div>
            )}

            {nextSlot && usersTurn && (
              <div className="space-y-2">
                <Label htmlFor="ai-versus-speech-text">
                  Your turn: {nextSlot.name}
                  {nextSlot.cxRoles ? " (cross-examination)" : ""}
                </Label>
                <Textarea
                  id="ai-versus-speech-text"
                  value={speechText}
                  onChange={(e) => setSpeechText(e.target.value)}
                  placeholder={`Type or record your ${nextSlot.name}…`}
                  className="min-h-24"
                />
                <Button onClick={() => handleSubmitSpeech("user", nextSlot.name)}>
                  Submit speech
                </Button>
              </div>
            )}

            {nextSlot && !usersTurn && aiRequest && (
              <div className="space-y-2">
                <Label htmlFor="ai-versus-ai-text">
                  AI's turn: {aiRequest.slot.name}
                  {aiRequest.isCrossExamination ? " (cross-examination)" : ""}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Follow-up (a) (an AI speech-generation call) isn&apos;t wired up yet — enter the
                  AI&apos;s response manually to continue the round.
                </p>
                <Textarea
                  id="ai-versus-ai-text"
                  value={speechText}
                  onChange={(e) => setSpeechText(e.target.value)}
                  placeholder={`Type the AI's ${aiRequest.slot.name} manually…`}
                  className="min-h-24"
                />
                <Button onClick={() => handleSubmitSpeech("ai", aiRequest.slot.name)}>
                  Submit AI speech
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {rounds.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No AI-versus rounds yet. Start one above to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => (
            <div key={round.roundId} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Round {round.roundId}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({STYLE_LABELS[round.styleKey]}, {SIDE_LABELS[round.userSide]})
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadRound(round)}>
                    Resume
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleClear(round.roundId)}>
                    Clear
                  </Button>
                </div>
              </div>
              {round.submittedSpeeches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No speeches submitted yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {round.submittedSpeeches.map((speech, index) => (
                    <div
                      key={`${speech.name}:${index}`}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      <Badge variant={speech.speaker === "user" ? "default" : "secondary"}>
                        {speech.speaker === "user" ? "You" : "AI"}
                      </Badge>
                      <span className="text-foreground">{speech.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
