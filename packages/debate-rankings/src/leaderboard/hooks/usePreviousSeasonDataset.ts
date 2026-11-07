/**
 * @fileoverview Hook that loads last season's rows for a rankings dataset, so
 * the table can show how far each team moved since then.
 * @module leaderboard/hooks/usePreviousSeasonDataset
 */

"use client"

import { useEffect, useState } from "react"
import { loadRankingDataset, type RankingDataset, type RankingDatasetId } from "../../index"

/**
 * Loads `datasetId` for `seasonYear` quietly: `null` while loading, when
 * skipped (`datasetId` is `null`) or when the load fails, since the change
 * column is extra and should never block the table.
 *
 * @param datasetId - Dataset to load, or `null` for none.
 * @param seasonYear - The season to load (the year it ends in).
 */
export function usePreviousSeasonDataset(
  datasetId: RankingDatasetId | null,
  seasonYear: number,
): RankingDataset | null {
  const [state, setState] = useState<{ key: string; dataset: RankingDataset } | null>(null)
  const key = `${datasetId}:${seasonYear}`

  useEffect(() => {
    if (datasetId === null) return
    let cancelled = false
    loadRankingDataset(datasetId, seasonYear)
      .then((dataset) => {
        if (!cancelled) setState({ key, dataset })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [datasetId, seasonYear, key])

  return datasetId !== null && state?.key === key ? state.dataset : null
}
