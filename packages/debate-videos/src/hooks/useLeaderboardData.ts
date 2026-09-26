/**
 * @fileoverview Hook that loads a `debate-rankings` dataset and historical
 * champion data for the rankings panel. Separates data loading from presentation.
 * @module components/debate/DebateVideos/hooks/useLeaderboardData
 */

"use client"

import { useState, useEffect } from "react"
import grab from "grab-url"
import { loadRankingDataset, type RankingDataset, type RankingDatasetId } from "debate-rankings-adapter"
import type { DebateHistory } from "../panels/leaderboard/leaderboardTypes"

/**
 * Return value from {@link useLeaderboardData}.
 */
export interface LeaderboardDataResult {
  /** The loaded dataset (rows + field statistics), or `null` while loading / on error. */
  dataset: RankingDataset | null
  /** `true` while the dataset's CSVs are being loaded. */
  loading: boolean
  /** Error message if the last load failed, or `null`. */
  error: string | null
  /** Merged history data (prop or fetched). */
  debateHistory: DebateHistory | null
  /** `true` while champion history is being fetched. */
  championsLoading: boolean
}

/**
 * Loads the `debate-rankings` dataset `datasetId` and optionally fetches
 * historical champion data when the `history` prop is not provided.
 *
 * - Pass `null` for `datasetId` to skip loading rows (e.g. a past season,
 *   which `debate-rankings` does not cover).
 * - A stale load is discarded when `datasetId` changes before it settles.
 *
 * @param datasetId - Dataset to load, or `null` for none.
 * @param history - Pre-loaded history data; skips the `/history` fetch when provided.
 */
export function useLeaderboardData(
  datasetId: RankingDatasetId | null,
  history?: DebateHistory | null,
): LeaderboardDataResult {
  const [dataset, setDataset] = useState<RankingDataset | null>(null)
  const [loading, setLoading] = useState(datasetId !== null)
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

  /** Loads the rankings CSVs for the selected dataset. */
  useEffect(() => {
    if (datasetId === null) {
      setDataset(null)
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    loadRankingDataset(datasetId)
      .then((loaded) => {
        if (!cancelled) setDataset(loaded)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setDataset(null)
        setError(err instanceof Error ? err.message : "Failed to load rankings")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [datasetId])

  return { dataset, loading, error, debateHistory, championsLoading }
}
