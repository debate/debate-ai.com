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
 * If the active round's `roundId` has a saved persona in the "AI Practice
 * Opponent" idea's `opponentPersonaSelections.ts` store (via
 * `getOpponentPersonaForRound`), the "Generate AI speech" action instead
 * calls `requestAiVersusSpeechWithPersona`, so the AI opponent argues in
 * that persona's style — closing follow-up (a) under the "🤖 AI Practice
 * Opponent" idea. Falls back to the plain `requestAiVersusSpeech` call when
 * no persona is saved for the round.
 *
 * Every delivered AI speech (`canRegenerateAiSpeechAt`), not just the most
 * recently submitted one, gets its own "Regenerate" action that
 * re-requests that slot — from the same prior-speeches context originally
 * used to generate it — and replaces it in place via `replaceAiSpeechAt`,
 * leaving every other speech (earlier or later, including the user's)
 * untouched, rather than requiring the whole round to be cleared and
 * restarted. This closes the "regenerate affordance" follow-up noted in
 * `docs/features/ai-versus-rounds.md`'s Known gaps.
 *
 * The speech text field also has a "🎤 Record" button (via the same
 * `hooks/useMicrophoneTranscription.ts` the "Speech Transcript Summaries"
 * (idea #6, PR #297) and "Video-Lecture-Training Coach AI" (idea #8, PR
 * #298) panels already use) that dictates directly into `speechText`,
 * closing the "text-only" half of the "Speech submission is text-only...
 * no transcription pipeline exists" Known gap recorded in
 * `docs/features/ai-versus-rounds.md`.
 *
 * A "Download transcript" action (shown once a round's `nextSlot` is
 * `null` — every speech delivered — both on the active round and on any
 * completed round in the persisted-round list) builds a plain-text
 * transcript via the pure, Vitest-covered
 * `round/ai-versus-transcript.ts#buildAiVersusTranscriptText` and saves it
 * via the same anchor+Blob download pattern `dialogs/FileExportDialog.tsx`
 * already uses, closing the "a transcript export/download action for a
 * completed round" follow-up named under idea #3 in TODO.md.
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
import { EmptyState } from "debate-ui/src/panels/panel-shell"
import { Download } from "lucide-react"
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
import { requestAiVersusSpeechWithPersona } from "../round/opponent-persona-speech-client"
import { getOpponentPersonaForRound } from "../round/opponent-persona-speech-wiring"
import { appendDictatedSegment } from "../round/microphone-transcription"
import { useMicrophoneTranscription } from "../hooks/useMicrophoneTranscription"
import { aiVersusTranscriptFilename, buildAiVersusTranscriptText } from "../round/ai-versus-transcript"
import {
  buildAiVersusRoundsPanelView,
  canRegenerateAiSpeechAt,
  deleteAiVersusRound,
  getAiVersusRound,
  getAiVersusRoundStatus,
  replaceAiSpeechAt,
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
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)

  const dictation = useMicrophoneTranscription({
    onSegment: (segment) => setSpeechText((prev) => appendDictatedSegment(prev, segment)),
  })

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
      const persona = getOpponentPersonaForRound(activeRoundId)
      const text = persona
        ? await requestAiVersusSpeechWithPersona(request, persona)
        : await requestAiVersusSpeech(request)
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

  const handleRegenerateAiSpeech = async (index: number) => {
    if (!activeRoundId || !activeRecord || !activeStatus) return
    if (!canRegenerateAiSpeechAt(activeRecord, index)) return

    const request = buildAiResponseRequest(
      activeStatus.order,
      index,
      activeRecord.submittedSpeeches.slice(0, index),
    )
    if (!request) return

    setRegeneratingIndex(index)
    setError(null)
    try {
      const persona = getOpponentPersonaForRound(activeRoundId)
      const text = persona
        ? await requestAiVersusSpeechWithPersona(request, persona)
        : await requestAiVersusSpeech(request)
      saveAiVersusRound(replaceAiSpeechAt(activeRecord, index, text))
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI speech generation failed.")
    } finally {
      setRegeneratingIndex(null)
    }
  }

  /** Mirrors `FileExportDialog.tsx`'s anchor+Blob download pattern. */
  const handleDownloadTranscript = (record: AiVersusRoundRecord) => {
    const text = buildAiVersusTranscriptText(record)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = aiVersusTranscriptFilename(record.roundId)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

          <div className="space-y-1.5">
            {activeStatus.order.map((slot, index) => {
              const delivered = index < activeStatus.submittedCount
              const isNext = index === activeStatus.submittedCount
              const canRegenerate = delivered && canRegenerateAiSpeechAt(activeRecord, index)
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
                  <div className="flex items-center gap-2">
                    {canRegenerate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerateAiSpeech(index)}
                        disabled={regeneratingIndex !== null || aiGenerating}
                      >
                        {regeneratingIndex === index ? "Regenerating…" : "Regenerate"}
                      </Button>
                    )}
                    <Badge variant={delivered ? "secondary" : "outline"}>
                      {delivered ? "Delivered" : isNext ? "Next" : "Pending"}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>

          {activeStatus.nextSlot === null ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Round complete — every speech has been delivered.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownloadTranscript(activeRecord)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download transcript
              </Button>
            </div>
          ) : activeStatus.nextSlot.speaker === "ai" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                It&apos;s the AI&apos;s turn to deliver &quot;{activeStatus.nextSlot.name}&quot;.
              </p>
              {(() => {
                const persona = getOpponentPersonaForRound(activeRoundId)
                return persona ? (
                  <p className="text-xs text-muted-foreground">
                    Arguing as <Badge variant="outline">{persona.name}</Badge>
                  </p>
                ) : null
              })()}
              <Button onClick={handleGenerateAiSpeech} disabled={aiGenerating || regeneratingIndex !== null}>
                {aiGenerating ? "Generating…" : "Generate AI speech"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="ai-versus-speech-text">
                  Your &quot;{activeStatus.nextSlot.name}&quot;
                </Label>
                {dictation.isSupported ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={dictation.isListening ? "destructive" : "outline"}
                    onClick={dictation.isListening ? dictation.stop : dictation.start}
                  >
                    {dictation.isListening ? "Stop recording" : "🎤 Record"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Microphone dictation isn't supported in this browser.
                  </span>
                )}
              </div>
              <Textarea
                id="ai-versus-speech-text"
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder={`Type the ${activeStatus.nextSlot.name}, or click Record to dictate it…`}
                className="min-h-24"
              />
              {dictation.isListening && (
                <p className="text-xs text-muted-foreground">Listening… speak now.</p>
              )}
              {dictation.error && <p className="text-sm text-destructive">{dictation.error}</p>}
              <Button onClick={handleSubmitSpeech}>Submit speech</Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {rounds.length === 0 ? (
        <EmptyState title="No AI-versus rounds yet." message="Start one above to see it here." />
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
                    {status?.nextSlot === null && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadTranscript(round)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download transcript
                      </Button>
                    )}
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
