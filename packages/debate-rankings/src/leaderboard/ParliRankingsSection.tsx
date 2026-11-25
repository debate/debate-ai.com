/**
 * @fileoverview The Parli tab of the `/rank` page (after College Policy):
 * the National Parliamentary Debate League's national team and school
 * rankings for a season, from `/api/rankings/npdl` (cached in the app's
 * database from the league's published sheets, refreshed daily; bundled
 * snapshot when the database can't be read). Ranks are shown as
 * published, ties included. Shows the top {@link PREVIEW} rows with a button
 * for the rest.
 *
 * The section has no pickers of its own: the leaderboard's shared
 * Teams/Schools toggle and season select (`LeaderboardFilterBar`) drive it,
 * the same ones every other event uses.
 * @module leaderboard/ParliRankingsSection
 */

"use client"

import { useEffect, useState } from "react"
import type { LeaderboardView } from "./leaderboardTypes"
import type { NpdlRankingRow, NpdlSeasonRankings } from "../sync/sync-npdl-rankings"
import { Button } from "./ui/primitives/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/primitives/table"
import { cn } from "./ui/lib/utils"

/** Rows shown before "Show all". */
const PREVIEW = 25

/** Body of `GET /api/rankings/npdl`. */
export interface NpdlRankingsResponse {
  /** `database`: read from D1; `live`: scraped by this request (first ask); `snapshot`: bundled file. */
  source: "database" | "live" | "snapshot"
  /** Every season the scraper knows, newest first. */
  seasons: string[]
  /** `null` when neither the site nor the snapshot has the season. */
  rankings: NpdlSeasonRankings | null
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; body: NpdlRankingsResponse }

/** Loads one season (`null` = newest with rows). */
function useNpdlRankings(season: string | null): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    fetch(`/api/rankings/npdl${season ? `?season=${encodeURIComponent(season)}` : ""}`)
      .then((res) => (res.ok ? (res.json() as Promise<NpdlRankingsResponse>) : null))
      .then((body) => {
        if (cancelled) return
        setState(body && Array.isArray(body.seasons) ? { status: "ready", body } : { status: "error" })
      })
      .catch(() => !cancelled && setState({ status: "error" }))
    return () => {
      cancelled = true
    }
  }, [season])
  return state
}

/** `"Smith & Lee"` from the two debater cells; empty when neither is set. */
export function npdlDebaters(row: Pick<NpdlRankingRow, "debater1" | "debater2">): string {
  return [row.debater1, row.debater2].filter(Boolean).join(" & ")
}

/** The table for one tab. Exported for tests. */
export function ParliRankingsTable({ rows, kind }: { rows: NpdlRankingRow[]; kind: "teams" | "schools" }) {
  const [showAll, setShowAll] = useState(false)
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No {kind} ranked this season yet.</p>
  }
  const visible = showAll ? rows : rows.slice(0, PREVIEW)
  return (
    <>
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-right">Rank</TableHead>
            <TableHead>{kind === "teams" ? "Team" : "School"}</TableHead>
            {kind === "teams" && <TableHead>Debaters</TableHead>}
            <TableHead className="hidden sm:table-cell">Region</TableHead>
            <TableHead className="w-20 text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row, i) => (
            <TableRow key={`${row.rank}-${row.school}-${row.debater1 ?? ""}-${row.debater2 ?? ""}-${i}`}>
              <TableCell className="text-right tabular-nums text-muted-foreground">{row.rank}</TableCell>
              <TableCell className="font-medium">{row.school}</TableCell>
              {kind === "teams" && <TableCell>{npdlDebaters(row)}</TableCell>}
              <TableCell className="hidden sm:table-cell text-muted-foreground">{row.region ?? ""}</TableCell>
              <TableCell className="text-right tabular-nums">{row.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > PREVIEW && (
        <div className="mt-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show top 25" : `Show all ${rows.length}`}
          </Button>
        </div>
      )}
    </>
  )
}

/** Props for {@link ParliRankingsSection}. */
export interface ParliRankingsSectionProps {
  /** Season to show (`"2024-25"`); `null` shows the newest season with rows. */
  season?: string | null
  /** Teams or Schools, from the leaderboard's shared toggle. */
  view?: LeaderboardView
  /** Called with the season actually shown, so the shared season select can name it. */
  onSeasonShown?: (season: string) => void
  className?: string
}

/** The section. */
export function ParliRankingsSection({ season = null, view = "teams", onSeasonShown, className }: ParliRankingsSectionProps) {
  const state = useNpdlRankings(season)
  const rankings = state.status === "ready" ? state.body.rankings : null
  const shownSeason = rankings?.season ?? season

  useEffect(() => {
    if (rankings?.season) onSeasonShown?.(rankings.season)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankings?.season])

  return (
    <section className={cn("rounded-lg border p-4", className)} aria-labelledby="parli-rankings-heading" id="parliamentary">
      <div className="mb-3">
        <h2 id="parli-rankings-heading" className="text-base font-semibold">
          Parliamentary
        </h2>
        <p className="text-xs text-muted-foreground">
          National Parliamentary Debate League rankings{shownSeason ? `, ${shownSeason}` : ""}
        </p>
      </div>
      {state.status === "loading" ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading parliamentary rankings…</p>
      ) : !rankings ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Parliamentary rankings aren't available{season ? ` for ${season}` : ""} right now.
        </p>
      ) : (
        <ParliRankingsTable
          key={`${rankings.season}-${view}`}
          rows={view === "teams" ? rankings.teams : rankings.schools}
          kind={view}
        />
      )}
    </section>
  )
}
