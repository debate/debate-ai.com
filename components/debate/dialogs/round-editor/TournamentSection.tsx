"use client"

/**
 * @fileoverview Tournament info section of the Round Editor dialog.
 *
 * Renders the tournament name input with autocomplete suggestions,
 * the round level selector, and the public/private visibility toggle.
 *
 * @module components/debate/dialogs/round-editor/TournamentSection
 */

import { Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ROUND_LEVELS } from "./constants"

/** Props for {@link TournamentSection}. */
interface TournamentSectionProps {
  /** Current tournament name value */
  tournamentName: string
  /** Update the tournament name */
  setTournamentName: (v: string) => void
  /** Filtered autocomplete suggestions to display */
  filteredSuggestions: string[]
  /** All fetched tournament suggestions (used to decide whether to open dropdown) */
  tournamentSuggestions: string[]
  /** Whether the autocomplete dropdown is visible */
  showAutocomplete: boolean
  /** Toggle autocomplete dropdown visibility */
  setShowAutocomplete: (v: boolean) => void
  /** Selected round level */
  roundLevel: string
  /** Update the round level */
  setRoundLevel: (v: string) => void
  /** Whether the round is private */
  isPrivate: boolean
  /** Toggle private/public visibility */
  setIsPrivate: (v: boolean) => void
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
  filteredSuggestions,
  tournamentSuggestions,
  showAutocomplete,
  setShowAutocomplete,
  roundLevel,
  setRoundLevel,
  isPrivate,
  setIsPrivate,
}: TournamentSectionProps) {
  return (
    <div className="grid grid-cols-4 gap-4 items-end">
      {/* Tournament Name with Autocomplete */}
      <div className="col-span-2 space-y-2 relative">
        <Input
          id="tournament-name"
          placeholder="e.g., Harvard Invitational"
          value={tournamentName}
          onChange={(e) => setTournamentName(e.target.value)}
          onFocus={() => {
            if (filteredSuggestions.length > 0 || tournamentSuggestions.length > 0) {
              setShowAutocomplete(true)
            }
          }}
          onBlur={() => {
            setTimeout(() => setShowAutocomplete(false), 200)
          }}
        />
        {showAutocomplete && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredSuggestions.map((name, index) => (
              <button
                key={index}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer text-sm"
                onClick={() => {
                  setTournamentName(name)
                  setShowAutocomplete(false)
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Round Level */}
      <div className="space-y-2">
        <Select value={roundLevel} onValueChange={setRoundLevel}>
          <SelectTrigger id="round-level">
            <SelectValue placeholder="Select round level" />
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

      {/* Visibility Toggle */}
      <div className="space-y-3 flex flex-col items-center pb-2">
        <Label htmlFor="visibility-toggle" className="text-xs text-muted-foreground mb-1">
          {isPrivate ? "Private" : "Public"}
        </Label>
        <div className="flex items-center gap-2">
          <Lock className={`h-4 w-4 ${!isPrivate ? "text-primary" : "text-muted-foreground"}`} />
          <Switch
            id="visibility-toggle"
            checked={isPrivate}
            onCheckedChange={setIsPrivate}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
    </div>
  )
}
