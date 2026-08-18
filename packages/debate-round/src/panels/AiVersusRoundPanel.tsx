/**
 * @fileoverview "Online Debate Versus AI" round-setup + submission panel —
 * the "(b) a round-setup + submission UI in `debate-round` that lets a user
 * pick a format/side, type or record a speech, calls
 * `validateSpeechSubmission`, and reads/writes through the persistence
 * store" follow-up named under idea #3 ("Online Debate Versus AI") in
 * TODO.md's Product Feature Ideas list.
 *
 * Lets a user start a round by picking a round ID, `debate-timer` format,
 * and side, then — one speech at a time, in turn order — type and submit
 * their own speeches via the already-existing `validateSpeechSubmission`,
 * saving each submission through the already-persisted
 * `state/aiVersusRounds.ts` (`saveAiVersusRound`, `deleteAiVersusRound`).
 * On the AI's turn, a "Generate AI speech" action builds the request via
 * `buildAiResponseRequest` and calls `requestAiVersusSpeech` (the
 * `/api/reason-ai`-backed follow-up (a) call), saving the returned text as
 * that slot's speech — closing follow-up (a). Speech submission is
 * text-only — `PriorSpeechRecord` has no audio field, and no transcription
 * pipeline exists in this repo. No new turn-order or validation logic is
 * introduced here.
 *
 * If a round's id has a persisted "AI Practice Opponent" persona selection
 * (`/practice-opponent`, same id as this round's Round ID), a badge names
 * it and the AI speech-generation call folds
 * `buildAiVersusPersonaPromptSection` into the request so the AI argues in
 * that persona's style — closing the "AI Practice Opponent" idea's
 * follow-up (a).
 *
 * @module panels/AiVersusRoundPanel
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
  debateStyles,
  type DebateStyleKey,
} from "debate-timer/src/formats/debate-format-times"
import {
  buildAiResponseRequest,
  validateSpeechSubmission,
  type AiVersusSide,
} from "../round/ai-versus-speech-order"
import { requestAiVersusSpeech } from "../round/ai-versus-speech-client"
import {
  buildAiVersusPersonaPromptSection,
  resolveAiVersusOpponentPersona,
} from "../round/ai-versus-persona-wiring"
import {
  buildAiVersusRoundsPanelView,
  deleteAiVersusRound,
  getAiVersusRound,
  getAiVersusRoundStatus,
  saveAiVersusRound,
  type AiVersusRoundRecord,
} from "../state/aiVersusRounds"

const STYLE_LABELS: Record<DebateStyleKey, string> = debateStyleMap.reduce(
  (labels, key, index) => ({ ...labels, [key]: debateStyleNames[index] }),
  {} as Record<DebateStyleKey, string>,
)

function sideLabel(styleKey: DebateStyleKey, side: AiVersusSide): string {
  const style = debateStyles[styleKey]
  return side === "primary" ? style.primary.name : (style.secondary?.name ?? side)
}

/**
 * Renders the Online Debate Versus AI panel: a form to start a round
 * (round ID + format + side) and, once it's the user's turn, type and
 * submit the next expected speech — plus every persisted round below with
 * its turn status, a "Continue" action to make it the active round, and a
 * "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function AiVersusRoundPanel() {
  const [rounds, setRounds] = useState<AiVersusRoundRecord[] | null>(null)
  const [roundId, setRoundId] = useState("")
  const [styleKey, setStyleKey] = useState<DebateStyleKey>(debateStyleMap[0])
  const [userSide, setUserSide] = useState<AiVersusSide>("primary")
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null)
  const [speechText, setSpeechText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)

  useEffect(() => {
    setRounds(buildAiVersusRoundsPanelView())
  }, [])

  const refresh = () => setRounds(buildAiVersusRoundsPanelView())

  const style = debateStyles[styleKey]
  const hasSecondarySide = Boolean(style.secondary)

  const handleStyleChange = (value: string) => {
    const key = value as DebateStyleKey
    setStyleKey(key)
    if (!debateStyles[key].secondary) setUserSide("primary")
  }

  const openRound = (id: string) => {
    setActiveRoundId(id)
    setSpeechText("")
    setError(null)
  }

  const handleStart = () => {
    const trimmedRoundId = roundId.trim()
    if (!trimmedRoundId) {
      setError("Round ID is required.")
      return
    }
    if (!getAiVersusRound(trimmedRoundId)) {
      saveAiVersusRound({ roundId: trimmedRoundId, styleKey, userSide, submittedSpeeches: [] })
    }
    setRoundId("")
    refresh()
    openRound(trimmedRoundId)
  }

  const handleClear = (id: string) => {
    deleteAiVersusRound(id)
    if (activeRoundId === id) setActiveRoundId(null)
    refresh()
  }

  const activeStatus = activeRoundId ? getAiVersusRoundStatus(activeRoundId) : undefined
  const activeRecord = activeRoundId ? getAiVersusRound(activeRoundId) : undefined
  const activePersona = activeRoundId ? resolveAiVersusOpponentPersona(activeRoundId) : null

  const handleSubmitSpeech = () => {
    if (!activeRoundId || !activeRecord || !activeStatus?.nextSlot) return

    const validation = validateSpeechSubmission(
      activeStatus.order,
      activeStatus.submittedCount,
      activeStatus.nextSlot.name,
    )
    if (!validation.valid) {
      setError(validation.reason)
      return
    }
    if (!speechText.trim()) {
      setError("Speech text is required.")
      return
    }

    saveAiVersusRound({
      ...activeRecord,
      submittedSpeeches: [
        ...activeRecord.submittedSpeeches,
        { name: activeStatus.nextSlot.name, speaker: "user", text: speechText },
      ],
    })
    setError(null)
    setSpeechText("")
    refresh()
  }

  const handleGenerateAiSpeech = async () => {
    if (!activeRoundId || !activeRecord || !activeStatus?.nextSlot) return
    if (activeStatus.nextSlot.speaker !== "ai") return

    const request = buildAiResponseRequest(
      activeStatus.order,
      activeStatus.submittedCount,
      activeRecord.submittedSpeeches,
    )
    if (!request) return

    setAiGenerating(true)
    setError(null)
    try {
      const personaPromptSection = buildAiVersusPersonaPromptSection(activeRoundId) ?? undefined
      const text = await requestAiVersusSpeech(request, { personaPromptSection })
      saveAiVersusRound({
        ...activeRecord,
        submittedSpeeches: [...activeRecord.submittedSpeeches, { name: request.slot.name, speaker: "ai", text }],
      })
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI speech generation failed.")
    } finally {
      setAiGenerating(false)
    }
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading AI-versus rounds…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Online Debate Versus AI</h1>
        <p className="text-sm text-muted-foreground">
          Practice a full round against an AI opponent — pick a format and side, then submit your
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-versus-style">Format</Label>
            <Select value={styleKey} onValueChange={handleStyleChange}>
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
            <Label htmlFor="ai-versus-side">Your side</Label>
            <Select value={userSide} onValueChange={(value) => setUserSide(value as AiVersusSide)}>
              <SelectTrigger id="ai-versus-side" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">{style.primary.name}</SelectItem>
                {hasSecondarySide && <SelectItem value="secondary">{style.secondary!.name}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleStart}>Start round</Button>
      </div>

      {activeRoundId && activeRecord && activeStatus && (
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Round {activeRecord.roundId}{" "}
              <span className="font-normal text-muted-foreground">
                ({STYLE_LABELS[activeRecord.styleKey]}, you are{" "}
                {sideLabel(activeRecord.styleKey, activeRecord.userSide)})
              </span>
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setActiveRoundId(null)}>
              Close
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            AI opponent persona:{" "}
            {activePersona ? (
              <Badge variant="secondary">{activePersona.name}</Badge>
            ) : (
              <>
                none selected — pick one at{" "}
                <a href="/practice-opponent" className="underline">
                  /practice-opponent
                </a>{" "}
                using Session ID &quot;{activeRecord.roundId}&quot; (matching this round&apos;s Round
                ID) to apply it here.
              </>
            )}
          </p>

          <div className="space-y-1.5">
            {activeStatus.order.map((slot, index) => {
              const delivered = index < activeStatus.submittedCount
              const isNext = index === activeStatus.submittedCount
              return (
                <div
                  key={slot.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  <span className="text-foreground">
                    {slot.name}{" "}
                    <span className="text-muted-foreground">
                      ({slot.speaker === "user" ? "You" : "AI"})
                    </span>
                  </span>
                  <Badge variant={delivered ? "secondary" : "outline"}>
                    {delivered ? "Delivered" : isNext ? "Next" : "Pending"}
                  </Badge>
                </div>
              )
            })}
          </div>

          {activeStatus.nextSlot === null ? (
            <p className="text-sm text-muted-foreground">
              Round complete — every speech has been delivered.
            </p>
          ) : activeStatus.nextSlot.speaker === "ai" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                It&apos;s the AI&apos;s turn to deliver &quot;{activeStatus.nextSlot.name}&quot;.
              </p>
              <Button onClick={handleGenerateAiSpeech} disabled={aiGenerating}>
                {aiGenerating ? "Generating…" : "Generate AI speech"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="ai-versus-speech-text">
                Your &quot;{activeStatus.nextSlot.name}&quot;
              </Label>
              <Textarea
                id="ai-versus-speech-text"
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder={`Type the ${activeStatus.nextSlot.name}…`}
                className="min-h-24"
              />
              <Button onClick={handleSubmitSpeech}>Submit speech</Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {rounds.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No AI-versus rounds yet. Start one above to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => {
            const status = getAiVersusRoundStatus(round.roundId)
            return (
              <div key={round.roundId} className="rounded-lg border border-border p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Round {round.roundId}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({STYLE_LABELS[round.styleKey]}, you are{" "}
                      {sideLabel(round.styleKey, round.userSide)})
                    </span>
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openRound(round.roundId)}
                      disabled={activeRoundId === round.roundId}
                    >
                      {activeRoundId === round.roundId ? "Active" : "Continue"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleClear(round.roundId)}>
                      Clear
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {status?.submittedCount ?? 0} / {status?.order.length ?? 0} speeches delivered
                  {status?.nextSlot
                    ? ` — next: ${status.nextSlot.name} (${status.nextSlot.speaker === "user" ? "you" : "AI"})`
                    : " — complete"}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
