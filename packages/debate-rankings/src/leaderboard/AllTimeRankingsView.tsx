/**
 * @fileoverview The "All time" season on the rankings page. Picking "All time"
 * at the top of the season dropdown swaps the season's rankings for the
 * greatest of all time in the event tab that is showing, as the full page,
 * with the Teams/Schools toggle picking which list. For College Policy (NDT)
 * both are the all-seasons NDT points ranking ({@link NdtAllSeasonsRankings});
 * for the high school events Teams is the top 100 high school teams of that
 * event ({@link HsAllTimeTeamsRankings}) and Schools the top 100 programs of
 * all time by the same program points the Top 10 chart and school pages use
 * ({@link HsAllTimeSchoolsList}). No school is highlighted.
 * @module leaderboard/AllTimeRankingsView
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Crown } from "lucide-react"
import type { Division, LeaderboardView } from "./leaderboardTypes"
import { fetchSchoolElite, type HsAllTimeSchool } from "../school-elite"
import { SchoolLogo } from "./SchoolLogo"
import { schoolHref } from "./profile/rankingProfileHelpers"
import { NdtAllSeasonsRankings } from "./profile/NdtAllSeasonsDialog"
import { HsAllTimeTeamsRankings } from "./profile/ProfileHsAllTimeTeams"
import { hsAllTimeTeams, loadHsAllTimeTeams, type HsAllTimeEvent, type HsAllTimeTeam } from "./profile/hsAllTimeTeams"
import { useNdtHistory } from "./profile/ndtHistory"

/** The season dropdown value (and `?season=` URL value) for the all-time view. */
export const ALL_TIME_SEASON = "all-time"

/** The high school all-time event each high school division shows. */
export const HS_ALL_TIME_EVENT: Record<Exclude<Division, "NDT">, HsAllTimeEvent> = {
  VCX: "Policy",
  VLD: "Lincoln-Douglas",
  VPF: "Public Forum",
}

const TITLE_ID = "rankings-all-time-title"
/** Fills the page below the filter bar; the list scrolls inside it. */
const FULL_HEIGHT = "max-h-[calc(100dvh-10rem)] min-h-[24rem]"

function CollegeAllTime({ view }: { view: LeaderboardView }) {
  const history = useNdtHistory()
  if (!history) {
    return (
      <p id={TITLE_ID} className="px-4 py-6 text-center text-sm text-muted-foreground">
        Loading all-seasons NDT points...
      </p>
    )
  }
  return <NdtAllSeasonsRankings history={history} titleId={TITLE_ID} className={FULL_HEIGHT} tab={view} />
}

function HighSchoolAllTime({ event }: { event: HsAllTimeEvent }) {
  const bundled = useMemo(() => hsAllTimeTeams(), [])
  const [withCollege, setWithCollege] = useState<Record<HsAllTimeEvent, HsAllTimeTeam[]> | null>(null)
  useEffect(() => {
    let live = true
    loadHsAllTimeTeams()
      .then((loaded) => live && setWithCollege(loaded))
      .catch(() => {
        // The lists stay on national finishes alone.
      })
    return () => {
      live = false
    }
  }, [])
  return (
    <HsAllTimeTeamsRankings
      lists={withCollege ?? bundled}
      schoolKey={null}
      collegeLoaded={withCollege !== null}
      event={event}
      titleId={TITLE_ID}
      className={FULL_HEIGHT}
    />
  )
}

/**
 * One high school event's top programs of all time, as the server ranks them
 * (`allTime` on the Top 10 chart's response).
 * @param props.schools - The ranked programs; `undefined` while loading, `null` when unavailable.
 */
export function HsAllTimeSchoolsList({
  event,
  schools,
  className = "",
}: {
  event: HsAllTimeEvent
  schools: HsAllTimeSchool[] | null | undefined
  className?: string
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="border-b px-4 py-3">
        <h2 id={TITLE_ID} className="flex items-center gap-2 text-base font-semibold">
          <Crown className="h-4 w-4 text-amber-500" aria-hidden />
          Greatest of all time · high school {event} schools
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The top {event} programs of all time by program points, the same score as each school page&apos;s
          all-time rank and the Top 10 chart: Tournament of Champions finishes back to 1972 (champion 30, runner-up 18,
          top speaker 10), plus each season&apos;s two best top-100 entries and TOC qualifiers from 2015-16 on.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {schools === undefined ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading all-time schools...</p>
        ) : !schools?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">All-time school rankings are unavailable right now.</p>
        ) : (
          <ol aria-label={`Greatest ${event} schools of all time`} className="divide-y text-sm">
            {schools.map((row) => (
              <li key={row.handle ?? row.school} className="flex items-center gap-3 px-1.5 py-1.5">
                <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">{row.rank}</span>
                <Link
                  href={row.handle ? `/@${row.handle}` : schoolHref(row.school)}
                  className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-medium text-foreground hover:underline underline-offset-4"
                >
                  <SchoolLogo school={row.school} className="h-5 w-auto shrink-0" />
                  <span className="truncate">{row.school}</span>
                </Link>
                {row.titles > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.titles} TOC title{row.titles === 1 ? "" : "s"}
                  </span>
                )}
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{row.score} pts</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function HighSchoolAllTimeSchools({ event }: { event: HsAllTimeEvent }) {
  const [state, setState] = useState<{ event: HsAllTimeEvent; schools: HsAllTimeSchool[] | null }>()
  useEffect(() => {
    let live = true
    fetchSchoolElite(event).then(
      (body) => live && setState({ event, schools: body.allTime ?? null }),
      () => live && setState({ event, schools: null }),
    )
    return () => {
      live = false
    }
  }, [event])
  return <HsAllTimeSchoolsList event={event} schools={state?.event === event ? state.schools : undefined} className={FULL_HEIGHT} />
}

/**
 * The greatest of all time for the event tab showing, inline on the page.
 * @param props.division - The rankings division showing; picks the college list or the high school event.
 * @param props.view - Teams or Schools, from the page's toggle.
 */
export function AllTimeRankingsView({ division, view = "teams" }: { division: Division; view?: LeaderboardView }) {
  return (
    <section aria-labelledby={TITLE_ID} className="rounded-lg border bg-background">
      {division === "NDT" ? (
        <CollegeAllTime view={view} />
      ) : view === "schools" ? (
        <HighSchoolAllTimeSchools event={HS_ALL_TIME_EVENT[division]} />
      ) : (
        <HighSchoolAllTime event={HS_ALL_TIME_EVENT[division]} />
      )}
    </section>
  )
}
