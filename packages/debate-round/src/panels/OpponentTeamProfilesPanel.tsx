/**
 * @fileoverview Opponent Team Profiles panel — the "(b) a scouting-card/panel
 * UI" follow-up named under the "🕵️ Opponent Team Profiles" bullet in
 * TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * Reads every persisted opponent team profile via `debate-data-sync`'s
 * `buildOpponentTeamProfilesRoster` (a thin ordering helper over the
 * existing persisted store) and renders it as a scouting roster table —
 * overall record, Aff/Neg side record (flagged "notably stronger" once it
 * clears `opponent-team-profile.ts`'s threshold), and the team's most
 * commonly run argument tags and cases — reusing
 * `rankings/opponent-team-profile.ts`'s existing aggregation fields directly
 * rather than introducing new scouting logic here, mirroring
 * `debate-speech-writer`'s `JudgeProfilesPanel` convention.
 *
 * @module panels/OpponentTeamProfilesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildOpponentTeamProfilesRoster } from "debate-data-sync/src/state/opponentTeamProfiles"
import type { OpponentTeamProfile } from "debate-data-sync/src/rankings/opponent-team-profile"

function formatFrequencyList(entries: { value: string; count: number }[]): string {
  if (entries.length === 0) return "—"
  return entries
    .slice(0, 3)
    .map((entry) => `${entry.value} (${entry.count})`)
    .join(", ")
}

/**
 * Renders the Opponent Team Profiles roster: every persisted
 * `OpponentTeamProfile` ordered by rounds recorded descending, with overall
 * and side-split records, a "notably stronger" side badge, and the team's
 * most common argument tags and cases.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function OpponentTeamProfilesPanel() {
  const [roster, setRoster] = useState<OpponentTeamProfile[] | null>(null)

  useEffect(() => {
    setRoster(buildOpponentTeamProfilesRoster())
  }, [])

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading opponent team profiles…</div>
  }

  if (roster.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No opponent team profiles yet. A profile appears here once an opposing team's round
        history has been aggregated and saved.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Opponent Team Profiles</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Overall record, side-record tendencies, and common arguments/cases for every opposing
        team with a saved scouting profile.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Rounds</TableHead>
            <TableHead>Record</TableHead>
            <TableHead>Side record</TableHead>
            <TableHead>Common arguments</TableHead>
            <TableHead>Common cases</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((profile) => (
            <TableRow key={profile.teamId}>
              <TableCell className="font-medium">{profile.teamId}</TableCell>
              <TableCell className="text-right">{profile.roundsRecorded}</TableCell>
              <TableCell>
                {profile.roundsRecorded > 0
                  ? `${profile.record.wins}-${profile.record.losses} (${Math.round(
                      profile.record.winRate * 100,
                    )}%)`
                  : "—"}
              </TableCell>
              <TableCell>
                Aff {profile.sideRecord.aff.wins}-{profile.sideRecord.aff.rounds - profile.sideRecord.aff.wins}
                {" · "}
                Neg {profile.sideRecord.neg.wins}-{profile.sideRecord.neg.rounds - profile.sideRecord.neg.wins}
                {profile.sideRecord.hasNotableSidePreference && (
                  <Badge variant="outline" className="ml-2">
                    stronger on {profile.sideRecord.strongerSide}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatFrequencyList(profile.topArgumentTags)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatFrequencyList(profile.topCases)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
