/**
 * @fileoverview Past-season college policy table: the top 100 teams of one
 * season as debatedata.weebly.com rated them, with a win-probability
 * calculator over its teams and, when stored, the season's all-divisions
 * totals and rated tournaments. Shown on the NDT tab for the seasons
 * `debate-rankings-sync-data` does not cover.
 * @module leaderboard/CollegeHistoryTable
 */

"use client"

import { useEffect, useState } from "react"
import {
  COLLEGE_HISTORY_LAST_YEAR,
  collegeHistorySourceUrl,
  collegeSeasonDetails,
  teamDisplayParts,
  loadCollegeHistory,
  type CollegeHistoryEntry,
  type CollegeSeasonStats,
} from "../index"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/primitives/table"
import { seasonLabel } from "./leaderboardUtils"
import { CollegeWinCalculator } from "./CollegeWinCalculator"
import { TeamLabel } from "./team-label/TeamLabel"
import { pastTeamHref } from "./profile/pastTeamHelpers"
import { teamHref } from "./profile/rankingProfileHelpers"

/** One division's season totals as a compact definition list. */
function SeasonStatsCard({ stats }: { stats: CollegeSeasonStats }) {
  const rows: [string, string][] = [
    ["Schools", String(stats.schools)],
    ["Teams", String(stats.teams)],
    ["Debaters", String(stats.participants)],
    ["Rounds", String(stats.rounds)],
    ["Aff win", `${stats.affWinPct.toFixed(1)}%`],
    ["Elim aff win", `${stats.elimAffWinPct.toFixed(1)}%`],
  ]
  if (stats.medianPoints !== undefined) rows.push(["Median points", stats.medianPoints.toFixed(1)])
  if (stats.pointsIqr) rows.push(["Points IQR", `${stats.pointsIqr[0].toFixed(1)}–${stats.pointsIqr[1].toFixed(1)}`])
  return (
    <div className="rounded-lg border p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stats.division}</h4>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Props for {@link CollegeHistoryTable}. */
interface CollegeHistoryTableProps {
  /** Season year (the year the season ends in), e.g. `"2025"`. */
  year: string
  /** Free-text school/team filter. */
  query: string
}

/** Loads and renders season `year`'s scraped college policy table. */
export function CollegeHistoryTable({ year, query }: CollegeHistoryTableProps) {
  const [entries, setEntries] = useState<CollegeHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)
    loadCollegeHistory(year)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load rankings")
      })
    return () => {
      cancelled = true
    }
  }, [year])

  if (error) return <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
  if (!entries) return <p className="py-8 text-center text-sm text-muted-foreground">Loading rankings...</p>

  const details = collegeSeasonDetails(year)
  // Only the all-divisions totals; the Open / JV / Novice breakdowns stay in the data.
  const totals = details?.stats.find((s) => s.division === "All divisions")
  // This season's teams are in the rankings too, so they open their ranked profile.
  const current = Number(year) === COLLEGE_HISTORY_LAST_YEAR
  const q = query.trim().toLowerCase()
  const visible = q
    ? entries.filter((e) => e.school.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    : entries

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Top {entries.length} college policy teams of {seasonLabel(year)}, from{" "}
        <a
          href={collegeHistorySourceUrl(year)}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          debatedata
        </a>
        . Rating is a conservative skill estimate (Mu minus a margin for Sigma, the uncertainty) on
        that site's own scale, not comparable with current-season ratings.
      </p>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {totals && (
          <section aria-label={`${seasonLabel(year)} season stats`}>
            <SeasonStatsCard stats={totals} />
          </section>
        )}
        {entries.length >= 2 && <CollegeWinCalculator key={year} entries={entries} />}
      </div>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No teams match "{query}".</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-right">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Mu</TableHead>
              <TableHead className="text-right">Sigma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((e) => (
              <TableRow key={`${e.rank}-${e.name}`}>
                <TableCell className="text-right font-semibold tabular-nums">{e.rank}</TableCell>
                <TableCell>
                  <TeamLabel {...teamDisplayParts({ school: e.school, name: e.name })} title={`${e.school} · ${e.name}`} href={current ? teamHref(e) : pastTeamHref(e)} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.rating.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{e.mu.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{e.sigma.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {details && (
        <p className="mt-3 text-xs text-muted-foreground">
          Rated from {details.tournaments.length} tournaments: {details.tournaments.join(", ")}.
        </p>
      )}
    </>
  )
}
