/**
 * @fileoverview Monthly Elo snapshots: every team's rating and rank, saved
 * once per calendar month and kept for good, so a team page can chart how a
 * team moved month to month.
 *
 * The server's daily rankings cron saves the snapshot on its first run of a
 * new month (`elo_monthly_snapshots` in D1, see the app's
 * `lib/rankings/elo-snapshot-store.ts`). A month already saved is never
 * written again. The browser asks for the history of just the teams on the
 * page, and the sparkline shows nothing until a team has at least one saved
 * month.
 * @module leaderboard/eloHistory
 */

import type { RankingDatasetId, RankingEntry } from "../types"
import { teamSlug } from "./profile/rankingProfileHelpers"

/** Where the browser reads team histories. */
export const ELO_HISTORY_PATH = "/api/rankings/elo-history"

/** Most teams one history request may ask for. */
export const ELO_HISTORY_MAX_TEAMS = 100

/** Every dataset that gets a monthly snapshot. */
export const ELO_HISTORY_DATASETS: readonly RankingDatasetId[] = ["hspf", "hsld", "hsld_sepoct", "hscx", "cpd"]

/** Whether a string names a dataset with monthly snapshots. */
export function isEloHistoryDataset(value: string): value is RankingDatasetId {
  return (ELO_HISTORY_DATASETS as readonly string[]).includes(value)
}

/** The `YYYY-MM` (UTC) month a snapshot taken at `unixSeconds` belongs to. */
export function eloSnapshotMonth(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 7)
}

/**
 * The key a team is saved under: its school-plus-names slug. Unlike
 * `entry.hash`, it does not change with the season, so a team's line keeps
 * going across the August rollover.
 */
export function eloTeamKey(entry: Pick<RankingEntry, "school" | "name">): string {
  return teamSlug(entry)
}

/** One team in a saved month: `[site-scale rating, rank]`. */
export type EloSnapshotPoint = [rating: number, rank: number]

/** One dataset's saved month, as stored: team key → point. */
export type EloSnapshotTeams = Record<string, EloSnapshotPoint>

/**
 * Builds a dataset's snapshot from its ranked entries. Ratings are kept to
 * two decimals (the site shows one) to keep the row small; a team listed
 * twice keeps its better rank.
 */
export function buildEloSnapshot(entries: readonly RankingEntry[]): EloSnapshotTeams {
  const teams: EloSnapshotTeams = {}
  for (const entry of entries) {
    if (!entry.school || !entry.name || !Number.isFinite(entry.adjustedRating) || !Number.isFinite(entry.rank)) continue
    const key = eloTeamKey(entry)
    const existing = teams[key]
    if (existing && existing[1] <= entry.rank) continue
    teams[key] = [Math.round(entry.adjustedRating * 100) / 100, entry.rank]
  }
  return teams
}

/** One month on a team's line. */
export interface EloHistoryPoint {
  /** `YYYY-MM`. */
  month: string
  rating: number
  rank: number
}

/** Team key → its saved months, oldest first. Teams with no saved month are left out. */
export type EloHistory = Record<string, EloHistoryPoint[]>

/**
 * Picks `keys` out of saved months (`months` oldest first), giving each team
 * the months it was ranked in.
 */
export function eloHistoryFor(
  months: readonly { month: string; teams: EloSnapshotTeams }[],
  keys: readonly string[],
): EloHistory {
  const history: EloHistory = {}
  for (const key of keys) {
    const points: EloHistoryPoint[] = []
    for (const { month, teams } of months) {
      const point = teams[key]
      if (point) points.push({ month, rating: point[0], rank: point[1] })
    }
    if (points.length > 0) history[key] = points
  }
  return history
}

const cache = new Map<string, Promise<EloHistory>>()

/**
 * The saved months of `keys` in `dataset`, or `{}` when the request fails
 * (the chart is extra, so a failure just hides it). One request per dataset
 * and key list per page load.
 */
export function fetchEloHistory(dataset: RankingDatasetId, keys: readonly string[]): Promise<EloHistory> {
  const teams = [...new Set(keys)].sort().slice(0, ELO_HISTORY_MAX_TEAMS)
  if (teams.length === 0) return Promise.resolve({})
  const url = `${ELO_HISTORY_PATH}?dataset=${encodeURIComponent(dataset)}&teams=${encodeURIComponent(teams.join(","))}`
  let pending = cache.get(url)
  if (!pending) {
    pending = fetch(url)
      .then(async (res) => {
        if (!res.ok) return {}
        const body = (await res.json()) as { teams?: EloHistory } | null
        return body && body.teams && typeof body.teams === "object" ? body.teams : {}
      })
      .catch(() => ({}))
    cache.set(url, pending)
  }
  return pending
}

/** Drops cached histories (tests). */
export function clearEloHistoryCache(): void {
  cache.clear()
}
