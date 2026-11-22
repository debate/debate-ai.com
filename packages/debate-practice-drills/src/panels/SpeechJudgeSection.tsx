/**
 * @fileoverview "Judge pasted speeches" section of the AI Judge Decision
 * page: an editable list of speeches (preloaded with the 8-speech
 * alternating Aff/Neg preset) the user pastes their speech docs into, sent
 * to the Standard Judge (`round/speech-judge-ai.ts`) for a decision plus a
 * per-speech critique with alternatives.
 *
 * The speech list is kept in this browser's localStorage as a draft so a
 * reload doesn't lose pasted text; every read/write is guarded because
 * storage can be unavailable.
 *
 * Each verdict is saved with the speeches it judged
 * (`state/speechJudgeDecisions.ts`), which syncs to a signed-in user's
 * account. **Saved verdicts** lists them newest first: show one in full,
 * load its speeches back into the editor, or delete it.
 *
 * @module panels/SpeechJudgeSection
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { isToolRecordSyncEnabled } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"
import { Badge } from "@debate-ai/round/src/ui/primitives/badge"
import { Button } from "@debate-ai/round/src/ui/primitives/button"
import { Input } from "@debate-ai/round/src/ui/primitives/input"
import { Textarea } from "@debate-ai/round/src/ui/primitives/textarea"
import { PanelSection } from "@debate-ai/round/src/ui/panels/panel-shell"
import {
  SPEECH_SIDE_LABEL,
  createPresetSpeeches,
  generateSpeechId,
  hasSpeechContent,
  nextSpeechSide,
  requestSpeechJudgeDecision,
  type JudgedSpeech,
} from "../round/speech-judge-ai"
import { FallacyHints } from "@debate-ai/speech-writer/src/ui/FallacyHints"
import { STANDARD_JUDGE_NAME } from "../round/standard-judge-prompt"
import {
  countJudgedSpeeches,
  deleteSpeechJudgeDecision,
  fitsInAccountRow,
  isSpeechJudgeDecisionsStorageEvent,
  listSpeechJudgeDecisions,
  previewSpeechJudgeDecision,
  saveSpeechJudgeDecision,
  type SpeechJudgeDecisionRecord,
} from "../state/speechJudgeDecisions"

const DRAFT_STORAGE_KEY = "debate-ai:speech-judge-draft"

function loadDraft(): JudgedSpeech[] | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const speeches = parsed.filter(
      (s): s is JudgedSpeech =>
        typeof s === "object" &&
        s !== null &&
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        typeof s.text === "string" &&
        (s.side === "aff" || s.side === "neg"),
    )
    return speeches.length > 0 ? speeches : null
  } catch {
    return null
  }
}

function saveDraft(speeches: JudgedSpeech[]) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(speeches))
  } catch {
    // Storage unavailable; the draft just won't survive a reload.
  }
}

/** The line under a fresh verdict saying where it was kept. */
function describeSave(record: SpeechJudgeDecisionRecord | null): string {
  if (!record) return "Not saved — this browser's storage is full or unavailable."
  if (!isToolRecordSyncEnabled()) return "Saved on this device. Sign in to keep your verdicts on your account."
  if (!fitsInAccountRow(record)) return "Saved on this device only — these speeches are too long to save to your account."
  return "Saved to your account."
}

function formatJudgedAt(judgedAt: number): string {
  return new Date(judgedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function speechCountLabel(count: number): string {
  return count === 1 ? "1 speech" : `${count} speeches`
}

/** Renders the pasted-speeches judging section. */
export function SpeechJudgeSection() {
  const [speeches, setSpeeches] = useState<JudgedSpeech[]>(() => createPresetSpeeches())
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [saved, setSaved] = useState<SpeechJudgeDecisionRecord[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refreshSaved = useCallback(() => setSaved(listSpeechJudgeDecisions()), [])

  useEffect(() => {
    const draft = loadDraft()
    if (draft) setSpeeches(draft)
    setDraftLoaded(true)
    refreshSaved()
  }, [refreshSaved])

  // Another tab's save or delete, or an account merge adopting verdicts from
  // another device, arrives as a `storage` event on the store's key.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (isSpeechJudgeDecisionsStorageEvent(event)) refreshSaved()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [refreshSaved])

  useEffect(() => {
    if (draftLoaded) saveDraft(speeches)
  }, [speeches, draftLoaded])

  const updateSpeech = (id: string, patch: Partial<JudgedSpeech>) => {
    setSpeeches((prev) => prev.map((speech) => (speech.id === id ? { ...speech, ...patch } : speech)))
  }

  const removeSpeech = (id: string) => {
    setSpeeches((prev) => prev.filter((speech) => speech.id !== id))
  }

  const addSpeech = () => {
    setSpeeches((prev) => [
      ...prev,
      { id: generateSpeechId(), name: `Speech ${prev.length + 1}`, side: nextSpeechSide(prev), text: "" },
    ])
  }

  const resetToPreset = () => {
    if (hasSpeechContent(speeches) && !window.confirm("Clear all pasted speeches and reset to the 8-speech preset?")) {
      return
    }
    setSpeeches(createPresetSpeeches())
    setDecision(null)
    setSaveNote(null)
    setError(null)
  }

  const loadSavedSpeeches = (record: SpeechJudgeDecisionRecord) => {
    if (hasSpeechContent(speeches) && !window.confirm("Replace the speeches in the editor with the ones from this verdict?")) {
      return
    }
    setSpeeches(record.speeches.map((speech) => ({ ...speech })))
    setError(null)
  }

  const deleteSaved = (id: string) => {
    deleteSpeechJudgeDecision(id)
    if (expandedId === id) setExpandedId(null)
    refreshSaved()
  }

  const handleJudge = async () => {
    if (!hasSpeechContent(speeches)) {
      setError("Paste at least one speech to judge.")
      return
    }
    setLoading(true)
    setError(null)
    setSaveNote(null)
    try {
      const judged = speeches
      const result = await requestSpeechJudgeDecision(judged)
      setDecision(result)
      const { record } = saveSpeechJudgeDecision({
        speeches: judged,
        decision: result,
        judgeName: STANDARD_JUDGE_NAME,
        judgedAt: Date.now(),
      })
      setSaveNote(describeSave(record))
      refreshSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI judge request failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PanelSection
      title="Judge pasted speeches"
      description={`Paste each speech from your Debate Editor docs. ${STANDARD_JUDGE_NAME} decides the round, then critiques each speech and suggests alternatives. Add, remove, or rename speeches for any format.`}
      actions={
        <Button size="sm" variant="ghost" onClick={resetToPreset}>
          Reset to 8-speech preset
        </Button>
      }
      className="rounded-lg border border-border p-4 space-y-4"
    >
      <ol className="space-y-3">
        {speeches.map((speech, index) => (
          <li key={speech.id} className="rounded-md border border-border/70 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{index + 1}.</span>
              <Input
                aria-label={`Speech ${index + 1} name`}
                className="h-8 w-32"
                value={speech.name}
                onChange={(e) => updateSpeech(speech.id, { name: e.target.value })}
              />
              <Button
                size="sm"
                variant="outline"
                aria-label={`Speech ${index + 1} side: ${SPEECH_SIDE_LABEL[speech.side]}. Click to switch.`}
                onClick={() => updateSpeech(speech.id, { side: speech.side === "aff" ? "neg" : "aff" })}
              >
                {SPEECH_SIDE_LABEL[speech.side]}
              </Button>
              <span className="text-xs text-muted-foreground">
                {speech.text.trim() ? `${speech.text.trim().split(/\s+/).length} words` : "Empty"}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => removeSpeech(speech.id)}>
                Remove
              </Button>
            </div>
            <Textarea
              aria-label={`Speech ${index + 1} text`}
              className="max-h-72 min-h-20"
              value={speech.text}
              onChange={(e) => updateSpeech(speech.id, { text: e.target.value })}
              placeholder={`Paste the ${speech.name || "speech"} here`}
            />
            <FallacyHints text={speech.text} />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={addSpeech}>
          Add speech
        </Button>
        <Button onClick={handleJudge} disabled={loading}>
          {loading ? `Asking ${STANDARD_JUDGE_NAME}…` : "Judge these speeches"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {decision && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">{STANDARD_JUDGE_NAME}</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDecision(null)
                setSaveNote(null)
              }}
            >
              Clear
            </Button>
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground">{decision}</div>
        </div>
      )}

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {saveNote ?? ""}
      </p>

      {saved.length > 0 && (
        <section aria-labelledby="saved-speech-verdicts-heading" className="space-y-2">
          <h3 id="saved-speech-verdicts-heading" className="text-sm font-medium text-foreground">
            Saved verdicts ({saved.length})
          </h3>
          <ul className="space-y-2">
            {saved.map((record) => {
              const expanded = expandedId === record.id
              return (
                <li key={record.id} className="rounded-md border border-border/70 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{record.judgeName}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatJudgedAt(record.judgedAt)} · {speechCountLabel(countJudgedSpeeches(record))}
                    </span>
                    <div className="ml-auto flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : record.id)}
                      >
                        {expanded ? "Hide" : "Show"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => loadSavedSpeeches(record)}>
                        Load speeches
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete the verdict from ${formatJudgedAt(record.judgedAt)}`}
                        onClick={() => deleteSaved(record.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="whitespace-pre-wrap text-sm text-foreground">{record.decision}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{previewSpeechJudgeDecision(record.decision)}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </PanelSection>
  )
}
