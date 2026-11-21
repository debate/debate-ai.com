/**
 * @fileoverview The saved ranking positions the +/− (places moved) column
 * compares against. Every 90 days the server saves each rankings list's
 * positions (`rank_baselines` in D1, see the app's
 * `lib/rankings/rank-baseline-store.ts`); the column then shows how far a
 * team or school moved since that save. Until a list has a save at least a
 * day old, the column falls back to last season's list.
 * @module leaderboard/rankBaseline
 */

import type { RankingDatasetId } from "../types"
import type { Division } from "./leaderboardTypes"

/** Days between saved baselines. */
export const RANK_BASELINE_DAYS = 90

/** A baseline is used once it is at least this old, so a fresh save never reads as "0" for everyone. */
export const RANK_BASELINE_MIN_AGE_SECONDS = 24 * 60 * 60

/** Where the browser reads a baseline. */
export const RANK_BASELINE_PATH = "/api/rankings/rank-baseline"

/** One saved list: a team dataset (`team:hspf`) or a Schools-tab division (`school:VCX`). */
export type RankBaselineScope = `team:${RankingDatasetId}` | `school:${Division}`

/** One row of a saved list. Teams carry their names, so re-paired debaters still match. */
export interface RankBaselineRow {
  rank: number
  school: string
  name?: string
}

/** A saved list, as the route serves it. */
export interface RankBaseline {
  scope: RankBaselineScope
  /** Unix seconds of the save. */
  capturedAt: number
  rows: RankBaselineRow[]
}

/** Whether a string names a baseline scope. */
export function isRankBaselineScope(value: string): value is RankBaselineScope {
  return /^(team:(hspf|hsld|hsld_sepoct|hscx|cpd)|school:[A-Za-z]+)$/.test(value)
}

/** Whether the newest save is due for replacing (none yet, or 90 days old). */
export function rankBaselineDue(capturedAt: number | null, nowSeconds: number): boolean {
  return capturedAt === null || nowSeconds - capturedAt >= RANK_BASELINE_DAYS * 24 * 60 * 60
}

/** Text for the column header's tooltip when a saved baseline is in use. */
export function rankBaselineTooltip(capturedAt: number, team: boolean): string {
  const date = new Date(capturedAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  return (
    `Places moved since the rankings saved on ${date} (saved every ${RANK_BASELINE_DAYS} days): +8 moved up eight places, -4 dropped four.` +
    (team
      ? " A team with a new partner is compared with the average of its debaters' best saved ranks (matched by last name and school). \"new\" means neither debater was ranked then."
      : " \"new\" was not ranked then.")
  )
}

const cache = new Map<RankBaselineScope, Promise<RankBaseline | null>>()

/**
 * The saved baseline for `scope`, or `null` when none is old enough yet (or
 * the request fails: the column is extra and falls back to last season).
 * One request per scope per page load.
 */
export function fetchRankBaseline(scope: RankBaselineScope): Promise<RankBaseline | null> {
  let pending = cache.get(scope)
  if (!pending) {
    pending = fetch(`${RANK_BASELINE_PATH}?scope=${encodeURIComponent(scope)}`)
      .then(async (res) => {
        if (!res.ok) return null
        const body = (await res.json()) as Partial<RankBaseline> | null
        return body && Array.isArray(body.rows) && typeof body.capturedAt === "number" ? (body as RankBaseline) : null
      })
      .catch(() => null)
    cache.set(scope, pending)
  }
  return pending
}
