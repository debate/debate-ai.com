/**
 * @fileoverview Program strength section of a high school's profile, the
 * high school counterpart of {@link ProfileProgramStrength}: a stacked bar
 * chart of the school's score for every season from its first TOC finish (or
 * 2015-16, when ranked seasons begin) to now (by event), and
 * the best one or two ranked entries per event behind each season's score.
 * Finished seasons come from `/api/rankings/school-seasons`; the current one
 * from the rankings the page has loaded. Scoring is
 * {@link HS_STRENGTH_WEIGHTS}, printed under the chart. Renders nothing for a
 * school with no ranked season and no TOC finish since 2015-16.
 * @module leaderboard/profile/ProfileSchoolStrength
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  HS_STRENGTH_WEIGHTS,
  SCHOOL_SEASON_FIRST_YEAR,
  SCHOOL_SEASON_FORMATS,
  SCHOOL_SEASON_TEAMS_PER_EVENT,
  SCHOOL_STRENGTH_COMPONENTS,
  currentRankingSeasonYear,
  fetchSchoolSeasons,
  schoolSeasonScores,
  schoolSeasonsFromEntries,
  type SchoolSeasonEvent,
  type SchoolSeasonsResult,
  type SchoolStrengthEventRanks,
  type SchoolStrengthRank,
  type SchoolStrengthSeason,
} from "../../index"
import { findTocSchoolRecord } from "../../sync/toc-champions"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "../ui/charts/chart"
import { seasonLabel } from "./programStrength"
import { highSchoolHonors, honorHint } from "./schoolHonors"
import { teamHref, type ProfileEntry } from "./rankingProfileHelpers"

const DEBATE_EVENTS = new Set<string>(SCHOOL_SEASON_FORMATS.map((f) => f.event))

const EVENT_KEYS = { Policy: "policy", "Lincoln-Douglas": "ld", "Public Forum": "pf" } as const
const EVENT_SHORT = { Policy: "Policy", "Lincoln-Douglas": "LD", "Public Forum": "PF" } as const

const chartConfig = {
  policy: { label: "Policy", color: "var(--chart-1)" },
  ld: { label: "Lincoln-Douglas", color: "var(--chart-3)" },
  pf: { label: "Public Forum", color: "var(--chart-5)" },
} satisfies ChartConfig

/** Finished seasons from the server; `null` while loading. `failed` when they could not be loaded. */
function usePastSeasons(school: string): (SchoolSeasonsResult & { failed: boolean }) | null {
  const [state, setState] = useState<(SchoolSeasonsResult & { failed: boolean }) | null>(null)
  useEffect(() => {
    let cancelled = false
    setState(null)
    fetchSchoolSeasons(school)
      .then((result) => !cancelled && setState({ ...result, failed: false }))
      .catch(() => !cancelled && setState({ seasons: [], ranks: null, pending: 0, failed: true }))
    return () => {
      cancelled = true
    }
  }, [school])
  return state
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {note && <div className="text-xs tabular-nums text-muted-foreground/80">{note}</div>}
    </div>
  )
}

/** One rank cell: `#3 of 412` over its points, or why there is none. */
function RankCell({ rank, pending }: { rank: SchoolStrengthRank | null; pending: boolean }) {
  return (
    <td className="px-2 py-1.5 align-top">
      <div className="font-semibold tabular-nums text-foreground">
        {rank ? `#${rank.rank}` : "—"}
        {rank && <span className="text-xs font-normal text-muted-foreground"> of {rank.of}</span>}
      </div>
      <div className="text-xs tabular-nums text-muted-foreground/80">
        {rank ? `${rank.score} pts` : pending ? "still counting" : "no results"}
      </div>
    </td>
  )
}

/**
 * The school's standing in each event it competes in: its best season and its
 * rank among every program in that event over the last decade and all time.
 * Programs are ranked per event (the #1 Policy school, the #1 PF school),
 * never across events combined.
 */
function EventRanksTable({
  series,
  ranks,
  pending,
  decadeLabel,
  allTimeLabel,
}: {
  series: SchoolStrengthSeason[]
  ranks: Partial<Record<SchoolSeasonEvent, SchoolStrengthEventRanks>> | null
  pending: boolean
  decadeLabel: string
  allTimeLabel: string
}) {
  const rows = SCHOOL_SEASON_FORMATS.map(({ event }) => {
    const best = series.reduce<SchoolStrengthSeason | null>(
      (top, season) => (season.byEvent[event] > (top?.byEvent[event] ?? 0) ? season : top),
      null,
    )
    return { event, best, ranks: ranks?.[event] ?? null }
  }).filter(({ best, ranks: own }) => best || own?.allTime)
  if (!rows.length) return null
  return (
    <div className="mt-3 overflow-x-auto rounded-md border bg-muted/30">
      <table data-event-ranks className="w-full text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-2 py-1.5 font-medium">Event</th>
            <th className="px-2 py-1.5 font-medium">Best season</th>
            <th className="px-2 py-1.5 font-medium">{decadeLabel}</th>
            <th className="px-2 py-1.5 font-medium">{allTimeLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ event, best, ranks: own }) => (
            <tr key={event} className="border-b last:border-0">
              <th scope="row" className="px-2 py-1.5 align-top font-medium text-foreground">
                {event}
              </th>
              <td className="px-2 py-1.5 align-top">
                <div className="font-semibold tabular-nums text-foreground">{best ? seasonLabel(best.year) : "—"}</div>
                {best && <div className="text-xs tabular-nums text-muted-foreground/80">{best.byEvent[event]} pts</div>}
              </td>
              <RankCell rank={own?.decade ?? null} pending={pending} />
              <RankCell rank={own?.allTime ?? null} pending={pending} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SeasonTooltip({ season }: { season: SchoolStrengthSeason }) {
  const parts = SCHOOL_STRENGTH_COMPONENTS.filter(({ key }) => season.parts[key] > 0)
  return (
    <div className="grid min-w-[11rem] gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">
        {seasonLabel(season.year)} · <span className="tabular-nums">{season.total} pts</span>
      </div>
      {parts.length === 0 && <div className="text-muted-foreground">No ranked entries</div>}
      {parts.map(({ key, label }) => (
        <div key={key} className="flex justify-between gap-3 text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums text-foreground">{season.parts[key]}</span>
        </div>
      ))}
      {season.seasons.map(({ event, teams }) => (
        <div key={event} className="text-muted-foreground">
          {EVENT_SHORT[event]}: {teams.map((team) => `#${team.rank} ${team.name}`).join(", ")}
        </div>
      ))}
    </div>
  )
}

/**
 * One listed entry, linked to its team page: the ranked team's profile when
 * it is in the current rankings, else its past-season profile
 * (`PastHighSchoolTeamProfile`), which every listed season's entry has.
 */
function TeamEntry({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-foreground hover:underline underline-offset-4">
      {children}
    </Link>
  )
}

/** Each season's best entries per event, newest first, each linked to its team page. */
function BestEntriesBySeason({ series, school }: { series: SchoolStrengthSeason[]; school: string }) {
  const seasons = series.filter((season) => season.seasons.length || season.total > 0).reverse()
  if (!seasons.length) return null
  return (
    <section className="mt-4">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">Best ranked entries by season</h3>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1 text-sm">
        {seasons.map((season) => (
          <li key={season.year} className="flex gap-3">
            <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{seasonLabel(season.year)}</span>
            <div className="min-w-0 flex-1 space-y-0.5">
              {season.seasons.length === 0 && (
                <div className="text-muted-foreground">
                  {season.parts.toc > 0 ? "TOC finishes only (no rankings this season)" : "No ranked entries"}
                </div>
              )}
              {season.seasons.map(({ event, teams }) => (
                <div key={event} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">{EVENT_SHORT[event]}</span>
                  {teams.map((team) => (
                    <TeamEntry
                      key={`${team.rank}-${team.name}`}
                      href={teamHref({ school, name: team.name })}
                    >
                      <span className="tabular-nums font-medium">#{team.rank}</span> {team.name}
                      {team.bids > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {team.bids} bid{team.bids === 1 ? "" : "s"}
                        </span>
                      )}
                    </TeamEntry>
                  ))}
                </div>
              ))}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{season.total} pts</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The formula, as printed under the chart. */
function StrengthFormula() {
  const w = HS_STRENGTH_WEIGHTS
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-sm text-foreground">How the score works</summary>
      <p className="mt-2">
        A season's score adds up, in Policy, Lincoln-Douglas and Public Forum, the school's best{" "}
        {SCHOOL_SEASON_TEAMS_PER_EVENT} entries in each event and its Tournament of Champions results:
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        <li>
          Each counted entry in that season's Elo top 100: (101 − rank) ÷ {w.rankingDivisor}, so #1 is 5
          and #100 is 0.05
        </li>
        <li>
          Each counted entry that qualified for the TOC ({w.qualifyingBids}+ bids): {w.tocQualified}
        </li>
        <li>
          TOC finishes: champion {w.toc.Champion}, runner-up {w.toc["Runner-up"]}, semifinalist{" "}
          {w.toc.Semifinalist}, top speaker {w.toc["Top speaker"]}
        </li>
      </ul>
      <p className="mt-2">
        Ranks are among every entry rated that season ({seasonLabel(SCHOOL_SEASON_FIRST_YEAR)} on), so
        earlier seasons, back to the school's first TOC finish, score TOC results only. The current season counts
        the rankings so far.
      </p>
    </details>
  )
}

/**
 * @param props.school - School name as the rankings spell it.
 * @param props.entries - The school's rows in the current rankings, for the current season.
 */
export function ProfileSchoolStrength({ school, entries }: { school: string; entries: readonly ProfileEntry[] }) {
  const past = usePastSeasons(school)

  const view = useMemo(() => {
    if (!past) return null
    const current = currentRankingSeasonYear()
    const seasons = [...past.seasons.filter((s) => s.year < current), ...schoolSeasonsFromEntries(entries, current)]
    const toc = findTocSchoolRecord(school)
    // Back to the school's first debate TOC finish (1972 on), else the first ranked season.
    const first = Math.min(
      SCHOOL_SEASON_FIRST_YEAR,
      ...(toc?.results ?? []).filter((r) => DEBATE_EVENTS.has(r.event)).map((r) => r.year),
    )
    const series = schoolSeasonScores(seasons, toc, first, current)
    if (!series.some((season) => season.total > 0 || season.seasons.length)) return null
    return {
      current,
      first,
      series,
      honors: highSchoolHonors(school),
      chart: series.map((season) => ({
        year: season.year,
        season,
        policy: season.byEvent.Policy,
        ld: season.byEvent["Lincoln-Douglas"],
        pf: season.byEvent["Public Forum"],
      })),
    }
  }, [past, entries, school])

  if (!view) return null

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" aria-hidden />
          Program strength by season
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {school} · weighted score from each event's best {SCHOOL_SEASON_TEAMS_PER_EVENT} ranked entries and TOC
          results, {seasonLabel(view.first)} to {seasonLabel(view.current)}
        </p>
        <EventRanksTable
          series={view.series}
          ranks={past?.ranks?.byEvent ?? null}
          pending={!past?.ranks}
          decadeLabel={`Last decade, ${seasonLabel(past?.ranks?.decadeFrom ?? view.current - 9)} on`}
          allTimeLabel={`All time, since ${seasonLabel(view.first)}`}
        />
        {!!past?.pending && (
          <p className="mt-1 text-xs text-muted-foreground">
            Ranks count only the seasons loaded so far; {past.pending} older season{past.pending === 1 ? "" : "s"} fill in
            with the daily refresh.
          </p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Championships" value={view.honors.championships.total} note={honorHint(view.honors.championships)} />
          <Stat label="Finalists" value={view.honors.finalists.total} note={honorHint(view.honors.finalists)} />
          <Stat label="Top speakers" value={view.honors.topSpeakers.total} note={honorHint(view.honors.topSpeakers)} />
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mt-4 h-[220px] w-full">
          <BarChart data={view.chart} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 10 }} width={36} tickLine={false} axisLine={false} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <SeasonTooltip season={(payload[0].payload as { season: SchoolStrengthSeason }).season} />
                ) : null
              }
            />
            {SCHOOL_SEASON_FORMATS.map(({ event }, i) => (
              <Bar
                key={event}
                dataKey={EVENT_KEYS[event]}
                stackId="events"
                fill={`var(--color-${EVENT_KEYS[event]})`}
                radius={i === SCHOOL_SEASON_FORMATS.length - 1 ? [2, 2, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ChartContainer>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {SCHOOL_SEASON_FORMATS.map(({ event }) => (
            <span key={event} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: chartConfig[EVENT_KEYS[event]].color }}
                aria-hidden
              />
              {event}
            </span>
          ))}
          <span>Bars are labeled by the year the season ends.</span>
        </div>
        {past?.failed && (
          <p className="mt-1 text-xs text-muted-foreground">Past seasons could not be loaded; showing this season only.</p>
        )}

        <BestEntriesBySeason series={view.series} school={school} />

        <StrengthFormula />
      </CardContent>
    </Card>
  )
}
