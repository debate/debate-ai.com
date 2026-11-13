/**
 * @fileoverview Program strength of a college school profile, in two parts.
 * {@link ProfileProgramStrengthHeadline} sits in the page header: the
 * program's rank among every college program for the latest season, the last
 * ten seasons and all time, each card with a button that opens the full
 * ranked list for that span. {@link ProfileProgramStrength} is the card
 * further down: a bar chart of the program's weighted strength score for
 * every season back to its first NDT, with the formula
 * ({@link STRENGTH_WEIGHTS}) printed under it. Both render nothing for a
 * school with no college record.
 * @module panels/leaderboard/profile/ProfileProgramStrength
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ListOrdered, TrendingUp, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { cedaTitlesBySchool } from "../../sync/ceda-champions"
import {
  COLLEGE_HISTORY_FIRST_YEAR,
  COLLEGE_HISTORY_LAST_YEAR,
  loadCollegeHistory,
} from "../../college-history"
import { Button } from "../ui/primitives/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"
import { ChartContainer, ChartTooltip, type ChartConfig } from "../ui/charts/chart"
import { loadNdtHistory } from "./ndtHistory"
import { pastTeamHref } from "./pastTeamHelpers"
import { schoolHref, teamHref } from "./rankingProfileHelpers"
import {
  buildProgramStrengths,
  latestStrengthYear,
  programResolver,
  programSeasonSeries,
  rankProgram,
  rankPrograms,
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

/** The three spans a program is ranked over. */
type SpanId = "season" | "decade" | "allTime"

interface Span {
  id: SpanId
  /** Card label. */
  label: string
  /** Tab label in the full-list modal. */
  short: string
  from: number
  to: number
  rank: ProgramRank | null
}

function RankStat({ span, onShowAll }: { span: Span; onShowAll: () => void }) {
  const { rank, label } = span
  return (
    <div className="relative rounded-md border bg-muted/30 px-3 py-2 pr-9">
      <div className="text-lg font-semibold tabular-nums text-foreground">
        {rank ? `#${rank.rank}` : "—"}
        {rank && <span className="text-sm font-normal text-muted-foreground"> of {rank.of}</span>}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xs tabular-nums text-muted-foreground/80">{rank ? `${rank.score} pts` : "no results"}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onShowAll}
        aria-haspopup="dialog"
        aria-label={`Full ranking: ${label}`}
        title="Show the full ranking"
        className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <ListOrdered aria-hidden />
      </Button>
    </div>
  )
}

/** Rows shown before "Show more". */
const PAGE = 50

/**
 * Modal with every college program ranked over one span, a tab per span. The
 * school whose page it is is highlighted.
 */
function ProgramRankingDialog({
  programs,
  spans,
  spanId,
  ownKey,
  ownName,
  onSpan,
  onClose,
}: {
  programs: ProgramStrength[]
  spans: Span[]
  spanId: SpanId | null
  ownKey: string
  ownName: string
  onSpan: (id: SpanId) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE)
  const open = spanId !== null
  const span = spans.find((candidate) => candidate.id === spanId) ?? null

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

  useEffect(() => setShown(PAGE), [spanId, query])

  const rows = useMemo(() => (span ? rankPrograms(programs, span.from, span.to) : []), [programs, span])
  const needle = query.trim().toLowerCase()
  const matches = needle ? rows.filter((row) => row.name.toLowerCase().includes(needle)) : rows

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="program-ranking-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[85vh] overflow-hidden rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      {span && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="border-b px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="program-ranking-title" className="text-lg font-semibold">
                  Program strength: {span.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Every college program that scored, by weighted NDT, CEDA and top-100 points summed over the span.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X aria-hidden />
              </Button>
            </div>
            <p className="mt-2 text-sm">
              {ownName}:{" "}
              {span.rank ? (
                <>
                  <span className="font-semibold tabular-nums">#{span.rank.rank}</span> of {span.rank.of} ·{" "}
                  <span className="tabular-nums">{span.rank.score} pts</span>
                </>
              ) : (
                "no results in this span"
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Span" className="inline-flex rounded-md border p-0.5">
                {spans.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    role="tab"
                    aria-selected={candidate.id === span.id}
                    onClick={() => onSpan(candidate.id)}
                    className={`rounded px-3 py-1 text-sm ${candidate.id === span.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {candidate.short}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by school"
                aria-label="Filter by school"
                className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {matches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ol className="divide-y">
                {matches.slice(0, shown).map((row) => {
                  const own = row.key === ownKey
                  return (
                    <li
                      key={row.key}
                      className={`flex items-baseline gap-3 px-2 py-1.5 ${own ? "rounded-md bg-primary/10" : ""}`}
                      data-own-school={own || undefined}
                    >
                      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                        #{row.rank}
                      </span>
                      <Link
                        href={schoolHref(row.name)}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline underline-offset-4"
                      >
                        {row.name}
                      </Link>
                      <span className="shrink-0 text-sm tabular-nums text-foreground">{row.score} pts</span>
                    </li>
                  )
                })}
              </ol>
            )}
            {matches.length > shown && (
              <div className="py-2 text-center">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShown((count) => count + PAGE)}>
                  Show more ({matches.length - shown} left)
                </Button>
              </div>
            )}
            <div className="px-2 pb-2">
              <StrengthFormula />
            </div>
          </div>
        </div>
      )}
    </dialog>
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

/** The program's best top-100 teams, newest season first. */
function RankedTeamsBySeason({ series }: { series: ProgramSeason[] }) {
  const seasons = series.filter((season) => season.rankedTeams?.length).reverse()
  if (!seasons.length) return null
  return (
    <section className="mt-4">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">Best ranked teams by season</h3>
      <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1 text-sm">
        {seasons.map((season) => (
          <li key={season.year} className="flex flex-wrap items-baseline gap-x-3">
            <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{seasonLabel(season.year)}</span>
            {season.rankedTeams!.map((team) => (
              <Link
                key={`${team.rank}-${team.name}`}
                href={season.year === COLLEGE_HISTORY_LAST_YEAR ? teamHref(team) : pastTeamHref(team)}
                className="text-foreground hover:underline underline-offset-4"
              >
                <span className="tabular-nums font-medium">#{team.rank}</span> {team.name}
              </Link>
            ))}
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{season.parts.rankings} pts</span>
          </li>
        ))}
      </ul>
    </section>
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
          The program's best {w.rankedTeamsPerSeason} teams in debatedata's top 100 (
          {seasonLabel(COLLEGE_HISTORY_FIRST_YEAR)} on), each: (101 − rank) ÷ {w.rankingDivisor}, so #1 is 5 and
          #100 is 0.05
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

/** The program a school page is about, its season series and its rank over each span. */
function useProgramStrengthView(school: string) {
  const table = useStrengthTable()
  return useMemo(() => {
    if (!table) return null
    const { key, name } = table.resolve(school)
    const program = table.programs.find((candidate) => candidate.key === key)
    if (!program) return null
    const latest = latestStrengthYear(table.programs)
    const series = programSeasonSeries(program, latest)
    if (!series.length) return null
    const best = series.reduce((top, season) => (season.total > top.total ? season : top), series[0])
    const first = series[0].year
    const spans: Span[] = [
      {
        id: "season",
        label: `${seasonLabel(latest)} season`,
        short: seasonLabel(latest),
        from: latest,
        to: latest,
        rank: rankProgram(table.programs, key, latest, latest),
      },
      {
        id: "decade",
        label: `Last decade, ${seasonLabel(latest - 9)} on`,
        short: "Last decade",
        from: latest - 9,
        to: latest,
        rank: rankProgram(table.programs, key, latest - 9, latest),
      },
      {
        id: "allTime",
        label: `All time, since ${seasonLabel(first)}`,
        short: "All time",
        from: -Infinity,
        to: Infinity,
        rank: rankProgram(table.programs, key),
      },
    ]
    return { programs: table.programs, key, name, latest, first, series, best, spans }
  }, [table, school])
}

/**
 * The program's rank for the latest season, the last decade and all time,
 * for the school page header. Each card's list button opens every program's
 * ranking for that span.
 *
 * @param props.school - School name as the rankings spell it.
 * @param props.className - Extra classes for the section.
 */
export function ProfileProgramStrengthHeadline({ school, className = "" }: { school: string; className?: string }) {
  const view = useProgramStrengthView(school)
  const [openSpan, setOpenSpan] = useState<SpanId | null>(null)
  if (!view) return null
  return (
    <section className={className} aria-label="Program strength rank">
      <p className="text-sm text-muted-foreground">
        Program strength · weighted score from NDT, CEDA and top-100 results, {seasonLabel(view.first)} to{" "}
        {seasonLabel(view.latest)}
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {view.spans.map((span) => (
          <RankStat key={span.id} span={span} onShowAll={() => setOpenSpan(span.id)} />
        ))}
      </div>
      <ProgramRankingDialog
        programs={view.programs}
        spans={view.spans}
        spanId={openSpan}
        ownKey={view.key}
        ownName={view.name}
        onSpan={setOpenSpan}
        onClose={() => setOpenSpan(null)}
      />
    </section>
  )
}

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileProgramStrength({ school }: { school: string }) {
  const view = useProgramStrengthView(school)
  if (!view) return null

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" aria-hidden />
          Program strength by season
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {view.name} · weighted score from NDT, CEDA and top-100 results, {seasonLabel(view.first)} to{" "}
          {seasonLabel(view.latest)}. Its rank for this season, the last decade and all time is at the top of the
          page.
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
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

        <RankedTeamsBySeason series={view.series} />

        <StrengthFormula />
      </CardContent>
    </Card>
  )
}
