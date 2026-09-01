/**
 * @fileoverview Word-Count-Only Speech Format submission panel — the "(a) a
 * submission UI in `debate-round`/`reason-editor` that calls
 * `getWordCountStatus` while a debater types and reads/writes through the
 * persistence store" follow-up named under idea #2 ("Word-Count-Only Speech
 * Format") in TODO.md's Product Feature Ideas list.
 *
 * Lets a user pick a round ID and `debate-timer` word-count style, type (or
 * dictate, via a per-speech "🎤 Record" button reusing the existing
 * `round/microphone-transcription.ts`/`hooks/useMicrophoneTranscription.ts`
 * Web Speech API wiring) each speech's text against a live
 * `getWordCountStatus` readout, and save the round through the
 * already-persisted `state/wordCountRounds.ts` (`saveWordCountRound`,
 * `deleteWordCountRound`). Also lists every persisted round via
 * `buildWordCountRoundsPanelView`, with each speech's status recomputed via
 * `getWordCountRoundStatuses`. No new word-count logic is introduced here.
 *
 * Each speech's limit is resolved through `useWordLimitPresets` (TODO.md
 * idea #2's "per-style word-limit preset manager" follow-up, managed from
 * `WordLimitPresetsPanel` on `/settings`) before falling back to the
 * authored `wordCountStyles` entry, so a signed-in user's custom overrides
 * apply here the same way they do in the live in-round meter.
 *
 * A "Word-count trend" section below the persisted-round list renders every
 * dated submission (across every round) as a chronological bar list via
 * `buildWordCountTrendData` — TODO.md idea #2's "a trend view showing a
 * debater's word-count-vs-limit history across past submissions" follow-up
 * — with an optional per-speech-name filter once more than one speech name
 * has history.
 *
 * @module panels/WordCountRoundsPanel
 */

"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { Textarea } from "../ui/primitives/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select"
import {
  wordCountStyleMap,
  wordCountStyleNames,
  wordCountStyles,
  getWordCountStatus,
  type WordCountStyleKey,
} from "debate-timer/src/formats/word-count-format"
import { buildWordCountTrendData, getWordCountRoundStatuses } from "../state/wordCountRounds"
import { findPresetWordLimit } from "../state/wordLimitPresets"
import { appendDictatedSegment } from "../round/microphone-transcription"
import { useMicrophoneTranscription } from "../hooks/useMicrophoneTranscription"
import { useWordLimitPresets } from "../hooks/useWordLimitPresets"
import { useWordCountRounds } from "../hooks/useWordCountRounds"

const STYLE_LABELS: Record<WordCountStyleKey, string> = wordCountStyleMap.reduce(
  (labels, key, index) => ({ ...labels, [key]: wordCountStyleNames[index] }),
  {} as Record<WordCountStyleKey, string>,
)

type SpeechDraft = { speaker: string; text: string }

function emptyDrafts(styleKey: WordCountStyleKey): Record<string, SpeechDraft> {
  const style = wordCountStyles[styleKey]
  return Object.fromEntries(
    style.speeches.map((speech) => [speech.name, { speaker: speech.speaker ?? "", text: "" }]),
  )
}

/**
 * Renders the Word-Count-Only Speech Format panel: a form to type and save a
 * round's word-count-limited speeches, with a live per-speech word-count
 * readout, plus every persisted round below with its computed statuses and a
 * "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function WordCountRoundsPanel() {
  const { presets } = useWordLimitPresets()
  const { rounds, synced, saveRound, deleteRound, clearAllRounds } = useWordCountRounds()
  const [roundId, setRoundId] = useState("")
  const [styleKey, setStyleKey] = useState<WordCountStyleKey>(wordCountStyleMap[0])
  const [drafts, setDrafts] = useState<Record<string, SpeechDraft>>(emptyDrafts(wordCountStyleMap[0]))
  const [error, setError] = useState<string | null>(null)
  const [trendSpeechFilter, setTrendSpeechFilter] = useState("all")

  // Which speech's textarea the microphone is currently dictating into, if any.
  const [dictatingSpeech, setDictatingSpeech] = useState<string | null>(null)
  const dictatingSpeechRef = useRef<string | null>(null)
  dictatingSpeechRef.current = dictatingSpeech

  const dictation = useMicrophoneTranscription({
    onSegment: (segment) => {
      const target = dictatingSpeechRef.current
      if (!target) return
      setDrafts((prev) => ({
        ...prev,
        [target]: { ...prev[target], text: appendDictatedSegment(prev[target]?.text ?? "", segment) },
      }))
    },
  })

  const handleStyleChange = (value: string) => {
    const key = value as WordCountStyleKey
    setStyleKey(key)
    setDrafts(emptyDrafts(key))
    if (dictation.isListening) dictation.stop()
    setDictatingSpeech(null)
  }

  const toggleDictation = (speechName: string) => {
    if (dictation.isListening && dictatingSpeech === speechName) {
      dictation.stop()
      return
    }
    setDictatingSpeech(speechName)
    dictation.start()
  }

  const updateDraft = (name: string, field: keyof SpeechDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }))
  }

  const handleSave = () => {
    const trimmedRoundId = roundId.trim()
    if (!trimmedRoundId) {
      setError("Round ID is required.")
      return
    }

    const submittedSpeeches = wordCountStyles[styleKey].speeches
      .map((speech) => ({ name: speech.name, ...drafts[speech.name] }))
      .filter((submission) => submission.text.trim().length > 0)

    saveRound({ roundId: trimmedRoundId, styleKey, submittedSpeeches })
    setError(null)
    setRoundId("")
    setDrafts(emptyDrafts(styleKey))
    if (dictation.isListening) dictation.stop()
    setDictatingSpeech(null)
  }

  const handleClear = (id: string) => {
    deleteRound(id)
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading word-count rounds…</div>
  }

  const style = wordCountStyles[styleKey]
  const trendPoints = buildWordCountTrendData(presets)
  const trendSpeechNames = Array.from(new Set(trendPoints.map((point) => point.name))).sort()
  const filteredTrendPoints =
    trendSpeechFilter === "all" ? trendPoints : trendPoints.filter((point) => point.name === trendSpeechFilter)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Word-Count-Only Speech Format</h1>
        <p className="text-sm text-muted-foreground">
          Practice speeches bounded by a maximum word count instead of a time limit.
        </p>
        {presets.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {presets.length} custom word limit{presets.length === 1 ? "" : "s"} applied — manage them in{" "}
            <Link href="/settings" className="underline underline-offset-2 hover:text-foreground">
              Settings
            </Link>
            .
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {synced
            ? "Round history — including the trend below — is synced to your account."
            : "Sign in to sync your round history — including the trend below — across devices."}
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="word-count-round-id">Round ID</Label>
            <Input
              id="word-count-round-id"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              placeholder="round-1"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="word-count-style">Style</Label>
            <Select value={styleKey} onValueChange={handleStyleChange}>
              <SelectTrigger id="word-count-style" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {wordCountStyleMap.map((key) => (
                  <SelectItem key={key} value={key}>
                    {STYLE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {style.speeches.map((speech) => {
            const draft = drafts[speech.name] ?? { speaker: "", text: "" }
            const wordLimit = findPresetWordLimit(presets, speech.name) ?? speech.wordLimit
            const status = getWordCountStatus(draft.text, wordLimit)
            const isDictatingThis = dictation.isListening && dictatingSpeech === speech.name
            return (
              <div key={speech.name} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{speech.name}</Badge>
                    <Input
                      value={draft.speaker}
                      onChange={(e) => updateDraft(speech.name, "speaker", e.target.value)}
                      placeholder="Speaker"
                      className="h-7 w-32 text-xs"
                    />
                  </div>
                  <Badge variant={status.overLimit ? "destructive" : "secondary"}>
                    {status.count} / {wordLimit} words
                    {status.overLimit
                      ? ` (${Math.abs(status.remaining)} over)`
                      : ` (${status.remaining} left)`}
                  </Badge>
                </div>
                <Textarea
                  value={draft.text}
                  onChange={(e) => updateDraft(speech.name, "text", e.target.value)}
                  placeholder={`Type the ${speech.name} speech, or click Record to dictate it…`}
                  className="min-h-24"
                />
                {dictation.isSupported ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={isDictatingThis ? "destructive" : "outline"}
                    disabled={dictation.isListening && !isDictatingThis}
                    onClick={() => toggleDictation(speech.name)}
                  >
                    {isDictatingThis ? "Stop recording" : "🎤 Record"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Microphone dictation isn't supported in this browser.
                  </p>
                )}
                {isDictatingThis && (
                  <p className="text-xs text-muted-foreground">Listening… speak now.</p>
                )}
                {dictatingSpeech === speech.name && dictation.error && (
                  <p className="text-sm text-destructive">{dictation.error}</p>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Save round</Button>
      </div>

      {rounds.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No word-count rounds yet. Save one above to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Round history</h2>
            <Button size="sm" variant="ghost" onClick={clearAllRounds}>
              Delete all synced history
            </Button>
          </div>
          {rounds.map((round) => {
            const statuses = getWordCountRoundStatuses(round.roundId, presets)
            return (
              <div key={round.roundId} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Round {round.roundId}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({STYLE_LABELS[round.styleKey]})
                    </span>
                  </h2>
                  <Button size="sm" variant="ghost" onClick={() => handleClear(round.roundId)}>
                    Clear
                  </Button>
                </div>
                {statuses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No speeches submitted yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {statuses.map((entry) => (
                      <div
                        key={entry.name}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                      >
                        <span className="text-foreground">
                          {entry.name} <span className="text-muted-foreground">({entry.speaker})</span>
                        </span>
                        <Badge variant={entry.status.overLimit ? "destructive" : "secondary"}>
                          {entry.status.count} words
                          {entry.status.overLimit ? ` (${Math.abs(entry.status.remaining)} over)` : ""}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Word-count trend</h2>
          {trendSpeechNames.length > 1 && (
            <Select value={trendSpeechFilter} onValueChange={setTrendSpeechFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All speeches</SelectItem>
                {trendSpeechNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {filteredTrendPoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No dated submissions yet — save a round above to start tracking your history.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredTrendPoints.map((point, index) => {
              const percent = point.wordLimit > 0 ? Math.min(1, point.count / point.wordLimit) * 100 : 0
              return (
                <div key={`${point.roundId}-${point.name}-${index}`} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground">
                    <span className="truncate">
                      {new Date(point.createdAt).toLocaleDateString()} — Round {point.roundId} ({point.name})
                    </span>
                    <span className="whitespace-nowrap font-semibold">
                      {point.count} / {point.wordLimit}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${point.overLimit ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
