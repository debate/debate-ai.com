/**
 * @fileoverview Hook that gives the Schools tab its precomputed table: the
 * browser's stored copy at once, then the server's when the copy is stale.
 * @module leaderboard/hooks/useSchoolRankingsSnapshot
 */

"use client"

import { useEffect, useState } from "react"
import { currentRankingSeasonYear } from "../../index"
import { isStale, readStoredSchoolRankings, refreshSchoolRankings } from "../schoolRankingsCache"
import type { SchoolRankingsSnapshot } from "../schoolRankingsSnapshot"

/** Return value from {@link useSchoolRankingsSnapshot}. */
export interface SchoolRankingsSnapshotResult {
  /** The season's snapshot, or `null` until one is available. */
  snapshot: SchoolRankingsSnapshot | null
  /** `true` while there is nothing to show yet. */
  loading: boolean
  /** Error message when no snapshot could be loaded, or `null`. */
  error: string | null
}

/** Snapshots already shown this visit, by season, so switching tabs never reloads. */
const memory = new Map<number, SchoolRankingsSnapshot>()

/** Clears the in-memory copies (for tests). */
export function clearSchoolRankingsMemory(): void {
  memory.clear()
}

/**
 * Loads `seasonYear`'s school rankings once `enabled` turns true: from memory,
 * else the IndexedDB copy, else `/api/school-rankings` (else computed here).
 * A stored copy older than a day is shown immediately and refreshed behind it.
 *
 * @param enabled - Whether the Schools table is showing.
 * @param seasonYear - A past season (the year it ends in); omit for the current season.
 */
export function useSchoolRankingsSnapshot(enabled: boolean, seasonYear?: number): SchoolRankingsSnapshotResult {
  const year = seasonYear ?? currentRankingSeasonYear()
  const [state, setState] = useState<{ year: number; snapshot: SchoolRankingsSnapshot | null; error: string | null }>(
    () => ({ year, snapshot: memory.get(year) ?? null, error: null }),
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const show = (snapshot: SchoolRankingsSnapshot) => {
      memory.set(year, snapshot)
      if (!cancelled) setState({ year, snapshot, error: null })
    }
    const inMemory = memory.get(year)
    if (inMemory) {
      setState({ year, snapshot: inMemory, error: null })
      return
    }
    setState({ year, snapshot: null, error: null })
    ;(async () => {
      const stored = await readStoredSchoolRankings(year)
      if (stored) {
        show(stored.snapshot)
        if (!isStale(year, stored.checkedAt)) return
      }
      try {
        show(await refreshSchoolRankings(year, stored?.snapshot))
      } catch (error) {
        if (!cancelled && !stored) {
          setState({ year, snapshot: null, error: error instanceof Error ? error.message : "Failed to load rankings" })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, year])

  const current = state.year === year ? state : { snapshot: memory.get(year) ?? null, error: null }
  return {
    snapshot: current.snapshot,
    loading: enabled && !current.snapshot && !current.error,
    error: current.error,
  }
}
