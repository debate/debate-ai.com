/**
 * @fileoverview Program strength section of a college school profile: a bar
 * chart of the program's weighted strength score for every season back to its
 * first NDT, and its rank among every college program for the latest season,
 * the last ten seasons and all time. The formula ({@link STRENGTH_WEIGHTS})
 * is printed under the chart. Renders nothing for a school with no college
 * record.
 * @module panels/leaderboard/profile/ProfileProgramStrength
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { cedaTitlesBySchool } from "@debate-ai/data-sync/src/rankings/ceda-champions"
import {
  COLLEGE_HISTORY_FIRST_YEAR,
  COLLEGE_HISTORY_LAST_YEAR,
  loadCollegeHistory,
} from "../../college-history"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "../ui/charts/chart"
import { loadNdtHistory } from "./ndtHistory"
import {
  buildProgramStrengths,
  latestStrengthYear,
  programResolver,
  programSeasonSeries,
  rankProgram,
  seasonLabel,
  STRENGTH_COMPONENTS,
  STRENGTH_WEIGHTS,
  type ProgramRank,
  type ProgramSeason,
  type ProgramStrength,
} from "./programStrength"

const chartConfig = {
  total: { label: "Strength", color: "var(--primary)" },
} satisfies ChartConfig

interface StrengthTable {
  programs: ProgramStrength[]
  resolve: (school: string) => { key: string; name: string }
}

let tablePromise: Promise<StrengthTable> | null = null

/** Builds every program's scores once, on the first school page that needs them. */
function loadStrengthTable(): Promise<StrengthTable> {
  tablePromise ??= (async () => {
    const years: number[] = []
    for (let year = COLLEGE_HISTORY_FIRST_YEAR; year <= COLLEGE_HISTORY_LAST_YEAR; year++) years.push(year)
    const [ndt, rankings] = await Promise.all([
      loadNdtHistory(),
      Promise.all(years.map(async (year) => ({ year, entries: await loadCollegeHistory(year) }))),
    ])
    const ceda = cedaTitlesBySchool()
    return { programs: buildProgramStrengths({ ndt, ceda, rankings }), resolve: programResolver(ndt, ceda) }
  })().catch((err) => {
    tablePromise = null
    throw err
  })
  return tablePromise
}

function useStrengthTable(): StrengthTable | null {
  const [table, setTable] = useState<StrengthTable | null>(null)
  useEffect(() => {
    let cancelled = false
    loadStrengthTable()
      .then((loaded) => !cancelled && setTable(loaded))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return table
}

function RankStat({ label, rank }: { label: string; rank: ProgramRank | null }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">
        {rank ? `#${rank.rank}` : "—"}
        {rank && <span className="text-sm font-normal text-muted-foreground"> of {rank.of}</span>}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs tabular-nums text-muted-foreground/80">{rank ? `${rank.score} pts` : "no results"}</div>
    </div>
  )
}

function SeasonTooltip({ season }: { season: ProgramSeason }) {
  const parts = STRENGTH_COMPONENTS.filter(({ key }) => season.parts[key] > 0)
  return (
    <div className="grid min-w-[10rem] gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">
        {seasonLabel(season.year)} · <span className="tabular-nums">{season.total} pts</span>
      </div>
      {parts.length === 0 && <div className="text-muted-foreground">No results</div>}
      {parts.map(({ key, label }) => (
        <div key={key} className="flex justify-between gap-3 text-muted-foreground">
          <span>{label}</span>
          <span className="tabular-nums text-foreground">{season.parts[key]}</span>
        </div>
      ))}
    </div>
  )
}

const ELIM_ROUNDS = ["Champion", "Finals", "Semis", "Quarters", "Octas", "Doubles"]

/** The formula, as printed under the chart. */
function StrengthFormula() {
  const w = STRENGTH_WEIGHTS
  return (
    <details className="mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer text-sm text-foreground">How the score works</summary>
      <p className="mt-2">A season's score adds up what the program's teams did that year:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        <li>
          NDT elims, per team by the round it reached:{" "}
          {ELIM_ROUNDS.map((round) => `${round} ${w.ndtElim[round]}`).join(", ")}
        </li>
        <li>Copeland Award (the NDT's top first-round seed): {w.copeland}</li>
        <li>CEDA national championship: {w.ceda}</li>
        <li>
          NDT speaker awards: top speaker {w.speaker[0].points}, 2nd–5th {w.speaker[1].points}, 6th–10th{" "}
          {w.speaker[2].points}, 11th–20th {w.speaker[3].points}
        </li>
        <li>First-round at-large bid, per team: {w.firstRoundBid}</li>
        <li>
          Each team in debatedata's top 100 ({seasonLabel(COLLEGE_HISTORY_FIRST_YEAR)} on): (101 − rank) ÷{" "}
          {w.rankingDivisor}, so #1 is 5 and #100 is 0.05
        </li>
        <li>Attending the NDT: {w.ndtAttendance}</li>
      </ul>
      <p className="mt-2">
        Ranks compare every college program that scored in the span. Seasons before{" "}
        {seasonLabel(COLLEGE_HISTORY_FIRST_YEAR)} have no top-100 table, CEDA titles start in 1986, and the newest
        season counts only the sources that already cover it.
      </p>
    </details>
  )
}

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileProgramStrength({ school }: { school: string }) {
  const table = useStrengthTable()

  const view = useMemo(() => {
    if (!table) return null
    const { key, name } = table.resolve(school)
    const program = table.programs.find((candidate) => candidate.key === key)
    if (!program) return null
    const latest = latestStrengthYear(table.programs)
    const series = programSeasonSeries(program, latest)
    const best = series.reduce((top, season) => (season.total > top.total ? season : top), series[0])
    return {
      name,
      latest,
      series,
      best,
      season: rankProgram(table.programs, key, latest, latest),
      decade: rankProgram(table.programs, key, latest - 9, latest),
      allTime: rankProgram(table.programs, key),
    }
  }, [table, school])

  if (!view || !view.series.length) return null
  const first = view.series[0].year

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" aria-hidden />
          Program strength by season
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {view.name} · weighted score from NDT, CEDA and top-100 results, {seasonLabel(first)} to{" "}
          {seasonLabel(view.latest)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <RankStat label={`${seasonLabel(view.latest)} season`} rank={view.season} />
          <RankStat label={`Last decade, ${seasonLabel(view.latest - 9)} on`} rank={view.decade} />
          <RankStat label={`All time, since ${seasonLabel(first)}`} rank={view.allTime} />
        </div>

        <ChartContainer config={chartConfig} className="mt-4 h-[220px] w-full">
          <BarChart data={view.series} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} minTickGap={16} />
            <YAxis tick={{ fontSize: 10 }} width={36} tickLine={false} axisLine={false} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={({ active, payload }) =>
                active && payload?.[0] ? <SeasonTooltip season={payload[0].payload as ProgramSeason} /> : null
              }
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
        {view.best.total > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Best season: {seasonLabel(view.best.year)}, {view.best.total} pts. Bars are labeled by the year the
            season ends.
          </p>
        )}

        <StrengthFormula />
      </CardContent>
    </Card>
  )
}
