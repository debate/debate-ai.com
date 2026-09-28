/**
 * @fileoverview Loads every full-season `debate-rankings` dataset, for the team
 * and school profile pages that search across all divisions at once.
 * @module hooks/useAllRankingDatasets
 */

"use client"

import { useEffect, useState } from "react"
import { RANKING_DATASETS, loadRankingDataset, type RankingDataset } from "debate-rankings-adapter"

/**
 * Full-season datasets only: a scoped slice (LD's Sep–Oct topic) re-ranks the
 * same entries and would list every one of them twice on a profile.
 */
const PROFILE_DATASET_IDS = RANKING_DATASETS.filter((d) => !d.scope).map((d) => d.id)

/** Shared across mounts so moving between profiles never re-parses the CSVs. */
let cached: Promise<RankingDataset[]> | null = null

function loadAll(): Promise<RankingDataset[]> {
  cached ??= Promise.all(PROFILE_DATASET_IDS.map((id) => loadRankingDataset(id))).catch((err) => {
    cached = null
    throw err
  })
  return cached
}

/** Return value of {@link useAllRankingDatasets}. */
export interface AllRankingDatasets {
  datasets: RankingDataset[]
  loading: boolean
  error: string | null
}

/** Loads (once per page) every full-season rankings dataset. */
export function useAllRankingDatasets(): AllRankingDatasets {
  const [datasets, setDatasets] = useState<RankingDataset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAll()
      .then((loaded) => {
        if (!cancelled) setDatasets(loaded)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load rankings")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { datasets, loading, error }
}
