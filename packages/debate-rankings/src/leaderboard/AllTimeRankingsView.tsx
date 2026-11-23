/**
 * @fileoverview The "All time" season on the rankings page. Picking "All time"
 * at the top of the season dropdown swaps the season's rankings for the
 * greatest of all time in the event tab that is showing, as the full page:
 * for College Policy (NDT) the all-seasons NDT points ranking
 * ({@link NdtAllSeasonsRankings}), for the high school events the top 100
 * high school teams of that event ({@link HsAllTimeTeamsRankings}). No school
 * is highlighted.
 * @module leaderboard/AllTimeRankingsView
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import type { Division } from "./leaderboardTypes"
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

function CollegeAllTime() {
  const history = useNdtHistory()
  if (!history) {
    return (
      <p id={TITLE_ID} className="px-4 py-6 text-center text-sm text-muted-foreground">
        Loading all-seasons NDT points...
      </p>
    )
  }
  return <NdtAllSeasonsRankings history={history} titleId={TITLE_ID} className={FULL_HEIGHT} />
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
 * The greatest of all time for the event tab showing, inline on the page.
 * @param props.division - The rankings division showing; picks the college list or the high school event.
 */
export function AllTimeRankingsView({ division }: { division: Division }) {
  return (
    <section aria-labelledby={TITLE_ID} className="rounded-lg border bg-background">
      {division === "NDT" ? <CollegeAllTime /> : <HighSchoolAllTime event={HS_ALL_TIME_EVENT[division]} />}
    </section>
  )
}
