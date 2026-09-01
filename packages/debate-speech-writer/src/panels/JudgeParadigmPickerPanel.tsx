/**
 * @fileoverview Judge Paradigm Picker panel — the "(b) a paradigm-picker UI
 * for selecting a built-in paradigm or entering a custom judge's notes that
 * reads/writes through the persistence store" follow-up named under idea #5
 * ("AI Judge Decision Modes") in TODO.md's Product Feature Ideas list.
 *
 * Lets a user pick a round's judge paradigm — one of the six built-in
 * paradigms from `judge/judge-paradigms.ts`, or a custom paradigm built from
 * a real judge's own publicly stated preferences via
 * `buildCustomJudgeParadigm` — and saves it through the already-persisted
 * `state/judgeParadigmSelections.ts` (`saveJudgeParadigmSelection`,
 * `deleteJudgeParadigmSelection`). Also lists every round with a saved
 * selection via `buildJudgeParadigmSelectionsPanelView`. No new
 * paradigm-resolution logic is introduced here.
 *
 * @module panels/JudgeParadigmPickerPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-ui/src/primitives/radio-group"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  buildCustomJudgeParadigm,
  buildJudgeParadigmPrompt,
  listJudgeParadigms,
  type BuiltinJudgeParadigmId,
} from "../judge/judge-paradigms"
import {
  buildJudgeDecisionDeepLink,
  buildJudgeParadigmSelectionsPanelView,
  deleteJudgeParadigmSelection,
  saveJudgeParadigmSelection,
  type JudgeParadigmSelection,
} from "../state/judgeParadigmSelections"

const BUILTIN_PARADIGMS = listJudgeParadigms()

type FormState = {
  roundId: string
  paradigmId: BuiltinJudgeParadigmId | "custom"
  customName: string
  customNotes: string
}

const EMPTY_FORM: FormState = {
  roundId: "",
  paradigmId: BUILTIN_PARADIGMS[0].id,
  customName: "",
  customNotes: "",
}

/**
 * Renders the Judge Paradigm Picker panel: a form to save a round's judge
 * paradigm (built-in or custom), plus every round with a saved selection,
 * each with a "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function JudgeParadigmPickerPanel() {
  const [selections, setSelections] = useState<JudgeParadigmSelection[] | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [previewRoundId, setPreviewRoundId] = useState<string | null>(null)
  const [copiedRoundId, setCopiedRoundId] = useState<string | null>(null)

  useEffect(() => {
    setSelections(buildJudgeParadigmSelectionsPanelView())
  }, [])

  const refresh = () => setSelections(buildJudgeParadigmSelectionsPanelView())

  const handleSave = () => {
    const roundId = form.roundId.trim()
    if (!roundId) {
      setError("Round ID is required.")
      return
    }

    if (form.paradigmId === "custom") {
      try {
        const paradigm = buildCustomJudgeParadigm({ name: form.customName, notes: form.customNotes })
        saveJudgeParadigmSelection({ roundId, paradigm })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build custom paradigm.")
        return
      }
    } else {
      const paradigm = BUILTIN_PARADIGMS.find((candidate) => candidate.id === form.paradigmId)
      if (!paradigm) {
        setError("Select a paradigm.")
        return
      }
      saveJudgeParadigmSelection({ roundId, paradigm })
    }

    setError(null)
    setForm(EMPTY_FORM)
    refresh()
  }

  const handleClear = (roundId: string) => {
    deleteJudgeParadigmSelection(roundId)
    if (previewRoundId === roundId) setPreviewRoundId(null)
    refresh()
  }

  const togglePreview = (roundId: string) => {
    setPreviewRoundId((prev) => (prev === roundId ? null : roundId))
  }

  const handleCopyPrompt = async (roundId: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedRoundId(roundId)
      setTimeout(() => setCopiedRoundId((prev) => (prev === roundId ? null : prev)), 2000)
    } catch {
      // Clipboard access can be denied by the browser; the prompt text is
      // still visible in the preview below for a manual copy.
    }
  }

  if (selections === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading judge paradigm selections…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Judge Paradigm Picker</h1>
        <p className="text-sm text-muted-foreground">
          Pick a built-in AI judge paradigm for a round, or enter a real judge's own publicly stated
          preferences as a custom paradigm.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="paradigm-round-id">Round ID</Label>
          <Input
            id="paradigm-round-id"
            value={form.roundId}
            onChange={(e) => setForm((prev) => ({ ...prev, roundId: e.target.value }))}
            placeholder="round-1"
            className="max-w-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Paradigm</Label>
          <RadioGroup
            value={form.paradigmId}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, paradigmId: value as FormState["paradigmId"] }))
            }
          >
            {BUILTIN_PARADIGMS.map((paradigm) => (
              <div key={paradigm.id} className="flex items-start gap-2">
                <RadioGroupItem value={paradigm.id} id={`paradigm-${paradigm.id}`} className="mt-0.5" />
                <Label htmlFor={`paradigm-${paradigm.id}`} className="font-normal">
                  <span className="text-foreground">{paradigm.name}</span>{" "}
                  <span className="text-muted-foreground">— {paradigm.description}</span>
                </Label>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <RadioGroupItem value="custom" id="paradigm-custom" className="mt-0.5" />
              <Label htmlFor="paradigm-custom" className="font-normal text-foreground">
                Custom judge paradigm
              </Label>
            </div>
          </RadioGroup>
        </div>

        {form.paradigmId === "custom" && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="paradigm-custom-name">Judge name</Label>
              <Input
                id="paradigm-custom-name"
                value={form.customName}
                onChange={(e) => setForm((prev) => ({ ...prev, customName: e.target.value }))}
                placeholder="Judge Smith"
                className="max-w-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paradigm-custom-notes">Publicly stated preferences</Label>
              <Textarea
                id="paradigm-custom-notes"
                value={form.customNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, customNotes: e.target.value }))}
                placeholder="Votes on framework first, dislikes speed…"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Save paradigm for round</Button>
      </div>

      {selections.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No judge paradigm selections yet. Save one above to see it here.
        </div>
      ) : (
        <div className="space-y-2">
          {selections.map((selection) => {
            const isPreviewing = previewRoundId === selection.roundId
            const prompt = buildJudgeParadigmPrompt(selection.paradigm)
            return (
              <div key={selection.roundId} className="rounded-md border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Round {selection.roundId}</span>
                    <Badge variant="outline">{selection.paradigm.name}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => togglePreview(selection.roundId)}>
                      {isPreviewing ? "Hide prompt" : "Preview prompt"}
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={buildJudgeDecisionDeepLink(selection.roundId)}>Get AI judge decision →</a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleClear(selection.roundId)}>
                      Clear
                    </Button>
                  </div>
                </div>
                {isPreviewing && (
                  <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Prompt text sent to the AI judge for this paradigm
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyPrompt(selection.roundId, prompt)}
                      >
                        {copiedRoundId === selection.roundId ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs text-foreground">{prompt}</pre>
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
