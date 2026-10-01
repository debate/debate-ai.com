/**
 * @fileoverview The small "Teams at <school>" pop-out beside a school field
 * in the Round Editor dialog. Lists the school's ranked teams in the round's
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
  /**
   * Which side of the field the pop-out opens on. The parent must be
   * `relative`; the pop-out opens toward the dialog's middle so it stays
   * inside the dialog.
   */
  side: "left" | "right"
  /** Called with the picked team's debater names, first speaker first. */
  onPick: (debaters: string[]) => void
}

/**
 * Previews the teams at `school` and lets the user pick the one they face.
 * Renders nothing until the lookup finds at least one team, and closes once
 * a team is picked (the × closes it without picking).
 */
export function SchoolTeamsPicker({ school, styleKey, side, onPick }: SchoolTeamsPickerProps) {
  const [teams, setTeams] = useState<RankingEntry[]>([])
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
    onPick(splitEntryDebaters(entry.name))
    setDismissedFor(school)
  }

  return (
    <div
      className={`absolute top-0 z-40 w-56 rounded-md border border-border bg-popover p-2 space-y-1.5 shadow-md ${
        side === "right" ? "left-full ml-2" : "right-full mr-2"
      }`}
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
            className="flex items-center gap-2 px-2 py-1 rounded text-xs text-left hover:bg-muted transition-colors"
          >
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="text-muted-foreground tabular-nums">#{entry.rank}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
