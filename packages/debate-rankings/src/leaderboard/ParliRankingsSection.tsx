/**
 * @fileoverview Small "Parliamentary" section at the end of the `/rank` page:
 * the National Parliamentary Debate League's national team and school
 * rankings for a season, from `/api/rankings/npdl` (scraped from the league's
 * published sheets, bundled snapshot when unreachable). Ranks are shown as
 * published, ties included. Shows the top {@link PREVIEW} rows with a button
 * for the rest.
 * @module leaderboard/ParliRankingsSection
 */

"use client"

import { useEffect, useState } from "react"
import type { NpdlRankingRow, NpdlSeasonRankings } from "../sync/sync-npdl-rankings"
import { Button } from "./ui/primitives/button"
import { Tabs, TabsList, TabsTrigger } from "./ui/primitives/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/primitives/table"
import { cn } from "./ui/lib/utils"

/** Rows shown before "Show all". */
const PREVIEW = 25

/** Body of `GET /api/rankings/npdl`. */
export interface NpdlRankingsResponse {
  source: "live" | "snapshot"
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

/** The section. */
export function ParliRankingsSection({ className }: { className?: string }) {
  const [season, setSeason] = useState<string | null>(null)
  const [tab, setTab] = useState<"teams" | "schools">("teams")
  const state = useNpdlRankings(season)
  const body = state.status === "ready" ? state.body : null
  const rankings = body?.rankings ?? null
  const shownSeason = rankings?.season ?? season

  return (
    <section className={cn("rounded-lg border p-4", className)} aria-labelledby="parli-rankings-heading" id="parliamentary">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="parli-rankings-heading" className="text-base font-semibold">
            Parliamentary
          </h2>
          <p className="text-xs text-muted-foreground">
            National Parliamentary Debate League rankings{shownSeason ? `, ${shownSeason}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "teams" | "schools")}>
            <TabsList className="h-8">
              <TabsTrigger value="teams" className="px-3 text-xs">
                Teams
              </TabsTrigger>
              <TabsTrigger value="schools" className="px-3 text-xs">
                Schools
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {body && (
            <select
              aria-label="Parliamentary season"
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={shownSeason ?? ""}
              onChange={(e) => setSeason(e.target.value)}
            >
              {!shownSeason && <option value="">Season</option>}
              {body.seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {state.status === "loading" ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading parliamentary rankings…</p>
      ) : !rankings ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Parliamentary rankings aren't available{season ? ` for ${season}` : ""} right now.
        </p>
      ) : (
        <ParliRankingsTable key={`${rankings.season}-${tab}`} rows={tab === "teams" ? rankings.teams : rankings.schools} kind={tab} />
      )}
    </section>
  )
}
