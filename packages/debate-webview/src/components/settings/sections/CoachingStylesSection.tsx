"use client"

/**
 * @fileoverview Settings → General: the coaching style each AI coach picker
 * remembers.
 *
 * Four pickers save their own choice (`@debate-ai/speech-writer`'s
 * `state/coachPersonaPreferences.ts`, one record per surface): AI Coach
 * Mode's "Get AI feedback", Coach Materials' "Ask the coach", the Practice vs
 * AI scorecard's coach debrief, and Practice vs AI's **Judge feedback style**.
 * Before this section a remembered style could only be seen, or changed, on
 * the page that owns it. Here every surface is listed with its current style,
 * a picker to change it, and **Reset all to Standard**.
 *
 * Changes go through `saveCoachPersonaPreference`, the same write the
 * pickers make, so the tool-record sync (`coachPersonaPreferences`) carries
 * them to the account and the owning pickers follow them through their
 * `storage` listeners. A reset *saves* Standard rather than removing the
 * record: the account merge is a union, so a removed record would come back
 * from the account on the next merge.
 *
 * @module components/settings/sections/CoachingStylesSection
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { GraduationCap } from "lucide-react"
import {
  DEFAULT_COACH_PERSONA_ID,
  getCoachPersonaPreference,
  isCoachPersonaId,
  isCoachPersonaPreferencesStorageEvent,
  listCoachPersonas,
  saveCoachPersonaPreference,
  type CoachPersonaId,
  type CoachPersonaSurface,
} from "@debate-ai/speech-writer"
import { Label } from "../../../ui/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/primitives/select"
import { describeToolStorage } from "../../../lib/tools/tool-storage"

/** The same "where it's saved" line the tool storage list prints for a synced tool. */
const SYNC_NOTE = describeToolStorage({ kind: "synced", collections: ["coachPersonaPreferences"] })

/** Every picker that remembers a style, in the order listed, with where it lives. */
export const COACHING_STYLE_SURFACES: readonly {
  surface: CoachPersonaSurface
  label: string
  tool: string
  href: string
}[] = [
  { surface: "ai-coach-feedback", label: "Get AI feedback", tool: "AI Coach Mode", href: "/coaching/ai-coach" },
  { surface: "team-coach", label: "Ask the coach", tool: "Coach Materials", href: "/coaching/materials" },
  { surface: "practice-vs-ai", label: "Coach debrief", tool: "Practice vs AI", href: "/practice/versus-ai" },
  { surface: "practice-vs-ai-judge", label: "Judge feedback style", tool: "Practice vs AI", href: "/practice/versus-ai" },
]

const PERSONAS = listCoachPersonas()

type Styles = Record<CoachPersonaSurface, CoachPersonaId>

/** Every surface at Standard: the server render and the first client render. */
function defaultStyles(): Styles {
  return Object.fromEntries(
    COACHING_STYLE_SURFACES.map(({ surface }) => [surface, DEFAULT_COACH_PERSONA_ID]),
  ) as Styles
}

/** Every surface's stored style (Standard when none, or when it is unusable). */
function readStyles(): Styles {
  return Object.fromEntries(
    COACHING_STYLE_SURFACES.map(({ surface }) => [surface, getCoachPersonaPreference(surface)]),
  ) as Styles
}

/**
 * The coaching-styles block of Settings → General. Reads the stored styles
 * after mount, follows other tabs and the account merge through `storage`
 * events, and writes through the same store the pickers use.
 */
export function CoachingStylesSection() {
  const [styles, setStyles] = useState<Styles>(defaultStyles)

  useEffect(() => {
    setStyles(readStyles())
    const onStorage = (event: StorageEvent) => {
      if (isCoachPersonaPreferencesStorageEvent(event)) setStyles(readStyles())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const change = useCallback((surface: CoachPersonaSurface, value: string) => {
    if (!isCoachPersonaId(value)) return
    saveCoachPersonaPreference(surface, value)
    // Re-read rather than trust the click: a failed write (quota, disabled
    // storage) leaves the stored style, and the row should show that.
    setStyles(readStyles())
  }, [])

  const resetAll = useCallback(() => {
    // Only the surfaces off Standard: one never set stays unset, so a reset
    // doesn't push records nobody picked.
    for (const { surface } of COACHING_STYLE_SURFACES) {
      if (getCoachPersonaPreference(surface) !== DEFAULT_COACH_PERSONA_ID) {
        saveCoachPersonaPreference(surface, DEFAULT_COACH_PERSONA_ID)
      }
    }
    setStyles(readStyles())
  }, [])

  const anyCustom = COACHING_STYLE_SURFACES.some(({ surface }) => styles[surface] !== DEFAULT_COACH_PERSONA_ID)

  return (
    <section
      id="coaching-styles"
      aria-labelledby="coaching-styles-heading"
      className="mb-4 rounded-lg border border-border p-4"
    >
      <h4
        id="coaching-styles-heading"
        className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        Coaching styles
      </h4>
      <p className="mb-3 text-xs text-muted-foreground">
        Each AI coach remembers the style you last picked. Change one here, or on its own page.
      </p>
      <ul className="space-y-3 text-sm">
        {COACHING_STYLE_SURFACES.map(({ surface, label, tool, href }) => {
          const id = `settings-coaching-style-${surface}`
          return (
            <li key={surface} className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Label htmlFor={id}>{label}</Label>
                <div className="text-xs text-muted-foreground">
                  <Link href={href} className="underline underline-offset-2">
                    {tool}
                  </Link>
                </div>
              </div>
              <Select value={styles[surface]} onValueChange={(value) => change(surface, value)}>
                <SelectTrigger id={id} className="w-44" aria-label={`${label} coaching style`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONAS.map((persona) => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{SYNC_NOTE}</p>
        <button
          type="button"
          onClick={resetAll}
          disabled={!anyCustom}
          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset all to Standard
        </button>
      </div>
    </section>
  )
}
