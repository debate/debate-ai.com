/**
 * @fileoverview Tournament info section of the Round Editor dialog.
 */

"use client"


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/primitives/select"
import { Autocomplete } from "../../ui/primitives/autocomplete"
import { ROUND_LEVELS } from "./constants"
import { settings } from "../../state/settings"
import type { RadioSetting } from "../../types/settings"
import { searchTournaments } from "../../cache/client-cache"
import { searchCurrentTournaments } from "../../round/tournament-field"

const TOURNAMENT_SUGGESTION_LIMIT = 10
const TOURNAMENT_DROPDOWN_CLASS = "right-auto w-[16rem] max-h-60 !overflow-y-auto"

/**
 * Tournament suggestions: Tabroom tournaments running now or coming up first
 * (all of them on an empty field), then the static list once 3+ letters are typed.
 */
async function fetchTournamentOptions(query: string): Promise<string[]> {
  const [current, past] = await Promise.all([
    searchCurrentTournaments(query, TOURNAMENT_SUGGESTION_LIMIT),
    query.trim().length > 2 ? searchTournaments(query, TOURNAMENT_SUGGESTION_LIMIT) : Promise.resolve([]),
  ])
  return [...new Set([...current, ...past])].slice(0, TOURNAMENT_SUGGESTION_LIMIT)
}
const TOURNAMENT_OPTION_CLASS = "!px-0"

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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
      {/* Tournament Name with Autocomplete */}
      <div className="col-span-2 space-y-2">
        <Autocomplete
          placeholder="Tournament Name"
          value={tournamentName}
          onChange={setTournamentName}
          fetchOptions={fetchTournamentOptions}
          dropdownClassName={TOURNAMENT_DROPDOWN_CLASS}
          optionClassName={TOURNAMENT_OPTION_CLASS}
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
