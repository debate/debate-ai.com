/**
 * @fileoverview Word-Count-Only Speech Format submission panel — the "(a) a
 * submission UI in `debate-round`/`reason-editor` that calls
 * `getWordCountStatus` while a debater types and reads/writes through the
 * persistence store" follow-up named under idea #2 ("Word-Count-Only Speech
 * Format") in TODO.md's Product Feature Ideas list.
 *
 * Lets a user pick a round ID and `debate-timer` word-count style, type each
 * speech's text against a live `getWordCountStatus` readout, and save the
 * round through the already-persisted `state/wordCountRounds.ts`
 * (`saveWordCountRound`, `deleteWordCountRound`). Also lists every persisted
 * round via `buildWordCountRoundsPanelView`, with each speech's status
 * recomputed via `getWordCountRoundStatuses`. No new word-count logic is
 * introduced here.
 *
 * @module panels/WordCountRoundsPanel
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
  wordCountStyleMap,
  wordCountStyleNames,
  wordCountStyles,
  getWordCountStatus,
  type WordCountStyleKey,
} from "debate-timer/src/formats/word-count-format"
import {
  buildWordCountRoundsPanelView,
  deleteWordCountRound,
  getWordCountRoundStatuses,
  saveWordCountRound,
  type WordCountRoundRecord,
} from "../state/wordCountRounds"

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
  const [rounds, setRounds] = useState<WordCountRoundRecord[] | null>(null)
  const [roundId, setRoundId] = useState("")
  const [styleKey, setStyleKey] = useState<WordCountStyleKey>(wordCountStyleMap[0])
  const [drafts, setDrafts] = useState<Record<string, SpeechDraft>>(emptyDrafts(wordCountStyleMap[0]))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRounds(buildWordCountRoundsPanelView())
  }, [])

  const refresh = () => setRounds(buildWordCountRoundsPanelView())

  const handleStyleChange = (value: string) => {
    const key = value as WordCountStyleKey
    setStyleKey(key)
    setDrafts(emptyDrafts(key))
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

    saveWordCountRound({ roundId: trimmedRoundId, styleKey, submittedSpeeches })
    setError(null)
    setRoundId("")
    setDrafts(emptyDrafts(styleKey))
    refresh()
  }

  const handleClear = (id: string) => {
    deleteWordCountRound(id)
    refresh()
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading word-count rounds…</div>
  }

  const style = wordCountStyles[styleKey]

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Word-Count-Only Speech Format</h1>
        <p className="text-sm text-muted-foreground">
          Practice speeches bounded by a maximum word count instead of a time limit.
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
            const status = getWordCountStatus(draft.text, speech.wordLimit)
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
                    {status.count} / {speech.wordLimit} words
                    {status.overLimit
                      ? ` (${Math.abs(status.remaining)} over)`
                      : ` (${status.remaining} left)`}
                  </Badge>
                </div>
                <Textarea
                  value={draft.text}
                  onChange={(e) => updateDraft(speech.name, "text", e.target.value)}
                  placeholder={`Type the ${speech.name} speech…`}
                  className="min-h-24"
                />
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
          {rounds.map((round) => {
            const statuses = getWordCountRoundStatuses(round.roundId)
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
    </div>
  )
}
