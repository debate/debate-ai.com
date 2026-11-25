/**
 * @fileoverview A very small month-to-month Elo chart for one team, from the
 * monthly snapshots (see `leaderboard/eloHistory.ts`). Renders nothing until
 * the team has a saved month, so pages look the same before the first
 * snapshot as they did without it.
 * @module leaderboard/profile/EloSparkline
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import type { RankingDatasetId } from "../../types"
import { fetchEloHistory, type EloHistoryPoint } from "../eloHistory"

/** One team a page wants a line for. */
export interface EloHistoryRequest {
  dataset: RankingDatasetId
  key: string
}

/** `dataset:key` → that team's saved months. */
export type EloHistoryLookup = Map<string, EloHistoryPoint[]>

/** The lookup key {@link useEloHistory} files a team under. */
export const eloLookupKey = (dataset: RankingDatasetId, key: string) => `${dataset}:${key}`

/**
 * Loads the saved months of every team in `requests`, one request per
 * dataset. The map is empty while loading, on failure, and before any month
 * is saved.
 */
export function useEloHistory(requests: readonly EloHistoryRequest[]): EloHistoryLookup {
  // One string per dataset (`hspf=a,b`), so the effect reruns only when the teams change.
  const signature = useMemo(() => {
    const byDataset = new Map<RankingDatasetId, Set<string>>()
    for (const { dataset, key } of requests) byDataset.set(dataset, (byDataset.get(dataset) ?? new Set()).add(key))
    return [...byDataset]
      .map(([dataset, keys]) => `${dataset}=${[...keys].sort().join(",")}`)
      .sort()
      .join("|")
  }, [requests])
  const [state, setState] = useState<{ signature: string; lookup: EloHistoryLookup } | null>(null)

  useEffect(() => {
    if (signature === "") return
    let live = true
    const groups = signature.split("|").map((group) => {
      const [dataset, keys] = group.split("=") as [RankingDatasetId, string]
      return { dataset, keys: keys.split(",") }
    })
    void Promise.all(
      groups.map(async ({ dataset, keys }) => ({ dataset, history: await fetchEloHistory(dataset, keys) })),
    ).then((results) => {
      if (!live) return
      const lookup: EloHistoryLookup = new Map()
      for (const { dataset, history } of results) {
        for (const [key, points] of Object.entries(history)) lookup.set(eloLookupKey(dataset, key), points)
      }
      setState({ signature, lookup })
    })
    return () => {
      live = false
    }
  }, [signature])

  return state?.signature === signature ? state.lookup : EMPTY
}

const EMPTY: EloHistoryLookup = new Map()

const monthLabel = (month: string) => {
  const [year, m] = month.split("-").map(Number)
  return new Date(Date.UTC(year!, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** A short summary of the line, for the tooltip and screen readers. */
export function eloSparklineLabel(points: readonly EloHistoryPoint[]): string {
  const first = points[0]!
  const last = points[points.length - 1]!
  if (points.length === 1) return `Rating ${last.rating.toFixed(1)} (#${last.rank}) in ${monthLabel(last.month)}`
  const change = last.rating - first.rating
  const sign = change > 0 ? "+" : change < 0 ? "−" : "±"
  return (
    `Rating ${first.rating.toFixed(1)} (#${first.rank}) in ${monthLabel(first.month)} to ` +
    `${last.rating.toFixed(1)} (#${last.rank}) in ${monthLabel(last.month)}, ${sign}${Math.abs(change).toFixed(1)} ` +
    `over ${points.length} months`
  )
}

/**
 * The chart: a tiny line of the team's monthly rating, ending in a dot,
 * green when it rose overall and red when it fell. `null` without points.
 */
export function EloSparkline({
  points,
  width = 64,
  height = 18,
  className = "",
}: {
  points: readonly EloHistoryPoint[] | undefined
  width?: number
  height?: number
  className?: string
}) {
  if (!points || points.length === 0) return null
  const label = eloSparklineLabel(points)
  const ratings = points.map((point) => point.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const pad = 2
  const x = (i: number) => (points.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (points.length - 1))
  const y = (rating: number) => (max === min ? height / 2 : pad + ((max - rating) * (height - 2 * pad)) / (max - min))
  const path = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(point.rating).toFixed(1)}`).join(" ")
  const change = ratings[ratings.length - 1]! - ratings[0]!
  const tone = change > 0 ? "text-emerald-600 dark:text-emerald-400" : change < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
  const last = points.length - 1
  return (
    <svg
      role="img"
      aria-label={`Monthly rating: ${label}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block shrink-0 align-middle ${tone} ${className}`}
      data-testid="elo-sparkline"
    >
      <title>{label}</title>
      {points.length > 1 && (
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      <circle cx={x(last)} cy={y(ratings[last]!)} r={2} fill="currentColor" />
    </svg>
  )
}
