/**
 * @fileoverview The "All time" season on the Parli tab: the greatest
 * parliamentary teams and schools of all time, from
 * `/api/rankings/npdl/all-time` ({@link buildNpdlAllTime}). The Teams/Schools
 * toggle picks the list. Scored with the high school all-time Schools
 * formula over the National Parliamentary Debate League's published ranks
 * (2017-18 on).
 * @module leaderboard/ParliAllTimeRankings
 */

"use client"

import { useEffect, useState } from "react"
import { Crown } from "lucide-react"
import type { LeaderboardView } from "./leaderboardTypes"
import {
  NPDL_ALL_TIME_PATH,
  type NpdlAllTimeResponse,
  type NpdlAllTimeSchool,
  type NpdlAllTimeTeam,
} from "../sync/npdl-all-time"
import { cn } from "./ui/lib/utils"

const TITLE_ID = "parli-all-time-title"

/** `"2018-2025"` / `"2023"` from season end years. */
function span(first: number, last: number): string {
  return first === last ? String(last) : `${first}-${last}`
}

/** The lists for one view; exported for tests. */
export function ParliAllTimeList({
  view,
  teams,
  schools,
  seasons,
  className,
}: {
  view: LeaderboardView
  teams: NpdlAllTimeTeam[]
  schools: NpdlAllTimeSchool[]
  seasons: string[]
  className?: string
}) {
  const oldest = seasons.at(-1)
  const newest = seasons[0]
  const rows = view === "schools" ? schools : teams
  return (
    <div className={cn("flex max-h-[calc(100dvh-10rem)] min-h-[24rem] flex-col", className)}>
      <div className="border-b px-4 py-3">
        <h2 id={TITLE_ID} className="flex items-center gap-2 text-base font-semibold">
          <Crown className="h-4 w-4 text-amber-500" aria-hidden />
          Greatest of all time · parliamentary {view === "schools" ? "schools" : "teams"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {view === "schools"
            ? "The top programs of all time by program points, scored like the high school events' all-time schools: "
            : "The top teams of all time, scored per season like the high school events' program points: "}
          each season a school&apos;s two best teams in the National Parliamentary Debate League&apos;s top 100 earn
          (101 - rank) / 20 points, so #1 is 5 and #100 is 0.05
          {oldest && newest ? `, summed over ${oldest} to ${newest}` : ""}. The league publishes no national finishes,
          so those points are not part of the Parli score.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No {view} have scored yet.</p>
        ) : (
          <ol aria-label={`Greatest parliamentary ${view} of all time`} className="divide-y text-sm">
            {view === "schools"
              ? schools.map((row) => (
                  <li key={row.school} className="flex items-center gap-3 px-1.5 py-1.5">
                    <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">{row.rank}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{row.school}</span>
                    {row.firstPlaces > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.firstPlaces} #1 season{row.firstPlaces === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {row.seasons} season{row.seasons === 1 ? "" : "s"}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">{row.score} pts</span>
                  </li>
                ))
              : teams.map((row) => (
                  <li key={`${row.school}-${row.debaters}`} className="flex items-center gap-3 px-1.5 py-1.5">
                    <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">{row.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.debaters}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.school} · {span(row.firstYear, row.lastYear)}
                      </span>
                    </span>
                    {row.firstPlaces > 0 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.firstPlaces} #1 season{row.firstPlaces === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">best #{row.bestRank}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">{row.score} pts</span>
                  </li>
                ))}
          </ol>
        )}
      </div>
    </div>
  )
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; body: NpdlAllTimeResponse }

/**
 * The Parli all-time page.
 * @param props.view - Teams or Schools, from the page's toggle.
 */
export function ParliAllTimeRankings({ view = "teams" }: { view?: LeaderboardView }) {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState({ status: "loading" })
    fetch(NPDL_ALL_TIME_PATH, attempt > 0 ? { cache: "reload" } : undefined)
      .then((res) => (res.ok ? (res.json() as Promise<NpdlAllTimeResponse>) : null))
      .then((body) => {
        if (cancelled) return
        setState(body && Array.isArray(body.teams) && Array.isArray(body.schools) ? { status: "ready", body } : { status: "error" })
      })
      .catch(() => !cancelled && setState({ status: "error" }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <section aria-labelledby={TITLE_ID} className="rounded-lg border bg-background">
      {state.status === "ready" ? (
        <ParliAllTimeList view={view} teams={state.body.teams} schools={state.body.schools} seasons={state.body.seasons} />
      ) : (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          <p id={TITLE_ID}>
            {state.status === "loading"
              ? "Loading all-time parliamentary rankings..."
              : "All-time parliamentary rankings are unavailable right now."}
          </p>
          {state.status === "error" && (
            <button type="button" className="mt-2 underline underline-offset-4" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          )}
        </div>
      )}
    </section>
  )
}
