/**
 * @fileoverview NDCA-style qualification-points standings — the "Standings"
 * tab rebuild named under idea #1 ("CX NDCA Standings") in TODO.md's Product
 * Feature Ideas list, after the old standalone `/standings` page and
 * `StandingsPanel` were removed (the underlying `debate-data-sync` scoring
 * helpers — `buildStandingsFromStore`/`rankStandings` — were left in place
 * for exactly this rebuild). Rather than a standalone page, this mounts as a
 * second tab inside {@link RankingsLeaderboardPanel} (Team Rankings),
 * alongside the Elo/TOC leaderboard.
 *
 * Three sections, top to bottom:
 * - **Log a result** — a manual entry form for one tournament result,
 *   backed by `debate-data-sync`'s `state/tournamentResults.ts`.
 * - **Bulk import (CSV)** — mirrors `OpponentTeamProfilesPanel`'s bulk-CSV
 *   pattern exactly, since live Tabroom results scraping is blocked (see
 *   TODO.md's "Confirmed blocker" section) and hand-entry alone doesn't
 *   scale past a handful of results; backed by
 *   `state/tournamentResults.ts#bulkImportTournamentResults` (itself a thin
 *   composition of `rankings/tournament-results-csv-import.ts`'s pure
 *   `parseTournamentResultsCsv`).
 * - **Qualification points table** — a collapsible (`<details>`) editor for
 *   the per-outround/per-prelim-win/per-bid-level point weights
 *   `buildStandingsFromStore` scores with, backed by the already-existing
 *   `state/qualificationPointsTable.ts` (get/save/reset), which predates
 *   this panel.
 *
 * Below that, the ranked standings table itself, each row expandable to see
 * (and delete) its individual tournament results.
 *
 * @module panels/leaderboard/StandingsPanel
 */

"use client"

import { useMemo, useState } from "react"
import { Badge } from "../../ui/primitives/badge"
import { Button } from "../../ui/primitives/button"
import { Input } from "../../ui/primitives/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/primitives/select"
import { Textarea } from "../../ui/primitives/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/primitives/table"
import {
  buildStandingsFromStore,
  bulkImportTournamentResults,
  deleteTournamentResult,
  saveTournamentResult,
  type TournamentResultRecord,
} from "debate-data-sync/src/state/tournamentResults"
import {
  getEffectiveQualificationPointsTable,
  resetPersistedQualificationPointsTable,
  savePersistedQualificationPointsTable,
} from "debate-data-sync/src/state/qualificationPointsTable"
import {
  getEffectiveQualificationCutoff,
  isQualificationCutoffConfigured,
  resetPersistedQualificationCutoff,
  savePersistedQualificationCutoff,
  toQualificationOptions,
  type QualificationCutoffSettings,
} from "debate-data-sync/src/state/qualificationCutoff"
import { TOURNAMENT_RESULT_CSV_TEMPLATE } from "debate-data-sync/src/rankings/tournament-results-csv-import"
import {
  getQualifiedTeams,
  type OutroundFinish,
  type QualificationPointsTable,
  type RankedTeamStanding,
} from "debate-data-sync/src/rankings/ndca-standings"

const FINISH_OPTIONS: { value: OutroundFinish; label: string }[] = [
  { value: "champion", label: "Champion" },
  { value: "finalist", label: "Finalist" },
  { value: "semifinalist", label: "Semifinalist" },
  { value: "quarterfinalist", label: "Quarterfinalist" },
  { value: "octofinalist", label: "Octofinalist" },
  { value: "doubleOctofinalist", label: "Double-octofinalist" },
  { value: "tripleOctofinalist", label: "Triple-octofinalist" },
  { value: "prelims", label: "Prelims only" },
]

const FINISH_LABELS: Record<OutroundFinish, string> = Object.fromEntries(
  FINISH_OPTIONS.map((option) => [option.value, option.label]),
) as Record<OutroundFinish, string>

/**
 * `RankedTeamStanding.results` is typed as plain `ScoredTournamentResult[]`
 * (no `id`) since `ndca-standings.ts`'s pure computation layer is
 * deliberately unaware of how a result is persisted. But
 * `tournamentResults.ts#groupResultsByTeam` groups the actual
 * `TournamentResultRecord` objects (id included) before they ever reach that
 * computation, and every step from there (`buildTeamStanding`'s `{...result,
 * points}`) spreads rather than reconstructs — so `id` survives on the
 * runtime object even though the type doesn't carry it. This local type
 * documents that assumption in one place instead of an inline cast at every
 * call site.
 */
type ScoredResultWithId = TournamentResultRecord & { points: number }

const EMPTY_ENTRY_FORM = {
  teamId: "",
  tournamentName: "",
  date: "",
  division: "",
  bidLevel: "0",
  finish: "prelims" as OutroundFinish,
  prelimWins: "0",
  prelimLosses: "0",
}

function nonNegativeIntOrZero(raw: string): number {
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

/** Reads a fresh, ranked standings list straight from the persisted store. */
function loadStandings(): RankedTeamStanding[] {
  return buildStandingsFromStore()
}

export function StandingsPanel() {
  const [standings, setStandings] = useState<RankedTeamStanding[]>(() => loadStandings())
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)

  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY_FORM)
  const [entryError, setEntryError] = useState<string | null>(null)

  const [bulkCsv, setBulkCsv] = useState("")
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const [pointsTable, setPointsTable] = useState<QualificationPointsTable>(() =>
    getEffectiveQualificationPointsTable(),
  )
  const [pointsTableStatus, setPointsTableStatus] = useState<string | null>(null)

  const [cutoff, setCutoff] = useState<QualificationCutoffSettings>(() =>
    getEffectiveQualificationCutoff(),
  )
  const [cutoffStatus, setCutoffStatus] = useState<string | null>(null)

  const refresh = () => setStandings(loadStandings())

  const handleLogResult = () => {
    const teamId = entryForm.teamId.trim()
    const tournamentName = entryForm.tournamentName.trim()
    const date = entryForm.date.trim()
    const division = entryForm.division.trim()
    if (!teamId || !tournamentName || !date || !division) {
      setEntryError("Team, tournament, date, and division are all required.")
      return
    }

    const record: TournamentResultRecord = {
      id: `${teamId}-${tournamentName}-${date}-${Date.now()}`,
      teamId,
      tournamentName,
      date,
      division,
      bidLevel: nonNegativeIntOrZero(entryForm.bidLevel),
      finish: entryForm.finish,
      prelimWins: nonNegativeIntOrZero(entryForm.prelimWins),
      prelimLosses: nonNegativeIntOrZero(entryForm.prelimLosses),
    }
    saveTournamentResult(record)
    setEntryForm({ ...EMPTY_ENTRY_FORM, teamId, division })
    setEntryError(null)
    refresh()
  }

  const handleBulkImport = () => {
    if (!bulkCsv.trim()) {
      setBulkStatus("Paste a CSV to import first.")
      return
    }
    const { importedCount, skippedCount, errors } = bulkImportTournamentResults(bulkCsv)
    const summary =
      importedCount === 0
        ? `No results imported.${errors.length > 0 ? ` ${errors[0]}` : ""}`
        : `Imported ${importedCount} result${importedCount === 1 ? "" : "s"}.` +
          (skippedCount > 0 ? ` Skipped ${skippedCount} row${skippedCount === 1 ? "" : "s"}: ${errors[0]}` : "")
    setBulkStatus(summary)
    if (importedCount > 0) setBulkCsv("")
    refresh()
  }

  const handleSavePointsTable = () => {
    savePersistedQualificationPointsTable(pointsTable)
    setPointsTableStatus("Saved — new points weights apply immediately.")
    refresh()
  }

  const handleResetPointsTable = () => {
    resetPersistedQualificationPointsTable()
    const defaults = getEffectiveQualificationPointsTable()
    setPointsTable(defaults)
    setPointsTableStatus("Reset to the default point table.")
    refresh()
  }

  const handleSaveCutoff = () => {
    savePersistedQualificationCutoff(cutoff)
    setCutoffStatus("Saved — the qualified list below applies it immediately.")
  }

  const handleResetCutoff = () => {
    resetPersistedQualificationCutoff()
    setCutoff(getEffectiveQualificationCutoff())
    setCutoffStatus("Cleared — no cutoff is configured.")
  }

  const handleDeleteResult = (id: string) => {
    deleteTournamentResult(id)
    refresh()
  }

  const totalResultsLogged = useMemo(
    () => standings.reduce((sum, standing) => sum + standing.tournamentsAttended, 0),
    [standings],
  )

  const cutoffConfigured = isQualificationCutoffConfigured(cutoff)
  const qualifiedTeamIds = useMemo(() => {
    if (!cutoffConfigured) return new Set<string>()
    const qualified = getQualifiedTeams(standings, toQualificationOptions(cutoff))
    return new Set(qualified.map((standing) => standing.teamId))
  }, [standings, cutoff, cutoffConfigured])

  return (
    <div className="space-y-6">
      {/* Log a result ------------------------------------------------- */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Log a result</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input
            placeholder="Team"
            value={entryForm.teamId}
            onChange={(e) => setEntryForm((f) => ({ ...f, teamId: e.target.value }))}
          />
          <Input
            placeholder="Tournament"
            value={entryForm.tournamentName}
            onChange={(e) => setEntryForm((f) => ({ ...f, tournamentName: e.target.value }))}
          />
          <Input
            type="date"
            value={entryForm.date}
            onChange={(e) => setEntryForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Input
            placeholder="Division (e.g. PF)"
            value={entryForm.division}
            onChange={(e) => setEntryForm((f) => ({ ...f, division: e.target.value }))}
          />
          <Select
            value={entryForm.finish}
            onValueChange={(value) => setEntryForm((f) => ({ ...f, finish: value as OutroundFinish }))}
          >
            <SelectTrigger>
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
          <Input
            type="number"
            min={0}
            placeholder="Bid level"
            value={entryForm.bidLevel}
            onChange={(e) => setEntryForm((f) => ({ ...f, bidLevel: e.target.value }))}
          />
          <Input
            type="number"
            min={0}
            placeholder="Prelim wins"
            value={entryForm.prelimWins}
            onChange={(e) => setEntryForm((f) => ({ ...f, prelimWins: e.target.value }))}
          />
          <Input
            type="number"
            min={0}
            placeholder="Prelim losses"
            value={entryForm.prelimLosses}
            onChange={(e) => setEntryForm((f) => ({ ...f, prelimLosses: e.target.value }))}
          />
        </div>
        {entryError && <p className="text-sm text-destructive">{entryError}</p>}
        <Button onClick={handleLogResult}>Log result</Button>
      </div>

      {/* Bulk import (CSV) ---------------------------------------------- */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">Bulk import (CSV)</h2>
          <p className="text-xs text-muted-foreground">
            Paste a CSV of tournament results — a header row naming the columns (any order), then
            one row per result. Required columns: <code>teamId</code>, <code>tournamentName</code>,{" "}
            <code>date</code>, <code>division</code>, and <code>finish</code> (one of{" "}
            {FINISH_OPTIONS.map((option) => option.value).join(", ")}). Optional:{" "}
            <code>bidLevel</code>, <code>prelimWins</code>, <code>prelimLosses</code> (default 0). A
            row that fails to parse is skipped and reported rather than blocking the rest of the
            import.
          </p>
        </div>
        <Textarea
          value={bulkCsv}
          onChange={(e) => setBulkCsv(e.target.value)}
          placeholder={TOURNAMENT_RESULT_CSV_TEMPLATE}
          rows={6}
        />
        {bulkStatus && <p className="text-sm text-muted-foreground">{bulkStatus}</p>}
        <Button variant="outline" onClick={handleBulkImport}>
          Import results
        </Button>
      </div>

      {/* Qualification points table -------------------------------------- */}
      <details className="space-y-3 rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Qualification points table
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            No public, authoritative NDCA point table exists for this app to hardcode — these
            weights are an illustrative default. Edit and save your own circuit's values; they
            apply to every standing above immediately.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FINISH_OPTIONS.map((option) => (
              <label key={option.value} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {option.label}
                <Input
                  type="number"
                  value={pointsTable.outroundPoints[option.value]}
                  onChange={(e) =>
                    setPointsTable((table) => ({
                      ...table,
                      outroundPoints: {
                        ...table.outroundPoints,
                        [option.value]: Number(e.target.value) || 0,
                      },
                    }))
                  }
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Points per prelim win
              <Input
                type="number"
                value={pointsTable.pointsPerPrelimWin}
                onChange={(e) =>
                  setPointsTable((table) => ({
                    ...table,
                    pointsPerPrelimWin: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Bid-level bonus rate (e.g. 0.1 = +10%/level)
              <Input
                type="number"
                step="0.01"
                value={pointsTable.bidLevelBonusRate}
                onChange={(e) =>
                  setPointsTable((table) => ({
                    ...table,
                    bidLevelBonusRate: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
          </div>
          {pointsTableStatus && <p className="text-sm text-muted-foreground">{pointsTableStatus}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSavePointsTable}>
              Save
            </Button>
            <Button variant="ghost" onClick={handleResetPointsTable}>
              Reset to default
            </Button>
          </div>
        </div>
      </details>

      {/* Qualification cutoff ---------------------------------------------- */}
      <details className="space-y-3 rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Qualification cutoff
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Set a minimum points threshold and/or a field cap to see who currently qualifies. Leave a
            field blank to skip that half of the cutoff.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Min points to qualify
              <Input
                type="number"
                value={cutoff.minPoints ?? ""}
                placeholder="No minimum"
                onChange={(e) =>
                  setCutoff((c) => ({
                    ...c,
                    minPoints: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Max qualifiers (field size)
              <Input
                type="number"
                min={0}
                value={cutoff.maxQualifiers ?? ""}
                placeholder="No cap"
                onChange={(e) =>
                  setCutoff((c) => ({
                    ...c,
                    maxQualifiers: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </label>
          </div>
          {cutoffStatus && <p className="text-sm text-muted-foreground">{cutoffStatus}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveCutoff}>
              Save
            </Button>
            <Button variant="ghost" onClick={handleResetCutoff}>
              Clear cutoff
            </Button>
          </div>
        </div>
      </details>

      {/* Ranked standings -------------------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Standings</h2>
          <span className="text-xs text-muted-foreground">
            {standings.length} team{standings.length === 1 ? "" : "s"}, {totalResultsLogged} result
            {totalResultsLogged === 1 ? "" : "s"} logged
            {cutoffConfigured
              ? ` · ${qualifiedTeamIds.size} of ${standings.length} currently qualify`
              : ""}
          </span>
        </div>
        {standings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No tournament results logged yet. Log one above, or bulk-import a CSV.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Best finish</TableHead>
                <TableHead className="text-right">Tournaments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((standing) => (
                <>
                  <TableRow
                    key={standing.teamId}
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedTeamId((current) => (current === standing.teamId ? null : standing.teamId))
                    }
                  >
                    <TableCell>{standing.rank}</TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {standing.teamId}
                        {cutoffConfigured && qualifiedTeamIds.has(standing.teamId) && (
                          <Badge variant="default">Qualified</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{standing.totalPoints}</TableCell>
                    <TableCell>
                      {standing.record.wins}-{standing.record.losses}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{FINISH_LABELS[standing.bestFinish]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {standing.tournamentsCounted}
                      {standing.tournamentsCounted !== standing.tournamentsAttended
                        ? ` of ${standing.tournamentsAttended}`
                        : ""}
                    </TableCell>
                  </TableRow>
                  {expandedTeamId === standing.teamId && (
                    <TableRow key={`${standing.teamId}-detail`}>
                      <TableCell colSpan={6} className="whitespace-normal bg-muted/30">
                        <div className="space-y-1 py-1">
                          {(standing.results as ScoredResultWithId[]).map((result, index) => (
                            <div
                              key={`${result.tournamentName}-${result.date}-${index}`}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {result.tournamentName} ({result.date}) —{" "}
                                {FINISH_LABELS[result.finish]}, {result.prelimWins}-
                                {result.prelimLosses}, bid level {result.bidLevel} ·{" "}
                                <span className="font-medium">{result.points} pts</span>
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteResult(result.id)
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
