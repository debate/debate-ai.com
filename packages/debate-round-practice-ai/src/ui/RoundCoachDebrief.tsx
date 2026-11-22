/**
 * @fileoverview **Coach debrief** on the Practice vs AI scorecard: pick a
 * coaching style (Standard, Socratic, Devil's Advocate, Fact-Checker) and ask
 * an AI coach to turn the judge's scorecard and your speeches into a short
 * debrief.
 *
 * The picked style is remembered under the `"practice-vs-ai"` surface of
 * `@debate-ai/speech-writer`'s coach persona preferences, which sync to a
 * signed-in account through the `coachPersonaPreferences` tool-record
 * collection. A `storage` event for that key (another tab, or an account
 * merge) updates the open picker.
 *
 * The AI call goes through `requestRoundDebrief` (`/api/reason-ai`) unless a
 * host or test passes `requestDebrief`.
 *
 * When the host passes `saveDebrief`, each debrief that arrives is kept with
 * the round (`POST /api/vsbot/debrief`), so Debate History shows it again.
 * A line under the debrief says whether that worked.
 *
 * @module ui/RoundCoachDebrief
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquareText } from "lucide-react"
import {
  DEFAULT_COACH_PERSONA_ID,
  getCoachPersonaPreference,
  isCoachPersonaPreferencesStorageEvent,
  listCoachPersonas,
  requestRoundDebrief,
  resolveCoachPersona,
  saveCoachPersonaPreference,
  type CoachPersonaId,
  type RequestRoundDebriefOptions,
  type RoundDebriefInput,
} from "@debate-ai/speech-writer"
import { Button } from "@debate-ai/speech-writer/src/ui/primitives/button"

const COACH_PERSONAS = listCoachPersonas()
const SURFACE = "practice-vs-ai"

export type RequestRoundDebrief = (
  input: RoundDebriefInput,
  options: RequestRoundDebriefOptions,
) => Promise<string>

/**
 * Keep a debrief with its round. Resolves `true` once stored, `false` when
 * nothing keeps it (a signed-out player's round), and `"superseded"` when the
 * round already keeps a debrief written later (another tab or device);
 * rejects on failure. `writtenAt` (Unix ms) is when the debrief reached the
 * scorecard, so the server can keep the later-written one.
 */
export type SaveRoundDebrief = (debrief: {
  personaId: CoachPersonaId
  text: string
  writtenAt: number
}) => Promise<boolean | "superseded">

export interface RoundCoachDebriefProps {
  /** The round, as `buildRoundDebriefInput` produces it. */
  input: RoundDebriefInput
  /** Overrides the AI call (tests, or a host with its own endpoint). */
  requestDebrief?: RequestRoundDebrief
  /** Keeps each new debrief with the round. Omit and nothing is saved or said. */
  saveDebrief?: SaveRoundDebrief
}

type Debrief = { personaId: CoachPersonaId; text: string }

type SaveState = "idle" | "saving" | "saved" | "not-saved" | "superseded" | "failed"

const SAVE_MESSAGES: Record<Exclude<SaveState, "idle">, string> = {
  saving: "Saving to Debate History…",
  saved: "Saved with this round in Debate History.",
  "not-saved": "Not saved — sign in to keep debriefs with your rounds.",
  superseded: "Not saved — a newer debrief for this round is already in Debate History.",
  failed: "Couldn't save this debrief to Debate History.",
}

export function RoundCoachDebrief({
  input,
  requestDebrief = requestRoundDebrief,
  saveDebrief,
}: RoundCoachDebriefProps) {
  const [personaId, setPersonaId] = useState<CoachPersonaId>(DEFAULT_COACH_PERSONA_ID)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const abortRef = useRef<AbortController | null>(null)
  // Bumped per request, so a slow save for an older debrief can't overwrite
  // the status of the one on screen.
  const saveTokenRef = useRef(0)

  const keepDebrief = async (next: Debrief) => {
    if (!saveDebrief) return
    const token = ++saveTokenRef.current
    setSaveState("saving")
    try {
      const saved = await saveDebrief({ ...next, writtenAt: Date.now() })
      if (token === saveTokenRef.current) {
        setSaveState(saved === "superseded" ? "superseded" : saved ? "saved" : "not-saved")
      }
    } catch {
      if (token === saveTokenRef.current) setSaveState("failed")
    }
  }

  // Read the saved style on the client only, so SSR and the first render agree.
  useEffect(() => {
    setPersonaId(getCoachPersonaPreference(SURFACE))
    const handleStorage = (event: StorageEvent) => {
      if (isCoachPersonaPreferencesStorageEvent(event)) setPersonaId(getCoachPersonaPreference(SURFACE))
    }
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener("storage", handleStorage)
      abortRef.current?.abort()
    }
  }, [])

  const handlePick = (id: CoachPersonaId) => {
    setPersonaId(id)
    saveCoachPersonaPreference(SURFACE, id)
  }

  const handleRequest = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestedPersona = personaId
    setLoading(true)
    setError(null)
    try {
      const text = await requestDebrief(input, { personaId: requestedPersona, signal: controller.signal })
      if (controller.signal.aborted) return
      const next = { personaId: requestedPersona, text }
      setDebrief(next)
      void keepDebrief(next)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error && err.message ? err.message : "Couldn't get a coach debrief.")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const debriefPersona = debrief ? resolveCoachPersona(debrief.personaId) : null

  return (
    <section
      aria-labelledby="round-coach-debrief-title"
      className="mt-10 rounded-lg border border-border bg-card p-6 shadow-md"
    >
      <h3 id="round-coach-debrief-title" className="text-center text-2xl font-bold text-foreground">
        Coach debrief
      </h3>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        An AI coach reads the judge&apos;s scorecard and your speeches and tells you what to work on first.
      </p>

      <div className="mt-6 space-y-2">
        <p id="round-coach-debrief-style" className="text-sm font-medium text-foreground">
          Coaching style
        </p>
        <div role="group" aria-labelledby="round-coach-debrief-style" className="flex flex-wrap gap-2">
          {COACH_PERSONAS.map((persona) => (
            <Button
              key={persona.id}
              type="button"
              size="sm"
              variant={persona.id === personaId ? "default" : "outline"}
              aria-pressed={persona.id === personaId}
              onClick={() => handlePick(persona.id)}
            >
              {persona.name}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{resolveCoachPersona(personaId).description}</p>
      </div>

      <div className="mt-4 flex justify-center">
        <Button type="button" onClick={handleRequest} disabled={loading}>
          <MessageSquareText className="h-4 w-4" />
          {loading ? "Coach is reading the round…" : debrief ? "Get a new debrief" : "Get coach debrief"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      {debrief && debriefPersona && (
        <div className="mt-6 rounded-lg bg-muted p-4" data-testid="round-coach-debrief">
          {debriefPersona.id !== DEFAULT_COACH_PERSONA_ID && (
            <span className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {debriefPersona.name} coach
            </span>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{debrief.text}</p>
        </div>
      )}

      {saveDebrief && saveState !== "idle" && (
        <p
          aria-live="polite"
          data-testid="round-coach-debrief-save-status"
          className={`mt-2 text-center text-xs ${saveState === "failed" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {SAVE_MESSAGES[saveState]}
        </p>
      )}
    </section>
  )
}

export default RoundCoachDebrief
