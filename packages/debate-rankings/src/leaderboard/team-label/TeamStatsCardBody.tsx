/**
 * @fileoverview The inside of a team's hover card ({@link TeamHoverCard}):
 * the team's badges, its season stats from the rankings row the caller
 * passed, and its all-time records — NDT team and debater ranks, the school's
 * all-time NDT rank, and its high school all-time (TOC/NDCA/Barkley/Cal)
 * entry. This module and the all-time tables it reads are only loaded when a
 * card first opens, so a list of labels costs nothing until one is hovered.
 * @module leaderboard/team-label/TeamStatsCardBody
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { cn } from "../ui/lib/utils"
import { loadNdtAllTimeRankMaps, loadNdtAllTimeRanks, type NdtAllTimeRank, type NdtTeamAllTimeRanks } from "../profile/ndtAllTimeRanks"
import { loadHsAllTimeTeams, type HsAllTimeEvent, type HsAllTimeTeam } from "../profile/hsAllTimeTeams"
import { schoolHref } from "../profile/rankingProfileHelpers"
import { teamRankStats, type TeamSide } from "./TeamLabel"
import {
  findHsAllTimeTeam,
  teamHoverBadges,
  teamHoverCode,
  teamHoverYear,
  type TeamHoverBadge,
  type TeamHoverQuery,
} from "./teamHoverStats"

type Loaded<T> = { status: "loading" } | { status: "done"; value: T }

/** Runs `load` once on mount; a failure settles as `null` so the card just leaves that part out. */
function useLoaded<T>(load: () => Promise<T | null>, deps: unknown[]): Loaded<T | null> {
  const [state, setState] = useState<Loaded<T | null>>({ status: "loading" })
  useEffect(() => {
    let live = true
    setState({ status: "loading" })
    load().then(
      (value) => live && setState({ status: "done", value }),
      () => live && setState({ status: "done", value: null }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

const BADGE_TONE: Record<TeamHoverBadge["tone"], string> = {
  gold: "border-amber-400/70 bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  side: "",
  muted: "border-border bg-muted text-muted-foreground",
}

const SIDE_BADGE: Record<TeamSide, string> = {
  aff: "border-blue-400/60 bg-blue-50 text-blue-900 dark:bg-blue-400/15 dark:text-blue-200",
  neg: "border-red-400/60 bg-red-50 text-red-900 dark:bg-red-400/15 dark:text-red-200",
}

const HS_EVENT_SHORT: Record<HsAllTimeEvent, string> = {
  Policy: "Policy",
  "Lincoln-Douglas": "LD",
  "Public Forum": "PF",
}

const count = (n: number) => n.toLocaleString("en-US")

/** `#3 of 1,204`. */
const rankOf = (r: NdtAllTimeRank) => `#${r.rank} of ${count(r.of)}`

function StatRows({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return null
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-right tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1 border-t pt-2">
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

/** The all-time rows for a team's NDT and high school records. */
function allTimeRows(
  ndt: NdtTeamAllTimeRanks | null,
  ndtSchool: NdtAllTimeRank | null,
  hs: HsAllTimeTeam | null,
): [string, string][] {
  const rows: [string, string][] = []
  if (ndt?.team) rows.push([ndt.team.mode === "strict" ? "NDT team (together)" : "NDT team", rankOf(ndt.team)])
  for (const d of ndt?.debaters ?? []) rows.push([d.name, `${rankOf(d)} debaters`])
  if (ndtSchool) rows.push(["School (NDT)", rankOf(ndtSchool)])
  if (hs) {
    rows.push([`HS ${HS_EVENT_SHORT[hs.event]} team`, `#${hs.rank}`])
    rows.push(["HS years", hs.firstYear === hs.lastYear ? String(hs.firstYear) : `${hs.firstYear}–${hs.lastYear}`])
    if (hs.titles > 0) rows.push(["National titles", String(hs.titles)])
  }
  return rows
}

/** A high school team's best national finishes, newest first, at most three. */
function topFinishes(hs: HsAllTimeTeam): string[] {
  return [...hs.finishes]
    .sort((a, b) => b.points - a.points || b.year - a.year)
    .slice(0, 3)
    .map((f) => `${f.year} ${f.tournament} ${f.place}`)
}

export interface TeamStatsCardBodyProps {
  query: TeamHoverQuery
  side?: TeamSide | null
  /** The team's page, linked at the foot of the card. */
  href?: string
}

/** The hover card's contents; see the module overview. */
export default function TeamStatsCardBody({ query, side, href }: TeamStatsCardBodyProps) {
  const code = teamHoverCode(query)
  const year = teamHoverYear(query)
  const ranking = query.ranking ?? null
  const school = ranking?.school?.trim() || query.school?.trim() || null

  const ndt = useLoaded<NdtTeamAllTimeRanks>(
    () => (code ? loadNdtAllTimeRanks().then((lookup) => lookup(code, year)) : Promise.resolve(null)),
    [code, year],
  )
  const ndtSchoolName = ndt.status === "done" ? (ndt.value?.school ?? null) : null
  const ndtSchool = useLoaded<NdtAllTimeRank>(
    () => (ndtSchoolName ? loadNdtAllTimeRankMaps().then((maps) => maps.schools.get(ndtSchoolName) ?? null) : Promise.resolve(null)),
    [ndtSchoolName],
  )
  const hs = useLoaded<HsAllTimeTeam>(
    () => loadHsAllTimeTeams().then((lists) => findHsAllTimeTeam(lists, query)),
    [code, year, school],
  )

  const ndtValue = ndt.status === "done" ? ndt.value : null
  const hsValue = hs.status === "done" ? hs.value : null
  const loading = ndt.status === "loading" || hs.status === "loading"
  const badges = teamHoverBadges({ ranking, ndt: ndtValue, hs: hsValue })
  const seasonRows = ranking && typeof ranking.rank === "number" ? teamRankStats(ranking) : []
  const allTime = allTimeRows(ndtValue, ndtSchool.status === "done" ? ndtSchool.value : null, hsValue)
  const fullNames = ranking?.debaters?.length ? ranking.debaters.join(" & ") : hsValue?.debaters || null
  const debaters = ranking?.name?.trim() || query.debaters?.trim() || null

  return (
    <div className="space-y-2" data-team-stats-card="">
      <header>
        {school && <div className="font-semibold leading-tight">{school}</div>}
        {debaters && <div className="leading-tight text-muted-foreground">{fullNames ?? debaters}</div>}
      </header>

      {badges.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Badges">
          {badges.map((b) => (
            <li
              key={b.label}
              title={b.title}
              className={cn(
                "rounded-full border px-1.5 py-px text-[10px] font-semibold leading-4",
                b.tone === "side" ? SIDE_BADGE[side ?? "aff"] : BADGE_TONE[b.tone],
              )}
            >
              {b.label}
            </li>
          ))}
        </ul>
      )}

      {seasonRows.length > 0 && (
        <Section title={typeof ranking?.season === "number" ? "That season" : "This season"}>
          <StatRows rows={seasonRows} />
        </Section>
      )}

      {allTime.length > 0 && (
        <Section title="All time">
          <StatRows rows={allTime} />
          {hsValue && hsValue.finishes.length > 0 && (
            <ul className="mt-1 space-y-px text-[11px] text-muted-foreground">
              {topFinishes(hsValue).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {loading && allTime.length === 0 && (
        <p className="animate-pulse text-[11px] text-muted-foreground">Loading all-time records…</p>
      )}
      {!loading && seasonRows.length === 0 && allTime.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No rankings or all-time records found for this team yet.</p>
      )}

      {(href || school) && (
        <footer className="flex gap-3 border-t pt-2 text-[11px] font-medium">
          {href && (
            <Link href={href} className="text-primary hover:underline underline-offset-4">
              Team page →
            </Link>
          )}
          {school && (
            <Link href={schoolHref(school)} className="text-primary hover:underline underline-offset-4">
              School page →
            </Link>
          )}
        </footer>
      )}
    </div>
  )
}
