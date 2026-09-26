/**
 * @fileoverview Radar chart of one team's ranking profile in one division:
 * aff and neg win rates, elim aff and neg win rates, ranking and matches.
 * @module panels/leaderboard/profile/TeamRadarChart
 */

"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "../../../ui/charts/chart"
import { teamRadarData, type ProfileEntry, type TeamRadarPoint } from "./rankingProfileHelpers"

const chartConfig = {
  score: { label: "Score", color: "var(--primary)" },
} satisfies ChartConfig

/** Tooltip naming the hovered spoke and its real value (not the 0–100 score). */
function RadarTooltip({ active, payload }: { active?: boolean; payload?: { payload: TeamRadarPoint }[] }) {
  const point = active ? payload?.[0]?.payload : undefined
  if (!point) return null
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium text-foreground">{point.metric}</div>
      <div className="tabular-nums text-muted-foreground">{point.display}</div>
    </div>
  )
}

/**
 * Six-spoke radar for one team in one division. Every spoke runs 0–100 with
 * better toward the edge; see {@link teamRadarData} for the scaling. The stat
 * tiles beside it carry the exact numbers.
 *
 * @param props.item - The team's row in that division.
 */
export function TeamRadarChart({ item }: { item: ProfileEntry }) {
  const data = teamRadarData(item)
  return (
    <figure className="rounded-lg border bg-card p-2">
      <figcaption className="px-1 text-xs text-muted-foreground">
        Profile · {item.datasetLabel} (edge = best; ranking is a field percentile, matches are
        relative to the most-played entry)
      </figcaption>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square h-[280px] w-full max-w-[340px]"
        role="img"
        aria-label={`${item.entry.name} radar: ${data.map((d) => `${d.metric} ${d.display}`).join(", ")}`}
      >
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <ChartTooltip cursor={false} content={<RadarTooltip />} />
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
    </figure>
  )
}
