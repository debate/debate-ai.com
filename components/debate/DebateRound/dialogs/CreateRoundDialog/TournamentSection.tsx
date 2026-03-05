"use client"

/**
 * @fileoverview Tournament info section of the Round Editor dialog.
 *
 * Renders the tournament name input with autocomplete suggestions,
 * the round level selector, and the public/private visibility toggle.
 *
 * @module components/debate/dialogs/round-editor/TournamentSection
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Autocomplete } from "@/components/ui/autocomplete"
import { ROUND_LEVELS } from "./constants"
import { settings } from "@/lib/state/settings"
import type { RadioSetting } from "@/lib/types/settings"

async function fetchTournaments(q: string): Promise<string[]> {
  const res = await fetch(`/api/tournaments?q=${encodeURIComponent(q)}&limit=10`)
  const data = await res.json()
  return data.results ?? []
}

/** Props for {@link TournamentSection}. */
interface TournamentSectionProps {
  /** Current tournament name value */
  tournamentName: string
  /** Update the tournament name */
  setTournamentName: (v: string) => void
  /** Selected round level */
  roundLevel: string
  /** Update the round level */
  setRoundLevel: (v: string) => void
  /** Index of the currently selected debate style */
  debateStyleIndex: number
  /** Update the selected debate style index */
  setDebateStyleIndex: (v: number) => void
}

/**
 * Tournament information section with autocomplete, round level, and visibility.
 *
 * @param props - {@link TournamentSectionProps}
 * @returns The rendered section
 */
export function TournamentSection({
  tournamentName,
  setTournamentName,
  roundLevel,
  setRoundLevel,
  debateStyleIndex,
  setDebateStyleIndex,
}: TournamentSectionProps) {
  return (
    <div className="grid grid-cols-4 gap-4 items-end">
      {/* Tournament Name with Autocomplete */}
      <div className="col-span-2 space-y-2">
        <Autocomplete
          placeholder="Tournament Name"
          value={tournamentName}
          onChange={setTournamentName}
          fetchOptions={fetchTournaments}
        />
      </div>
      {/* Round Level */}
      <div className="col-span-1">
        <Select value={roundLevel} onValueChange={setRoundLevel}>
          <SelectTrigger id="round-level">
            <SelectValue placeholder="Round" />
          </SelectTrigger>
          <SelectContent>
            {ROUND_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Debate Style */}
      <Select
        value={debateStyleIndex.toString()}
        onValueChange={(value) => setDebateStyleIndex(Number.parseInt(value))}
      >
        <SelectTrigger id="debate-style">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          {(settings.data.debateStyle as RadioSetting).detail.options.map((option: string, index: number) => (
            <SelectItem key={index} value={index.toString()}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
