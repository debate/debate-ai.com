/**
 * @fileoverview The "Elite 8" bump chart at the top of the Schools rankings
 * page: the eight schools with the most all-seasons NDT points, one line
 * each, plotting where the school ranked among every NDT school season by
 * season over the last fifty seasons ({@link buildEliteSchools}). Hovering a
 * line (or its legend chip) fades the other seven; hovering a season's point
 * shows what the school did at that NDT. Clicking a chip pins that school.
 * @module leaderboard/profile/NdtEliteSchoolsChart
 */

"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { Trophy } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
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

function SeasonTooltip({ school, season, color }: { school: EliteSchool; season: EliteSeason; color: string }) {
  const name = ndtSchoolDisplayName(school.school)
  return (
    <div className="w-64 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-lg">
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="truncate">{name}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{season.year}</span>
      </div>
      <p className="mb-1.5 text-muted-foreground">
        #{season.rank} of NDT schools · {season.seasonPoints} pts this NDT, {season.windowPoints} over {ELITE_WINDOW}{" "}
        seasons
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
        <p className="text-muted-foreground">No elims, bids or speaker awards at this NDT.</p>
      )}
    </div>
  )
}

/**
 * The chart for a loaded history.
 *
 * @param props.history - The NDT school history.
 */
export function NdtEliteSchoolsChart({ history, className = "" }: { history: NdtSchoolHistory[]; className?: string }) {
  const chart = useMemo(() => buildEliteSchools(history), [history])
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
        chart.schools.map((school, s) => [`s${s}`, { label: ndtSchoolDisplayName(school.school), color: ELITE_COLORS[s] }]),
      ) satisfies ChartConfig,
    [chart],
  )

  if (!chart.schools.length) return null

  const ticks = [1, 5, 10, 15, 20, ELITE_RANK_FLOOR]
  const pointSchool = point ? chart.schools[point.index] : null
  const pointSeason = pointSchool?.seasons.find((season) => season.year === point!.year)

  return (
    <section aria-labelledby="ndt-elite-8-title" className={`rounded-lg border p-3 sm:p-4 ${className}`}>
      <div className="mb-1 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
        <h2 id="ndt-elite-8-title" className="text-base font-semibold">
          Elite 8: the top college programs, {chart.firstYear}–{chart.lastYear}
        </h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        The eight schools with the most all-seasons NDT points, and where each ranked among every NDT school each
        season by its points over the last {ELITE_WINDOW} NDTs (elims, Copeland, first-round bids, speakers; pre-2000
        at 0.6×). Hover a line to follow one school, or a point for what it did that year.
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Elite 8 schools">
        {chart.schools.map((school, s) => {
          const active = focus === s
          const name = ndtSchoolDisplayName(school.school)
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
                  name={ndtSchoolDisplayName(school.school)}
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
            <SeasonTooltip school={pointSchool} season={pointSeason} color={ELITE_COLORS[point.index]} />
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Filled points are NDT titles. Ranks {ELITE_RANK_FLOOR} and lower sit on the bottom line.{" "}
        {focus !== null && (
          <Link href={schoolHref(ndtSchoolDisplayName(chart.schools[focus].school))} className="underline">
            Open {ndtSchoolDisplayName(chart.schools[focus].school)}
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
