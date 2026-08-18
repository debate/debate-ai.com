/**
 * @fileoverview Opponent Persona Picker panel — the "(b) a persona-picker UI
 * that reads/writes through the persistence store" follow-up named under the
 * "AI Practice Opponent" idea in TODO.md's Product Feature Ideas list.
 *
 * Lets a user pick a practice session's AI opponent persona — one of the
 * four built-in personas from `opponent/opponent-personas.ts` — and saves it
 * through the already-persisted `state/opponentPersonaSelections.ts`
 * (`saveOpponentPersonaSelection`, `deleteOpponentPersonaSelection`). Also
 * lists every session with a saved selection via
 * `buildOpponentPersonaSelectionsPanelView`. No new persona-resolution logic
 * is introduced here.
 *
 * @module panels/OpponentPersonaPickerPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-ui/src/primitives/radio-group"
import { listOpponentPersonas, type BuiltinOpponentPersonaId } from "../opponent/opponent-personas"
import {
  buildOpponentPersonaSelectionsPanelView,
  deleteOpponentPersonaSelection,
  saveOpponentPersonaSelection,
  type OpponentPersonaSelection,
} from "../state/opponentPersonaSelections"

const BUILTIN_PERSONAS = listOpponentPersonas()

type FormState = {
  sessionId: string
  personaId: BuiltinOpponentPersonaId
}

const EMPTY_FORM: FormState = {
  sessionId: "",
  personaId: BUILTIN_PERSONAS[0].id,
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

    const persona = BUILTIN_PERSONAS.find((candidate) => candidate.id === form.personaId)
    if (!persona) {
      setError("Select a persona.")
      return
    }

    saveOpponentPersonaSelection({ sessionId, persona })
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
              setForm((prev) => ({ ...prev, personaId: value as BuiltinOpponentPersonaId }))
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
