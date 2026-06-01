/**
 * @fileoverview Hook that fetches leaderboard rows and historical champion data
 * for the rankings panel. Separates data-fetching concerns from presentation.
 * @module components/debate/DebateVideos/hooks/useLeaderboardData
 */

"use client"

import { useState, useEffect } from "react"
import grab from "grab-url"
import type { LeaderboardEntry } from "@/packages/debate-data-sync/rankings/sync-rankings-debatedrills"
import type { Division, DebateHistory } from "../panels/leaderboard/leaderboardTypes"

/**
 * Return value from {@link useLeaderboardData}.
 */
export interface LeaderboardDataResult {
  /** Current leaderboard rows for the active division+year. */
  data: LeaderboardEntry[]
  /** `true` while leaderboard rows are being fetched. */
  loading: boolean
  /** Error message if the last fetch failed, or `null`. */
  error: string | null
  /** Merged history data (prop or fetched). */
  debateHistory: DebateHistory | null
  /** `true` while champion history is being fetched. */
  championsLoading: boolean
}

/**
 * Fetches leaderboard rows for `division`+`year` and optionally fetches
 * historical champion data when the `history` prop is not provided.
 *
 * - Aborts in-flight requests when `division` or `year` change.
 * - NDT division has no leaderboard rows; returns empty data immediately.
 *
 * @param division - Active debate division (VPF, VLD, VCX, NDT).
 * @param year - Four-digit season year string (e.g. `"2026"`).
 * @param history - Pre-loaded history data; skips the `/history` fetch when provided.
 */
export function useLeaderboardData(
  division: Division,
  year: string,
  history?: DebateHistory | null,
): LeaderboardDataResult {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [internalDebateHistory, setInternalDebateHistory] =
    useState<DebateHistory | null>(null)
  const [championsLoading, setChampionsLoading] = useState(true)
  const debateHistory = history ?? internalDebateHistory

  /** Fetches champion/topic history when not provided via props. */
  useEffect(() => {
    if (history) {
      setChampionsLoading(false)
      return
    }
    const fetchHistory = async () => {
      const result = await grab<DebateHistory>("history", { cache: true })
      if (result && !result.error && result.data) {
        setInternalDebateHistory(result.data as DebateHistory)
      }
      setChampionsLoading(false)
    }
    fetchHistory()
  }, [history])

  /** Fetches leaderboard rows for the current division+year combination. */
  useEffect(() => {
    if (division === "NDT") {
      setData([])
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ division, year })
        const payload = await grab(`leaderboard?${params.toString()}`, {
          cache: false,
        })
        const rows = payload.data || []
        setData(Array.isArray(rows) ? rows : [])
      } catch (err) {
        if (controller.signal.aborted) return
        setError(
          err instanceof Error ? err.message : "Failed to fetch leaderboard data",
        )
        setData([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [year, division])

  return { data, loading, error, debateHistory, championsLoading }
}
