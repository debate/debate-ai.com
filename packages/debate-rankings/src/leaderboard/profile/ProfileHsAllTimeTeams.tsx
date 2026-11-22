/**
 * @fileoverview "Greatest of all time" on a high school's page: the best
 * high school teams ever in Policy, Lincoln-Douglas and Public Forum, side
 * by side, the high school counterpart of the college Greatest of All Time
 * list. Teams score their TOC and NDCA national finishes
 * ({@link buildHsAllTimeTeams}). This school's own teams are highlighted, and
 * when its best team in an event is outside the top list, that team is shown
 * under it with its rank. An event with no scoring teams is left out.
 * @module leaderboard/profile/ProfileHsAllTimeTeams
 */

"use client"

import { useMemo } from "react"
import { Crown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"
import {
  HS_ALL_TIME_EVENTS,
  HS_ALL_TIME_POINTS,
  hsAllTimeSchoolKey,
  hsAllTimeTeams,
  type HsAllTimeEvent,
  type HsAllTimeTeam,
} from "./hsAllTimeTeams"

/** How many teams each event lists. */
export const HS_ALL_TIME_LIMIT = 10

const EVENT_LABEL: Record<HsAllTimeEvent, string> = {
  Policy: "Policy",
  "Lincoln-Douglas": "Lincoln-Douglas",
  "Public Forum": "Public Forum",
}

function years(team: HsAllTimeTeam): string {
  return team.firstYear === team.lastYear ? String(team.firstYear) : `${team.firstYear}–${team.lastYear}`
}

function TeamRow({ team, own }: { team: HsAllTimeTeam; own: boolean }) {
  const finishes = team.finishes.map((f) => `${f.year} ${f.tournament} ${f.place} (${f.points})`).join("\n")
  return (
    <li
      data-own-team={own || undefined}
      title={`${team.debaters}, ${team.school}: #${team.rank} of all time, ${team.total} points\n${finishes}`}
      className={`flex items-baseline gap-2 rounded px-1.5 py-0.5 ${own ? "bg-amber-100 font-medium dark:bg-amber-500/20" : ""}`}
    >
      <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{team.rank}</span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground">{team.lastNames}</span>{" "}
        <span className="text-xs text-muted-foreground">
          {team.school} · {years(team)}
        </span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{team.total}</span>
    </li>
  )
}

/** The lists themselves, given the teams; split out so it renders in tests. */
export function HsAllTimeTeamsCard({
  lists,
  schoolKey,
  limit = HS_ALL_TIME_LIMIT,
}: {
  lists: Record<HsAllTimeEvent, HsAllTimeTeam[]>
  schoolKey: string | null
  limit?: number
}) {
  const events = HS_ALL_TIME_EVENTS.filter((event) => lists[event]?.length)
  if (!events.length) return null
  const p = HS_ALL_TIME_POINTS
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4 text-amber-500" aria-hidden />
          Greatest of all time · high school
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          The best high school teams ever in each event, by TOC and NDCA national finishes: champion {p.Champion},
          finalist {p.Finalist}, semifinalist {p.Semifinalist}, top speaker {p["Top speaker"]}
          {schoolKey ? ". This school's teams are highlighted." : "."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {events.map((event) => {
            const list = lists[event]
            const top = list.slice(0, limit)
            const ownBest = schoolKey ? list.find((team) => team.schoolKey === schoolKey) : undefined
            const ownOutside = ownBest && !top.includes(ownBest) ? ownBest : null
            return (
              <section key={event} aria-label={`Greatest ${EVENT_LABEL[event]} teams of all time`}>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{EVENT_LABEL[event]}</h3>
                <ol className="space-y-0.5 text-sm">
                  {top.map((team) => (
                    <TeamRow key={`${team.schoolKey}-${team.debaters}`} team={team} own={team.schoolKey === schoolKey} />
                  ))}
                </ol>
                {ownOutside && (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">This school's best</p>
                    <ol className="text-sm">
                      <TeamRow team={ownOutside} own />
                    </ol>
                  </>
                )}
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/** @param props.school - School name as the rankings spell it. */
export function ProfileHsAllTimeTeams({ school }: { school: string }) {
  const lists = useMemo(() => hsAllTimeTeams(), [])
  const schoolKey = useMemo(() => hsAllTimeSchoolKey(school, lists), [school, lists])
  return <HsAllTimeTeamsCard lists={lists} schoolKey={schoolKey} />
}
