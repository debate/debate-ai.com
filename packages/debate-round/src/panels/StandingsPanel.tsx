/**
 * @fileoverview CX NDCA Standings panel — the "(c) a standings dashboard UI"
 * follow-up named under idea #1 ("CX NDCA Standings") in TODO.md's Product
 * Feature Ideas list.
 *
 * Lets a user record a team's tournament result (tournament, date, division,
 * bid level, outround finish, prelim record), persisting it through
 * `debate-data-sync`'s `state/tournamentResults.ts`, then renders every
 * persisted result's cumulative season standings via that same store's
 * `buildStandingsFromStore` — a thin grouping/ranking wrapper over the
 * existing `rankings/ndca-standings.ts` computation
 * (`computeTournamentPoints`/`buildStandings`/`rankStandings`). No new
 * points-scoring or ranking logic is introduced here; the qualification
 * points table used is `ndca-standings.ts`'s illustrative
 * `DEFAULT_QUALIFICATION_POINTS_TABLE`, not a real circuit-sourced table
 * (see idea #1's follow-up (b)).
 *
 * @module panels/StandingsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import {
  buildStandingsFromStore,
  saveTournamentResult,
} from "debate-data-sync/src/state/tournamentResults"
import type { OutroundFinish, RankedTeamStanding } from "debate-data-sync/src/rankings/ndca-standings"

const FINISH_OPTIONS: { value: OutroundFinish; label: string }[] = [
  { value: "champion", label: "Champion" },
  { value: "finalist", label: "Finalist" },
  { value: "semifinalist", label: "Semifinalist" },
  { value: "quarterfinalist", label: "Quarterfinalist" },
  { value: "octofinalist", label: "Octofinalist" },
  { value: "doubleOctofinalist", label: "Double Octofinalist" },
  { value: "tripleOctofinalist", label: "Triple Octofinalist" },
  { value: "prelims", label: "Prelims only" },
]

const FINISH_LABEL: Record<OutroundFinish, string> = Object.fromEntries(
  FINISH_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OutroundFinish, string>

type ResultDraft = {
  teamId: string
  tournamentName: string
  date: string
  division: string
  bidLevel: string
  finish: OutroundFinish
  prelimWins: string
  prelimLosses: string
}

const EMPTY_DRAFT: ResultDraft = {
  teamId: "",
  tournamentName: "",
  date: "",
  division: "",
  bidLevel: "0",
  finish: "prelims",
  prelimWins: "0",
  prelimLosses: "0",
}

/**
 * Renders the CX NDCA Standings panel: a form to record a team's result at a
 * tournament, plus every persisted result's cumulative season standings —
 * total qualification points, prelim record, best finish, and tournaments
 * attended — ranked by total points.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function StandingsPanel() {
  const [standings, setStandings] = useState<RankedTeamStanding[] | null>(null)
  const [draft, setDraft] = useState<ResultDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStandings(buildStandingsFromStore())
  }, [])

  const refresh = () => setStandings(buildStandingsFromStore())

  const handleSubmit = () => {
    const teamId = draft.teamId.trim()
    const tournamentName = draft.tournamentName.trim()
    const date = draft.date.trim()
    const division = draft.division.trim()
    if (!teamId || !tournamentName || !date || !division) {
      setError("Team ID, tournament name, date, and division are all required.")
      return
    }
    const bidLevel = Number(draft.bidLevel)
    const prelimWins = Number(draft.prelimWins)
    const prelimLosses = Number(draft.prelimLosses)
    if (!Number.isFinite(bidLevel) || !Number.isFinite(prelimWins) || !Number.isFinite(prelimLosses)) {
      setError("Bid level and prelim record must be numbers.")
      return
    }
    saveTournamentResult({
      id: `${teamId}-${tournamentName}-${date}-${Date.now()}`,
      teamId,
      tournamentName,
      date,
      division,
      bidLevel,
      finish: draft.finish,
      prelimWins,
      prelimLosses,
    })
    setError(null)
    setDraft({ ...EMPTY_DRAFT, division: draft.division })
    refresh()
  }

  if (standings === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading standings…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">CX NDCA Standings</h1>
        <p className="text-sm text-muted-foreground">
          Record a team's tournament result to build cumulative, ranked season standings.
          Qualification points use an illustrative default point table, not a real
          circuit-sourced one.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="standings-team-id">Team ID</Label>
            <Input
              id="standings-team-id"
              value={draft.teamId}
              onChange={(e) => setDraft((prev) => ({ ...prev, teamId: e.target.value }))}
              placeholder="wxyz"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-tournament-name">Tournament</Label>
            <Input
              id="standings-tournament-name"
              value={draft.tournamentName}
              onChange={(e) => setDraft((prev) => ({ ...prev, tournamentName: e.target.value }))}
              placeholder="Berkeley"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-date">Date</Label>
            <Input
              id="standings-date"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-division">Division</Label>
            <Input
              id="standings-division"
              value={draft.division}
              onChange={(e) => setDraft((prev) => ({ ...prev, division: e.target.value }))}
              placeholder="PF"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-bid-level">Bid level</Label>
            <Input
              id="standings-bid-level"
              type="number"
              min={0}
              value={draft.bidLevel}
              onChange={(e) => setDraft((prev) => ({ ...prev, bidLevel: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-finish">Finish</Label>
            <Select
              value={draft.finish}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, finish: value as OutroundFinish }))}
            >
              <SelectTrigger id="standings-finish" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINISH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-prelim-wins">Prelim wins</Label>
            <Input
              id="standings-prelim-wins"
              type="number"
              min={0}
              value={draft.prelimWins}
              onChange={(e) => setDraft((prev) => ({ ...prev, prelimWins: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="standings-prelim-losses">Prelim losses</Label>
            <Input
              id="standings-prelim-losses"
              type="number"
              min={0}
              value={draft.prelimLosses}
              onChange={(e) => setDraft((prev) => ({ ...prev, prelimLosses: e.target.value }))}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Save result</Button>
      </div>

      {standings.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No tournament results yet. Record one above to start the season standings.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Tournaments</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Best finish</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((standing) => (
              <TableRow key={standing.teamId}>
                <TableCell className="text-right font-medium">{standing.rank}</TableCell>
                <TableCell className="font-medium">{standing.teamId}</TableCell>
                <TableCell className="text-right">{standing.totalPoints}</TableCell>
                <TableCell className="text-right">
                  {standing.tournamentsCounted}
                  {standing.tournamentsCounted !== standing.tournamentsAttended && (
                    <span className="text-muted-foreground"> / {standing.tournamentsAttended}</span>
                  )}
                </TableCell>
                <TableCell>
                  {standing.record.wins}-{standing.record.losses}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{FINISH_LABEL[standing.bestFinish]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
