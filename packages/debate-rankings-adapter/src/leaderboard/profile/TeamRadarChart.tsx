/**
 * @fileoverview Radar chart rendering for ranking profiles. A single reusable
 * chart takes the six spokes of data directly, so the team profile page passes
 * one team's {@link teamRadarData}, and the school profile page passes the
 * averaged {@link schoolDivisionRadarData} for each division. A team can also
 * overlay one or two comparisons under its polygon, such as its school's
 * average (dashed) and, on the watch page, its opponent.
 * @module leaderboard/profile/TeamRadarChart
 */

"use client"

import type { ReactNode } from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "../ui/charts/chart"
import { type TeamRadarPoint } from "./rankingProfileHelpers"

const chartConfig = {
  score: { label: "Score", color: "var(--primary)" },
  compareScore: { label: "Comparison", color: "var(--muted-foreground)" },
  compareScore2: { label: "Second comparison", color: "#d97706" },
} satisfies ChartConfig

/** Series key, stroke dash and legend swatch of each overlay, in order. */
const OVERLAYS = [
  { key: "compareScore", dash: "4 3", swatch: "border-muted-foreground border-dashed" },
  { key: "compareScore2", dash: "1 3", swatch: "border-[#d97706] border-dotted" },
] as const

/** One spoke, with each overlaid series' score and real value. */
type ChartPoint = TeamRadarPoint & {
  compareScore?: number
  compareScore2?: number
  compareDisplays?: (string | undefined)[]
}

/** A second polygon drawn under the main one, such as the school average. */
export interface RadarComparison {
  /** Legend and tooltip label, e.g. "School average". */
  label: string
  /** Same six spokes, in the same order, as the main data. */
  data: TeamRadarPoint[]
}

/** Tooltip naming the hovered spoke and its real value (not the 0–100 score). */
function RadarTooltip({
  active,
  payload,
  compareLabels,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  compareLabels: string[]
}) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">{point.metric}</div>
      <div className="tabular-nums text-muted-foreground">{point.display}</div>
      {compareLabels.map((label, i) =>
        point.compareDisplays?.[i] === undefined ? null : (
          <div key={label} className="tabular-nums text-muted-foreground">
            {label}: {point.compareDisplays[i]}
          </div>
        ),
      )}
    </div>
  )
}

/**
 * Six-spoke radar for a ranking profile. Every spoke runs 0–100 with better
 * toward the edge; see {@link teamRadarData} for the scaling. The stat tiles
 * beside it carry the exact numbers.
 *
 * @param props.data - The six spokes to render.
 * @param props.caption - Sub-caption under the chart.
 * @param props.ariaLabel - Accessible description of the polygon's shape.
 * @param props.comparison - Optional polygon(s) drawn under the main one, e.g.
 *   the school average; at most two are drawn.
 * @param props.footer - Optional controls rendered under the chart.
 */
export function TeamRadarChart({
  data,
  caption,
  ariaLabel,
  comparison,
  footer,
}: {
  data: TeamRadarPoint[]
  caption: string
  ariaLabel: string
  comparison?: RadarComparison | RadarComparison[]
  footer?: ReactNode
}) {
  const comparisons = (Array.isArray(comparison) ? comparison : comparison ? [comparison] : []).slice(
    0,
    OVERLAYS.length,
  )
  const points: ChartPoint[] = data.map((point, i) => {
    const out: ChartPoint = { ...point, compareDisplays: comparisons.map((c) => c.data[i]?.display) }
    comparisons.forEach((c, j) => {
      out[OVERLAYS[j].key] = c.data[i]?.score
    })
    return out
  })
  return (
    <figure className="rounded-lg border bg-card p-2">
      <figcaption className="px-1 text-xs text-muted-foreground">{caption}</figcaption>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-[280px] w-full max-w-[340px]"
        role="img"
        aria-label={ariaLabel}
      >
        <RadarChart data={points} outerRadius="72%">
          <PolarGrid />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ChartTooltip cursor={false} content={<RadarTooltip compareLabels={comparisons.map((c) => c.label)} />} />
          {comparisons.map((c, j) => (
            <Radar
              key={OVERLAYS[j].key}
              dataKey={OVERLAYS[j].key}
              stroke={`var(--color-${OVERLAYS[j].key})`}
              strokeWidth={1.5}
              strokeDasharray={OVERLAYS[j].dash}
              fill={`var(--color-${OVERLAYS[j].key})`}
              fillOpacity={0.08}
              isAnimationActive={false}
            />
          ))}
          <Radar
            dataKey="score"
            stroke="var(--color-score)"
            strokeWidth={2}
            fill="var(--color-score)"
            fillOpacity={0.2}
            dot={{ r: 4, fillOpacity: 1 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ChartContainer>
      {comparisons.length > 0 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-primary" aria-hidden />
            This team
          </span>
          {comparisons.map((c, j) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <span className={`w-4 border-t-2 ${OVERLAYS[j].swatch}`} aria-hidden />
              {c.label}
            </span>
          ))}
        </div>
      )}
      {footer}
    </figure>
  )
}
