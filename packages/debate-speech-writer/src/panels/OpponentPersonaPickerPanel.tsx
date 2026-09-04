/**
 * @fileoverview Opponent Persona Picker panel — the "(b) a persona-picker UI
 * that reads/writes through the persistence store" follow-up named under the
 * "AI Practice Opponent" idea in TODO.md's Product Feature Ideas list.
 *
 * Lets a user pick a practice session's AI opponent persona — one of the
 * four built-in personas from `opponent/opponent-personas.ts`, or a custom
 * persona built from the user's own style description via
 * `buildCustomOpponentPersona` (the "custom opponent-persona authoring flow"
 * follow-up named in `docs/features/practice-opponent.md`'s Known gaps,
 * mirroring `JudgeParadigmPickerPanel.tsx`'s custom-paradigm form) — and
 * saves it through the already-persisted `state/opponentPersonaSelections.ts`
 * (`saveOpponentPersonaSelection`, `deleteOpponentPersonaSelection`). Also
 * lists every session with a saved selection via
 * `buildOpponentPersonaSelectionsPanelView`. No new persona-resolution logic
 * is introduced here.
 *
 * A second radio group, "Difficulty," closes the "a difficulty slider
 * layered on top of persona choice" Next item named under the "🤖 AI
 * Practice Opponent" idea in TODO.md's Research Crowdsourcing Organizer
 * Features list — the four `opponent-personas.ts` `opponentDifficulties`
 * levels (Beginner/Intermediate/Advanced/Elite), independent of which
 * persona is chosen, saved alongside it on the same
 * `OpponentPersonaSelection` and shown as a second badge per session.
 *
 * @module panels/OpponentPersonaPickerPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { RadioGroup, RadioGroupItem } from "../ui/primitives/radio-group"
import { Textarea } from "../ui/primitives/textarea"
import {
  buildCustomOpponentPersona,
  DEFAULT_OPPONENT_DIFFICULTY,
  listOpponentDifficulties,
  listOpponentPersonas,
  opponentDifficulties,
  type OpponentDifficulty,
  type OpponentPersonaId,
} from "../opponent/opponent-personas"
import {
  buildOpponentPersonaSelectionsPanelView,
  deleteOpponentPersonaSelection,
  saveOpponentPersonaSelection,
  type OpponentPersonaSelection,
} from "../state/opponentPersonaSelections"

const BUILTIN_PERSONAS = listOpponentPersonas()
const DIFFICULTIES = listOpponentDifficulties()

type FormState = {
  sessionId: string
  personaId: OpponentPersonaId
  customName: string
  customNotes: string
  difficulty: OpponentDifficulty
}

const EMPTY_FORM: FormState = {
  sessionId: "",
  personaId: BUILTIN_PERSONAS[0].id,
  customName: "",
  customNotes: "",
  difficulty: DEFAULT_OPPONENT_DIFFICULTY,
}

/**
 * Renders the Opponent Persona Picker panel: a form to save a practice
 * session's AI opponent persona, plus every session with a saved selection,
 * each with a "Clear" action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function OpponentPersonaPickerPanel() {
  const [selections, setSelections] = useState<OpponentPersonaSelection[] | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelections(buildOpponentPersonaSelectionsPanelView())
  }, [])

  const refresh = () => setSelections(buildOpponentPersonaSelectionsPanelView())

  const handleSave = () => {
    const sessionId = form.sessionId.trim()
    if (!sessionId) {
      setError("Session ID is required.")
      return
    }

    if (form.personaId === "custom") {
      try {
        const persona = buildCustomOpponentPersona({ name: form.customName, notes: form.customNotes })
        saveOpponentPersonaSelection({ sessionId, persona, difficulty: form.difficulty })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build custom persona.")
        return
      }
    } else {
      const persona = BUILTIN_PERSONAS.find((candidate) => candidate.id === form.personaId)
      if (!persona) {
        setError("Select a persona.")
        return
      }
      saveOpponentPersonaSelection({ sessionId, persona, difficulty: form.difficulty })
    }

    setError(null)
    setForm(EMPTY_FORM)
    refresh()
  }

  const handleClear = (sessionId: string) => {
    deleteOpponentPersonaSelection(sessionId)
    refresh()
  }

  if (selections === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading opponent persona selections…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Opponent Persona Picker</h1>
        <p className="text-sm text-muted-foreground">
          Pick the AI practice-opponent style for a session — policy heavy, kritik, lay, or fast-flow.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="persona-session-id">Session ID</Label>
          <Input
            id="persona-session-id"
            value={form.sessionId}
            onChange={(e) => setForm((prev) => ({ ...prev, sessionId: e.target.value }))}
            placeholder="session-1"
            className="max-w-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Opponent persona</Label>
          <RadioGroup
            value={form.personaId}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, personaId: value as OpponentPersonaId }))
            }
          >
            {BUILTIN_PERSONAS.map((persona) => (
              <div key={persona.id} className="flex items-start gap-2">
                <RadioGroupItem value={persona.id} id={`persona-${persona.id}`} className="mt-0.5" />
                <Label htmlFor={`persona-${persona.id}`} className="font-normal">
                  <span className="text-foreground">{persona.name}</span>{" "}
                  <span className="text-muted-foreground">— {persona.description}</span>
                </Label>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <RadioGroupItem value="custom" id="persona-custom" className="mt-0.5" />
              <Label htmlFor="persona-custom" className="font-normal text-foreground">
                Custom opponent persona
              </Label>
            </div>
          </RadioGroup>
        </div>

        {form.personaId === "custom" && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="persona-custom-name">Persona name</Label>
              <Input
                id="persona-custom-name"
                value={form.customName}
                onChange={(e) => setForm((prev) => ({ ...prev, customName: e.target.value }))}
                placeholder="Coach Amy's aggressive K bot"
                className="max-w-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="persona-custom-notes">Debating style</Label>
              <Textarea
                id="persona-custom-notes"
                value={form.customNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, customNotes: e.target.value }))}
                placeholder="Opens on framework, spreads fast, extends drops…"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <RadioGroup
            value={form.difficulty}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, difficulty: value as OpponentDifficulty }))
            }
          >
            {DIFFICULTIES.map((level) => (
              <div key={level.id} className="flex items-start gap-2">
                <RadioGroupItem value={level.id} id={`difficulty-${level.id}`} className="mt-0.5" />
                <Label htmlFor={`difficulty-${level.id}`} className="font-normal">
                  <span className="text-foreground">{level.name}</span>{" "}
                  <span className="text-muted-foreground">— {level.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Save persona for session</Button>
      </div>

      {selections.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No opponent persona selections yet. Save one above to see it here.
        </div>
      ) : (
        <div className="space-y-2">
          {selections.map((selection) => (
            <div
              key={selection.sessionId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Session {selection.sessionId}</span>
                <Badge variant="outline">{selection.persona.name}</Badge>
                <Badge variant="outline">
                  {opponentDifficulties[selection.difficulty ?? DEFAULT_OPPONENT_DIFFICULTY].name}
                </Badge>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleClear(selection.sessionId)}>
                Clear
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
