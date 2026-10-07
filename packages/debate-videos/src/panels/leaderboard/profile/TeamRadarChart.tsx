/**
 * @fileoverview Radar chart rendering for ranking profiles. A single reusable
 * chart takes the six spokes of data directly, so the team profile page passes
 * one team's {@link teamRadarData}, and the school profile page passes the
 * averaged {@link schoolDivisionRadarData} for each division. A team can also
 * overlay its school's average as a second, dashed polygon.
 * @module panels/leaderboard/profile/TeamRadarChart
 */

"use client"

import type { ReactNode } from "react"
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../ui/charts/chart"
import { type TeamRadarPoint } from "./rankingProfileHelpers"

const chartConfig = {
  score: { label: "Score", color: "var(--primary)" },
  compareScore: { label: "Comparison", color: "var(--muted-foreground)" },
} satisfies ChartConfig

/** One spoke, with the comparison series' value when one is overlaid. */
type ChartPoint = TeamRadarPoint & { compareScore?: number; compareDisplay?: string }

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
  compareLabel,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  compareLabel?: string
}) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">{point.metric}</div>
      <div className="tabular-nums text-muted-foreground">{point.display}</div>
      {compareLabel && point.compareDisplay !== undefined && (
        <div className="tabular-nums text-muted-foreground">
          {compareLabel}: {point.compareDisplay}
        </div>
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
 * @param props.comparison - Optional second polygon, e.g. the school average.
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
  comparison?: RadarComparison
  footer?: ReactNode
}) {
  const points: ChartPoint[] = comparison
    ? data.map((point, i) => ({
        ...point,
        compareScore: comparison.data[i]?.score,
        compareDisplay: comparison.data[i]?.display,
      }))
    : data
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
          <ChartTooltip cursor={false} content={<RadarTooltip compareLabel={comparison?.label} />} />
          {comparison && (
            <Radar
              dataKey="compareScore"
              stroke="var(--color-compareScore)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="var(--color-compareScore)"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
          )}
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
      {comparison && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-primary" aria-hidden />
            This team
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden />
            {comparison.label}
          </span>
        </div>
      )}
      {footer}
    </figure>
  )
}
