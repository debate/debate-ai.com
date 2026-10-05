/**
 * @fileoverview The row of team badges under a school field in the Round
 * Editor dialog. Lists up to five of the school's teams in the round's
 * format, taken from the picked tournament's field when it has the school,
 * otherwise from the rankings; clicking one fills that side's debaters.
 */
"use client"

import { useEffect, useState } from "react"
import type { FieldEntry } from "@debate/tournaments/client"
import { lookupSchoolTeams, splitEntryDebaters } from "../../round/school-teams"
import { findFieldTeams } from "../../round/tournament-field"

/** Wait this long after the last keystroke before searching the rankings. */
const LOOKUP_DEBOUNCE_MS = 300

/** At most this many badges per school. */
export const MAX_TEAM_BADGES = 5

const NO_ENTRIES: readonly FieldEntry[] = []

/** One clickable team. */
interface TeamBadge {
  key: string
  name: string
  /** Rankings place, when the team came from the rankings. */
  rank?: number
}

/** Props for {@link SchoolTeamsPicker}. */
interface SchoolTeamsPickerProps {
  school: string
  /** Key into `debateStyles`, e.g. `"publicForum"`. */
  styleKey: string
  /** Entries of the picked tournament in this format; searched before the rankings. */
  tournamentEntries?: readonly FieldEntry[]
  /** Hides the badges, e.g. once this side's debaters are filled in. */
  hidden?: boolean
  /** Called with the picked team's debater names, first speaker first. */
  onPick: (debaters: string[]) => void
}

/**
 * Badges for the teams at `school`. Renders nothing until a lookup finds a
 * team, while `hidden`, or once a team has been picked for this school.
 */
export function SchoolTeamsPicker({ school, styleKey, tournamentEntries = NO_ENTRIES, hidden = false, onPick }: SchoolTeamsPickerProps) {
  const [teams, setTeams] = useState<TeamBadge[]>([])
  const [pickedFor, setPickedFor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      const fromField = findFieldTeams(tournamentEntries, school, MAX_TEAM_BADGES)
      if (fromField.length > 0) {
        setTeams(fromField.map((e) => ({ key: `field-${e.id}`, name: e.name })))
        return
      }
      lookupSchoolTeams(styleKey, school).then((found) => {
        if (cancelled) return
        setTeams(found.slice(0, MAX_TEAM_BADGES).map((e) => ({ key: e.hash, name: e.name, rank: e.rank })))
      })
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [school, styleKey, tournamentEntries])

  if (hidden || teams.length === 0 || pickedFor === school) return null

  function pick(team: TeamBadge) {
    onPick(splitEntryDebaters(team.name))
    setPickedFor(school)
  }

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="school-teams-picker">
      {teams.map((team) => (
        <button
          key={team.key}
          type="button"
          onClick={() => pick(team)}
          title={team.rank ? `Ranked #${team.rank}` : undefined}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        >
          <span className="truncate">{team.name}</span>
          {team.rank ? <span className="opacity-70 tabular-nums">#{team.rank}</span> : null}
        </button>
      ))}
    </div>
  )
}
