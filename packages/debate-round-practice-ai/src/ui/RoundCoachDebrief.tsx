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

export interface RoundCoachDebriefProps {
  /** The round, as `buildRoundDebriefInput` produces it. */
  input: RoundDebriefInput
  /** Overrides the AI call (tests, or a host with its own endpoint). */
  requestDebrief?: RequestRoundDebrief
}

type Debrief = { personaId: CoachPersonaId; text: string }

export function RoundCoachDebrief({ input, requestDebrief = requestRoundDebrief }: RoundCoachDebriefProps) {
  const [personaId, setPersonaId] = useState<CoachPersonaId>(DEFAULT_COACH_PERSONA_ID)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debrief, setDebrief] = useState<Debrief | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
      setDebrief({ personaId: requestedPersona, text })
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
    </section>
  )
}

export default RoundCoachDebrief
