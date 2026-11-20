/**
 * @fileoverview The "Elite 8" bump chart at the top of the Schools rankings
 * page: the eight schools with the most all-seasons NDT points, one line
 * each, plotting where the school ranked among every NDT school season by
 * season over the last fifty seasons ({@link buildEliteSchools}). Hovering a
 * line (or its legend chip) fades the other seven; hovering a season's point
 * shows what the school did at that NDT. Clicking a chip pins that school.
 *
 * The chart itself ({@link EliteSchoolsBumpChart}) takes any
 * {@link EliteSchoolsChart} plus its wording, so the high school event tabs
 * draw their own Elite 8 (`HsEliteSchoolsChart`) with it.
 * @module leaderboard/profile/NdtEliteSchoolsChart
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Trophy } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { fetchSchoolElite, HS_ELITE_WINDOW } from "../../school-elite"
import { schoolSeasonKey, type SchoolSeasonEvent } from "../../school-seasons"
import { ChartContainer, type ChartConfig } from "../ui/charts/chart"
import { useSchoolLogo } from "../lib/school-art-settings"
import { useNdtHistory } from "./ndtHistory"
import { schoolHref } from "./rankingProfileHelpers"
import { ndtSchoolDisplayName } from "./ndtAllSeasons"
import {
  buildEliteSchools,
  ELITE_RANK_FLOOR,
  ELITE_WINDOW,
  eliteShortName,
  type EliteAccomplishment,
  type EliteSchool,
  type EliteSchoolsChart,
  type EliteSeason,
} from "./ndtEliteSchools"

/** One distinct color per line, readable on light and dark backgrounds. */
export const ELITE_COLORS = ["#7c3aed", "#ea580c", "#dc2626", "#16a34a", "#2563eb", "#ca8a04", "#0891b2", "#db2777"]

const KIND_ICON: Record<EliteAccomplishment["kind"], string> = {
  title: "🏆",
  elim: "•",
  copeland: "🥇",
  bid: "•",
  speaker: "🎤",
  entry: "•",
}

/** The words around one Elite 8 chart. */
export interface EliteChartCopy {
  /** Id for the heading the section is labelled by. */
  id: string
  title: ReactNode
  intro: ReactNode
  /** Who a rank is among, e.g. `"NDT schools"`. */
  rankOf: string
  /** The season's own points, e.g. `"this NDT"`. */
  seasonLabel: string
  /** Seasons each rank sums. */
  window: number
  /** A season with nothing to list. */
  empty: string
  /** What a filled point marks, e.g. `"NDT titles"`. */
  titles: string
  name: (school: EliteSchool) => string
  href: (school: EliteSchool) => string
}

/** Tooltip width in px (`w-64`). */
const TOOLTIP_WIDTH = 256

interface HoverPoint {
  index: number
  year: number
  x: number
  y: number
}

/** Beside the point, on whichever side has room, kept inside the chart's width; above it in the lower half. */
function tooltipPosition(point: HoverPoint, width: number) {
  const beside = point.x > width / 2 ? point.x - TOOLTIP_WIDTH - 12 : point.x + 12
  const left = Math.max(0, Math.min(beside, width - TOOLTIP_WIDTH))
  return { left, top: point.y, transform: point.y > 180 ? "translateY(calc(-100% - 10px))" : "translateY(10px)" }
}

/**
 * A chip's school mark: the logo alone, or the short name when the school has
 * no logo or Settings has school logos off. The full name stays on the chip's
 * `aria-label` and `title`.
 */
export function EliteChipMark({ name }: { name: string }) {
  const logo = useSchoolLogo(name)
  if (!logo) return <span>{eliteShortName(name)}</span>
  if (typeof logo === "function") {
    const Logo = logo
    return <Logo aria-hidden className="h-4 w-auto shrink-0" />
  }
  return <img src={typeof logo === "string" ? logo : logo.src} alt="" aria-hidden className="h-4 w-auto shrink-0" />
}

function SeasonTooltip({
  school,
  season,
  color,
  copy,
}: {
  school: EliteSchool
  season: EliteSeason
  color: string
  copy: EliteChartCopy
}) {
  const name = copy.name(school)
  return (
    <div className="w-64 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-lg">
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="truncate">{name}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{season.year}</span>
      </div>
      <p className="mb-1.5 text-muted-foreground">
        #{season.rank} of {copy.rankOf} · {season.seasonPoints} pts {copy.seasonLabel}, {season.windowPoints} over{" "}
        {copy.window} seasons
      </p>
      {season.accomplishments.length ? (
        <ul className="space-y-0.5">
          {season.accomplishments.slice(0, 10).map((item, i) => (
            <li key={i} className={`flex gap-1.5 ${item.kind === "title" || item.kind === "copeland" ? "font-medium" : ""}`}>
              <span aria-hidden className="w-4 shrink-0 text-center">
                {KIND_ICON[item.kind]}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
          {season.accomplishments.length > 10 && (
            <li className="pl-5 text-muted-foreground">+{season.accomplishments.length - 10} more</li>
          )}
        </ul>
      ) : (
        <p className="text-muted-foreground">{copy.empty}</p>
      )}
    </div>
  )
}

/** The NDT chart's wording. */
function ndtCopy(chart: EliteSchoolsChart): EliteChartCopy {
  return {
    id: "ndt-elite-8-title",
    title: `Elite 8: the top college programs, ${chart.firstYear}–${chart.lastYear}`,
    intro: (
      <>
        The eight schools with the most all-seasons NDT points, and where each ranked among every NDT school each
        season by its points over the last {ELITE_WINDOW} NDTs (elims, Copeland, first-round bids, speakers; pre-2000
        at 0.6×). Hover a line to follow one school, or a point for what it did that year.
      </>
    ),
    rankOf: "NDT schools",
    seasonLabel: "this NDT",
    window: ELITE_WINDOW,
    empty: "No elims, bids or speaker awards at this NDT.",
    titles: "NDT titles",
    name: (school) => ndtSchoolDisplayName(school.school),
    href: (school) => schoolHref(ndtSchoolDisplayName(school.school)),
  }
}

/**
 * The NDT chart for a loaded history.
 *
 * @param props.history - The NDT school history.
 */
export function NdtEliteSchoolsChart({ history, className = "" }: { history: NdtSchoolHistory[]; className?: string }) {
  const chart = useMemo(() => buildEliteSchools(history), [history])
  const copy = useMemo(() => ndtCopy(chart), [chart])
  return <EliteSchoolsBumpChart chart={chart} copy={copy} className={className} />
}

/**
 * An Elite 8 bump chart: one line per school, its rank season by season.
 *
 * @param props.chart - The schools and their seasons.
 * @param props.copy - The chart's wording, names and links.
 */
export function EliteSchoolsBumpChart({
  chart,
  copy,
  className = "",
}: {
  chart: EliteSchoolsChart
  copy: EliteChartCopy
  className?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [point, setPoint] = useState<HoverPoint | null>(null)
  const focus = point?.index ?? hovered ?? pinned
  const wrapRef = useRef<HTMLDivElement>(null)

  const data = useMemo(
    () =>
      chart.schools[0]?.seasons.map((_, i) => {
        const row: Record<string, number> = { year: chart.schools[0].seasons[i].year }
        chart.schools.forEach((school, s) => {
          row[`s${s}`] = Math.min(school.seasons[i].rank, ELITE_RANK_FLOOR)
        })
        return row
      }) ?? [],
    [chart],
  )

  const config = useMemo(
    () =>
      Object.fromEntries(
        chart.schools.map((school, s) => [`s${s}`, { label: copy.name(school), color: ELITE_COLORS[s] }]),
      ) satisfies ChartConfig,
    [chart, copy],
  )

  if (!chart.schools.length) return null

  const ticks = [1, 5, 10, 15, 20, ELITE_RANK_FLOOR]
  const pointSchool = point ? chart.schools[point.index] : null
  const pointSeason = pointSchool?.seasons.find((season) => season.year === point!.year)

  return (
    <section aria-labelledby={copy.id} className={`rounded-lg border p-3 sm:p-4 ${className}`}>
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
        <h2 id={copy.id} className="text-base font-semibold">
          {copy.title}
        </h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{copy.intro}</p>

      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Elite 8 schools">
        {chart.schools.map((school, s) => {
          const active = focus === s
          const name = copy.name(school)
          return (
            <button
              key={school.school}
              type="button"
              aria-label={`${school.allTimeRank}. ${name}`}
              title={name}
              aria-pressed={pinned === s}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(s)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned(pinned === s ? null : s)}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-opacity ${
                focus !== null && !active ? "opacity-40" : ""
              } ${pinned === s ? "bg-muted font-medium" : ""}`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ELITE_COLORS[s] }} aria-hidden />
              <span className="tabular-nums text-muted-foreground">{school.allTimeRank}</span>
              <EliteChipMark name={name} />
            </button>
          )
        })}
      </div>

      <div
        ref={wrapRef}
        className="relative"
        onMouseLeave={() => {
          setPoint(null)
          setHovered(null)
        }}
        onClick={(event) => {
          // A tap off the points closes the tooltip on touch screens, where there is no mouse leave.
          if (!(event.target as Element).classList?.contains("cursor-pointer")) setPoint(null)
        }}
      >
        <ChartContainer config={config} className="aspect-auto h-[320px] w-full sm:h-[380px] [&_*:focus:not(:focus-visible)]:outline-none">
          <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} minTickGap={20} />
            <YAxis
              reversed
              domain={[1, ELITE_RANK_FLOOR]}
              ticks={ticks}
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              tickFormatter={(rank: number) => (rank === ELITE_RANK_FLOOR ? `${rank}+` : `#${rank}`)}
              width={34}
              tickLine={false}
              axisLine={false}
            />
            {chart.schools.map((school, s) => {
              const dim = focus !== null && focus !== s
              return (
                <Line
                  key={school.school}
                  dataKey={`s${s}`}
                  name={copy.name(school)}
                  type="monotone"
                  stroke={ELITE_COLORS[s]}
                  strokeWidth={focus === s ? 3 : 1.75}
                  strokeOpacity={dim ? 0.12 : 1}
                  isAnimationActive={false}
                  activeDot={false}
                  onMouseEnter={() => setHovered(s)}
                  dot={(props: { cx?: number; cy?: number; index?: number; payload?: { year: number } }) => {
                    const { cx, cy, index, payload } = props
                    if (cx === undefined || cy === undefined || !payload) return <g key={`${s}-${index}`} />
                    const isPoint = point?.index === s && point.year === payload.year
                    const title = school.seasons[index ?? 0]?.accomplishments.some((a) => a.kind === "title")
                    return (
                      <g key={`${s}-${index}`}>
                        {(focus === s || title) && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isPoint ? 5 : title ? 3.5 : 2.5}
                            fill={title ? ELITE_COLORS[s] : "var(--background)"}
                            stroke={ELITE_COLORS[s]}
                            strokeWidth={1.5}
                            opacity={dim ? 0.15 : 1}
                          />
                        )}
                        {!dim && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={7}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setPoint({ index: s, year: payload.year, x: cx, y: cy })}
                            onClick={() => setPoint({ index: s, year: payload.year, x: cx, y: cy })}
                          />
                        )}
                      </g>
                    )
                  }}
                />
              )
            })}
          </LineChart>
        </ChartContainer>
        {point && pointSchool && pointSeason && (
          <div
            className="pointer-events-none absolute z-10"
            style={tooltipPosition(point, wrapRef.current?.clientWidth ?? 600)}
          >
            <SeasonTooltip school={pointSchool} season={pointSeason} color={ELITE_COLORS[point.index]} copy={copy} />
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Filled points are {copy.titles}. Ranks {ELITE_RANK_FLOOR} and lower sit on the bottom line.{" "}
        {focus !== null && (
          <Link href={copy.href(chart.schools[focus])} className="underline">
            Open {copy.name(chart.schools[focus])}
          </Link>
        )}
      </p>
    </section>
  )
}

/** The chart as a section of the Schools rankings page. Loads the NDT history itself. */
export function NdtEliteSchoolsSection({ className = "" }: { className?: string }) {
  const history = useNdtHistory()
  if (!history) {
    return (
      <p className={`rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground ${className}`}>
        Loading the Elite 8 chart...
      </p>
    )
  }
  return <NdtEliteSchoolsChart history={history} className={className} />
}

/** The high school charts' wording, per event. */
const HS_EVENT_NAMES: Record<SchoolSeasonEvent, string> = {
  Policy: "Policy",
  "Lincoln-Douglas": "LD",
  "Public Forum": "PF",
}

function hsCopy(event: SchoolSeasonEvent, chart: EliteSchoolsChart): EliteChartCopy {
  const label = HS_EVENT_NAMES[event]
  return {
    id: `hs-elite-8-${schoolSeasonKey(event)}-title`,
    title: `Elite 8: the top high school ${label} programs, ${chart.firstYear}–${chart.lastYear}`,
    intro: (
      <>
        The eight high schools with the most all-time {label} program points, and where each ranked among every {label}{" "}
        program each season by its points over the last {HS_ELITE_WINDOW} seasons: Tournament of Champions finishes
        back to {chart.firstYear} (champion 30, runner-up 18, top speaker 10), plus each season&apos;s two best
        top-100 entries and TOC qualifiers from 2015-16 on. Hover a line to follow one school, or a point for what it
        did that year.
      </>
    ),
    rankOf: `${label} programs`,
    seasonLabel: "this season",
    window: HS_ELITE_WINDOW,
    empty: `No TOC finishes or top-100 ${label} entries this season.`,
    titles: `TOC ${label} titles`,
    name: (school) => school.school,
    href: (school) => (school.handle ? `/@${school.handle}` : schoolHref(school.school)),
  }
}

/**
 * One high school event's Elite 8, as a section of the Schools rankings
 * page. Loads the chart from the server ({@link fetchSchoolElite}).
 *
 * @param props.event - Policy, Lincoln-Douglas or Public Forum.
 */
export function HsEliteSchoolsSection({ event, className = "" }: { event: SchoolSeasonEvent; className?: string }) {
  const [state, setState] = useState<{ event: SchoolSeasonEvent; chart: EliteSchoolsChart | null; error?: boolean }>()
  useEffect(() => {
    let live = true
    fetchSchoolElite(event).then(
      (chart) => live && setState({ event, chart }),
      () => live && setState({ event, chart: null, error: true }),
    )
    return () => {
      live = false
    }
  }, [event])
  const chart = state?.event === event ? state.chart : undefined
  const copy = useMemo(() => (chart ? hsCopy(event, chart) : null), [event, chart])
  if (state?.event === event && state.error) return null
  if (!chart || !copy) {
    return (
      <p className={`rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground ${className}`}>
        Loading the Elite 8 chart...
      </p>
    )
  }
  return <EliteSchoolsBumpChart key={event} chart={chart} copy={copy} className={className} />
}
