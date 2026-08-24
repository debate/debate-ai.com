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
 * Also hosts the "Log a scouted round" form: one round at a time is
 * persisted through `debate-data-sync`'s `state/opponentRoundRecords.ts`
 * `recordOpponentRound`, which re-aggregates that team's profile from its
 * full logged history via the existing
 * `buildOpponentTeamProfile`/`saveOpponentTeamProfile`. That's the only
 * in-app way to create a profile — every roster column shown here stays
 * derived from logged rounds, never edited directly. The logged-rounds list
 * below the roster corrects a mistyped round through the same store: Edit
 * loads it back into the form (which then saves through
 * `updateOpponentRoundRecord`) and Delete removes it, both re-aggregating
 * (or removing) the affected team's profile.
 *
 * @module panels/OpponentTeamProfilesPanel
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
import { Switch } from "debate-ui/src/primitives/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildOpponentTeamProfilesRoster } from "debate-data-sync/src/state/opponentTeamProfiles"
import {
  deleteOpponentRoundRecord,
  findNearestOpponentTeamId,
  listOpponentRoundRecords,
  listOpponentTeamIds,
  recordOpponentRound,
  updateOpponentRoundRecord,
  type OpponentRoundRecordEntry,
} from "debate-data-sync/src/state/opponentRoundRecords"
import type {
  DebateSide,
  OpponentTeamProfile,
} from "debate-data-sync/src/rankings/opponent-team-profile"

function formatFrequencyList(entries: { value: string; count: number }[]): string {
  if (entries.length === 0) return "—"
  return entries
    .slice(0, 3)
    .map((entry) => `${entry.value} (${entry.count})`)
    .join(", ")
}

/** Splits the comma-separated tags field into the record's `argumentTags` array. */
function parseArgumentTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

type RoundDraft = {
  teamId: string
  tournamentName: string
  date: string
  division: string
  side: DebateSide
  won: boolean
  argumentTags: string
  caseName: string
  opponentTeamId: string
}

const EMPTY_DRAFT: RoundDraft = {
  teamId: "",
  tournamentName: "",
  date: "",
  division: "",
  side: "aff",
  won: false,
  argumentTags: "",
  caseName: "",
  opponentTeamId: "",
}

/** Loads an already-logged round back into the form's string-typed draft. */
function draftFromRecord(record: OpponentRoundRecordEntry): RoundDraft {
  return {
    teamId: record.teamId,
    tournamentName: record.tournamentName,
    date: record.date,
    division: record.division,
    side: record.side,
    won: record.won,
    argumentTags: (record.argumentTags ?? []).join(", "),
    caseName: record.caseName ?? "",
    opponentTeamId: record.opponentTeamId ?? "",
  }
}

/**
 * Renders the Opponent Team Profiles roster: every persisted
 * `OpponentTeamProfile` ordered by rounds recorded descending, with overall
 * and side-split records, a "notably stronger" side badge, and the team's
 * most common argument tags and cases, plus a form to log a scouted round
 * that creates or updates a profile and a list of logged rounds to delete
 * from.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function OpponentTeamProfilesPanel() {
  const [roster, setRoster] = useState<OpponentTeamProfile[] | null>(null)
  const [records, setRecords] = useState<OpponentRoundRecordEntry[]>([])
  const [draft, setDraft] = useState<RoundDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [teamFilter, setTeamFilter] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRoster(buildOpponentTeamProfilesRoster())
    setRecords(listOpponentRoundRecords())
  }, [])

  const refresh = () => {
    setRoster(buildOpponentTeamProfilesRoster())
    setRecords(listOpponentRoundRecords())
  }

  const handleSubmit = () => {
    const teamId = draft.teamId.trim()
    const tournamentName = draft.tournamentName.trim()
    const date = draft.date.trim()
    const division = draft.division.trim()
    if (!teamId || !tournamentName || !date || !division) {
      setError("Team ID, tournament, date, and division are all required.")
      return
    }
    const argumentTags = parseArgumentTags(draft.argumentTags)
    const caseName = draft.caseName.trim()
    const opponentTeamId = draft.opponentTeamId.trim()
    const record: OpponentRoundRecordEntry = {
      id: editingId ?? `${teamId}-${tournamentName}-${date}-${Date.now()}`,
      teamId,
      tournamentName,
      date,
      division,
      side: draft.side,
      won: draft.won,
      argumentTags: argumentTags.length > 0 ? argumentTags : undefined,
      caseName: caseName === "" ? undefined : caseName,
      opponentTeamId: opponentTeamId === "" ? undefined : opponentTeamId,
    }
    if (editingId) {
      updateOpponentRoundRecord(record)
    } else {
      recordOpponentRound(record)
    }
    setError(null)
    setEditingId(null)
    setDraft({ ...EMPTY_DRAFT, teamId, division: draft.division })
    refresh()
  }

  const handleEdit = (record: OpponentRoundRecordEntry) => {
    setDraft(draftFromRecord(record))
    setEditingId(record.id)
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const handleDelete = (id: string) => {
    deleteOpponentRoundRecord(id)
    if (editingId === id) {
      setEditingId(null)
      setDraft(EMPTY_DRAFT)
    }
    refresh()
  }

  const normalizedFilter = teamFilter.trim().toLowerCase()
  const visibleRecords =
    normalizedFilter === ""
      ? records
      : records.filter((record) => record.teamId.toLowerCase().includes(normalizedFilter))
  const teamIds = listOpponentTeamIds()
  const nearestTeamId = visibleRecords.length === 0 ? findNearestOpponentTeamId(teamFilter) : null

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading opponent team profiles…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Opponent Team Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Overall record, side-record tendencies, and common arguments/cases for every opposing
          team with a saved scouting profile. Log a scouted round below to create or update one —
          every column is derived from the rounds logged for that team.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {editingId ? "Edit logged round" : "Log a scouted round"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-team-id">Team ID</Label>
            <Input
              id="opponent-round-team-id"
              value={draft.teamId}
              onChange={(e) => setDraft((prev) => ({ ...prev, teamId: e.target.value }))}
              placeholder="Westlake AB"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-tournament">Tournament</Label>
            <Input
              id="opponent-round-tournament"
              value={draft.tournamentName}
              onChange={(e) => setDraft((prev) => ({ ...prev, tournamentName: e.target.value }))}
              placeholder="Berkeley"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-date">Date</Label>
            <Input
              id="opponent-round-date"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-division">Division</Label>
            <Input
              id="opponent-round-division"
              value={draft.division}
              onChange={(e) => setDraft((prev) => ({ ...prev, division: e.target.value }))}
              placeholder="PF"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-side">Side they debated</Label>
            <Select
              value={draft.side}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, side: value as DebateSide }))}
            >
              <SelectTrigger id="opponent-round-side" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aff">Aff</SelectItem>
                <SelectItem value="neg">Neg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-case">Case run (optional)</Label>
            <Input
              id="opponent-round-case"
              value={draft.caseName}
              onChange={(e) => setDraft((prev) => ({ ...prev, caseName: e.target.value }))}
              placeholder="Leave blank if not tracked"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-tags">Argument tags (comma-separated, optional)</Label>
            <Input
              id="opponent-round-tags"
              value={draft.argumentTags}
              onChange={(e) => setDraft((prev) => ({ ...prev, argumentTags: e.target.value }))}
              placeholder="kritik, topicality"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opponent-round-vs">Debated against (optional)</Label>
            <Input
              id="opponent-round-vs"
              value={draft.opponentTeamId}
              onChange={(e) => setDraft((prev) => ({ ...prev, opponentTeamId: e.target.value }))}
              placeholder="The other team's ID, for head-to-head lookups"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="opponent-round-won"
              checked={draft.won}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, won: checked }))}
            />
            <Label htmlFor="opponent-round-won">They won this round</Label>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit}>{editingId ? "Save changes" : "Log round"}</Button>
          {editingId && (
            <Button variant="ghost" onClick={handleCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No opponent team profiles yet. Log a scouted round above to build one.
        </div>
      ) : (
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
      )}

      {records.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Logged rounds</h2>
          <p className="text-sm text-muted-foreground">
            Editing a round rewrites it in place; deleting one re-derives that team's profile from
            whatever rounds remain, and removes the profile entirely once its last round is gone.
          </p>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="opponent-round-filter">Filter by team ID</Label>
            <Input
              id="opponent-round-filter"
              list="opponent-round-filter-options"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              placeholder="Show every team's rounds"
            />
            <datalist id="opponent-round-filter-options">
              {teamIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </div>
          {visibleRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No logged rounds match that team ID.
              {nearestTeamId !== null && (
                <>
                  {" "}
                  Did you mean{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => setTeamFilter(nearestTeamId)}
                  >
                    {nearestTeamId}
                  </button>
                  ?
                </>
              )}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.teamId}</TableCell>
                    <TableCell>{record.tournamentName}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="uppercase">{record.side}</TableCell>
                    <TableCell>{record.won ? "Win" : "Loss"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {record.caseName ?? "—"}
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(record)}
                        aria-label={`Edit ${record.teamId}'s ${record.tournamentName} round on ${record.date}`}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(record.id)}
                        aria-label={`Delete ${record.teamId}'s ${record.tournamentName} round on ${record.date}`}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  )
}
