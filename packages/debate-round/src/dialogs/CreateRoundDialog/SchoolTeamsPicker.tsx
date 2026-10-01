/**
 * @fileoverview The small "Teams at <school>" panel under a school field in
 * the Round Editor dialog. Lists the school's ranked teams in the round's
 * format; clicking one fills that side's debater names.
 */
"use client"

import { useEffect, useState } from "react"
import { Users, X } from "lucide-react"
import type { RankingEntry } from "debate-rankings-adapter"
import { lookupSchoolTeams, splitEntryDebaters } from "../../round/school-teams"

/** Wait this long after the last keystroke before searching the rankings. */
const LOOKUP_DEBOUNCE_MS = 300

/** Props for {@link SchoolTeamsPicker}. */
interface SchoolTeamsPickerProps {
  school: string
  /** Key into `debateStyles`, e.g. `"publicForum"`. */
  styleKey: string
  /** Called with the picked team's debater names, first speaker first. */
  onPick: (debaters: string[]) => void
}

/**
 * Previews the teams at `school` and lets the user pick the one they face.
 * Renders nothing until the lookup finds at least one team.
 */
export function SchoolTeamsPicker({ school, styleKey, onPick }: SchoolTeamsPickerProps) {
  const [teams, setTeams] = useState<RankingEntry[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      lookupSchoolTeams(styleKey, school).then((found) => {
        if (!cancelled) setTeams(found)
      })
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [school, styleKey])

  if (teams.length === 0 || dismissedFor === school) return null

  function pick(entry: RankingEntry) {
    setPicked(entry.hash)
    onPick(splitEntryDebaters(entry.name))
  }

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/40 p-2 space-y-1.5"
      data-testid="school-teams-picker"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">Teams at {teams[0].school}</span>
        <button
          type="button"
          onClick={() => setDismissedFor(school)}
          className="hover:text-foreground transition-colors"
          title="Hide teams"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
        {teams.map((entry) => (
          <button
            key={entry.hash}
            type="button"
            onClick={() => pick(entry)}
            className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
              picked === entry.hash ? "bg-primary/15 text-foreground" : "hover:bg-muted"
            }`}
          >
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="text-muted-foreground tabular-nums">#{entry.rank}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
