/**
 * @fileoverview Hook that loads every division's full-season `debate-rankings`
 * dataset for the Schools table on the rankings page.
 * @module components/debate/DebateVideos/hooks/useSchoolRankingsData
 */

"use client"

import { useState, useEffect } from "react"
import { loadRankingDataset, type RankingDataset } from "debate-rankings-adapter"
import { SCHOOL_DATASETS } from "../panels/leaderboard/leaderboardUtils"
import type { Division } from "../panels/leaderboard/leaderboardTypes"

/** Return value from {@link useSchoolRankingsData}. */
export interface SchoolRankingsDataResult {
  /** Loaded dataset per division; a division whose load failed is absent. */
  datasets: Partial<Record<Division, RankingDataset>>
  /** `true` while the datasets are being loaded. */
  loading: boolean
  /** Error message when no dataset could be loaded, or `null`. */
  error: string | null
}

/**
 * Loads each division's full-season dataset in parallel once `enabled` turns
 * true, and keeps them for later visits to the Schools tab. A division that
 * fails to load is left out; the hook reports an error only when all fail.
 *
 * @param enabled - Whether the Schools table is showing.
 */
export function useSchoolRankingsData(enabled: boolean): SchoolRankingsDataResult {
  const [datasets, setDatasets] = useState<Partial<Record<Division, RankingDataset>>>({})
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || loaded) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.allSettled(SCHOOL_DATASETS.map(({ datasetId }) => loadRankingDataset(datasetId)))
      .then((results) => {
        if (cancelled) return
        const next: Partial<Record<Division, RankingDataset>> = {}
        results.forEach((result, i) => {
          if (result.status === "fulfilled") next[SCHOOL_DATASETS[i].division] = result.value
        })
        setDatasets(next)
        setLoaded(true)
        if (Object.keys(next).length === 0) {
          const first = results.find((r) => r.status === "rejected")
          const reason = first?.status === "rejected" ? first.reason : null
          setError(reason instanceof Error ? reason.message : "Failed to load rankings")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, loaded])

  return { datasets, loading: enabled && (loading || !loaded), error }
}
