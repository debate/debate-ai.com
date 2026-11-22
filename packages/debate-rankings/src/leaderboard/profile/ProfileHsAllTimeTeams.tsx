/**
 * @fileoverview "Greatest of all time" on a high school's page: a button that
 * opens the best high school teams ever in Policy, Lincoln-Douglas and Public
 * Forum as a modal, one tab per event, top 100 each, the high school
 * counterpart of the college Greatest of All Time list. Teams score their
 * TOC, NDCA and Barkley Forum finishes plus a share of each debater's college
 * NDT points ({@link buildHsAllTimeTeams}). The lists open from the bundled
 * high school results at once and add the college records when the NDT
 * history has loaded. This school's teams are highlighted, its best team in
 * the open event is pinned under the list when it ranks below 100, and the
 * modal opens on the event where this school ranks best.
 * @module leaderboard/profile/ProfileHsAllTimeTeams
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Crown, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import {
  HS_ALL_TIME_COLLEGE_SHARE,
  HS_ALL_TIME_EVENTS,
  HS_ALL_TIME_POINTS,
  hsAllTimeSchoolKey,
  hsAllTimeTeams,
  loadHsAllTimeTeams,
  type HsAllTimeEvent,
  type HsAllTimeTeam,
} from "./hsAllTimeTeams"

/** How many teams each event lists. */
export const HS_ALL_TIME_LIMIT = 100

type Lists = Record<HsAllTimeEvent, HsAllTimeTeam[]>

function years(team: HsAllTimeTeam): string {
  return team.firstYear === team.lastYear ? String(team.firstYear) : `${team.firstYear}–${team.lastYear}`
}

const TOURNAMENT_LABEL: Record<string, string> = { TOC: "TOC", NDCA: "NDCA", Barkley: "Barkley" }

function TeamRow({ team, own }: { team: HsAllTimeTeam; own: boolean }) {
  const finishes = team.finishes.map((f) => `${f.year} ${TOURNAMENT_LABEL[f.tournament]} ${f.place}`).join(" · ")
  const college = team.college.map((c) => `${c.debater}: ${c.school} (${c.collegePoints} NDT pts)`).join(" · ")
  return (
    <li
      data-own-team={own || undefined}
      className={`grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2 rounded px-1.5 py-1 ${own ? "bg-amber-100 dark:bg-amber-500/20" : ""}`}
    >
      <span className="text-right tabular-nums text-muted-foreground">{team.rank}</span>
      <span className="min-w-0">
        <span className={`text-foreground ${own ? "font-semibold" : "font-medium"}`}>{team.debaters}</span>{" "}
        <span className="text-xs text-muted-foreground">
          {team.school} · {years(team)}
        </span>
        <span className="block text-xs text-muted-foreground">{finishes}</span>
        {college && <span className="block text-xs text-sky-700 dark:text-sky-300">College: {college}</span>}
      </span>
      <span
        className="text-right text-sm tabular-nums text-foreground"
        title={team.collegeCredit ? `${team.nationals} nationals + ${team.collegeCredit} college` : undefined}
      >
        {team.total}
      </span>
    </li>
  )
}

/** The modal's body, given the lists; split out so it renders in tests. */
export function HsAllTimeTeamsRankings({
  lists,
  schoolKey,
  collegeLoaded,
  initialEvent,
  titleId,
  onClose,
  limit = HS_ALL_TIME_LIMIT,
}: {
  lists: Lists
  schoolKey: string | null
  collegeLoaded: boolean
  initialEvent?: HsAllTimeEvent
  titleId?: string
  onClose?: () => void
  limit?: number
}) {
  const events = HS_ALL_TIME_EVENTS.filter((event) => lists[event]?.length)
  const [event, setEvent] = useState<HsAllTimeEvent>(initialEvent && events.includes(initialEvent) ? initialEvent : events[0])
  if (!events.length) return null
  const list = lists[event] ?? []
  const top = list.slice(0, limit)
  const ownBest = schoolKey ? list.find((team) => team.schoolKey === schoolKey) : undefined
  const ownOutside = ownBest && !top.includes(ownBest) ? ownBest : null
  const p = HS_ALL_TIME_POINTS
  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold">
            <Crown className="h-4 w-4 text-amber-500" aria-hidden />
            Greatest of all time · high school
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Top {limit} teams per event by TOC, NDCA and Barkley Forum finishes (champion {p.Champion}, finalist{" "}
            {p.Finalist}, semifinalist {p.Semifinalist}, top speaker {p["Top speaker"]}), plus{" "}
            {HS_ALL_TIME_COLLEGE_SHARE * 100}% of each debater's own college NDT points
            {collegeLoaded ? "" : " (loading college records…)"}.{schoolKey ? " This school's teams are highlighted." : ""}
          </p>
        </div>
        {onClose && (
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X aria-hidden />
          </Button>
        )}
      </div>
      <div role="tablist" aria-label="Event" className="flex gap-1 border-b px-4 py-2">
        {events.map((e) => (
          <Button
            key={e}
            type="button"
            role="tab"
            aria-selected={e === event}
            variant={e === event ? "default" : "outline"}
            size="sm"
            onClick={() => setEvent(e)}
          >
            {e}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <ol aria-label={`Greatest ${event} teams of all time`} className="space-y-0.5 text-sm">
          {top.map((team) => (
            <TeamRow key={`${team.schoolKey}-${team.debaters}`} team={team} own={team.schoolKey === schoolKey} />
          ))}
        </ol>
      </div>
      {ownOutside && (
        <div className="border-t px-3 py-2">
          <p className="px-1.5 text-xs text-muted-foreground">This school's best in {event}</p>
          <ol className="text-sm">
            <TeamRow team={ownOutside} own />
          </ol>
        </div>
      )}
    </div>
  )
}

/** The event where `schoolKey` has its best-ranked team, if any. */
function bestEvent(lists: Lists, schoolKey: string | null): HsAllTimeEvent | undefined {
  if (!schoolKey) return undefined
  let best: { event: HsAllTimeEvent; rank: number } | undefined
  for (const event of HS_ALL_TIME_EVENTS) {
    const team = lists[event].find((t) => t.schoolKey === schoolKey)
    if (team && (!best || team.rank < best.rank)) best = { event, rank: team.rank }
  }
  return best?.event
}

/** @param props.school - School name as the rankings spell it. */
export function ProfileHsAllTimeTeams({ school, className = "mt-4" }: { school: string; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [withCollege, setWithCollege] = useState<Lists | null>(null)
  const bundled = useMemo(() => hsAllTimeTeams(), [])
  const lists = withCollege ?? bundled
  const schoolKey = useMemo(() => hsAllTimeSchoolKey(school, bundled), [school, bundled])
  const initialEvent = useMemo(() => bestEvent(bundled, schoolKey), [bundled, schoolKey])

  useEffect(() => {
    if (!open || withCollege) return
    let live = true
    loadHsAllTimeTeams()
      .then((loaded) => live && setWithCollege(loaded))
      .catch(() => {
        // The lists stay on national finishes alone.
      })
    return () => {
      live = false
    }
  }, [open, withCollege])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
    }
  }, [open])

  return (
    <div className={className}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Crown className="text-amber-500" aria-hidden />
        Greatest of all time · high school
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="hs-all-time-title"
        onClose={() => setOpen(false)}
        onClick={(event) => event.target === event.currentTarget && setOpen(false)}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[85vh] overflow-hidden rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        {open && (
          <HsAllTimeTeamsRankings
            lists={lists}
            schoolKey={schoolKey}
            collegeLoaded={withCollege !== null}
            initialEvent={initialEvent}
            titleId="hs-all-time-title"
            onClose={() => setOpen(false)}
          />
        )}
      </dialog>
    </div>
  )
}
