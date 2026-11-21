/**
 * @fileoverview Hook that loads the saved 90-day rank baseline for one list
 * (see `leaderboard/rankBaseline.ts`).
 * @module leaderboard/hooks/useRankBaseline
 */

"use client"

import { useEffect, useState } from "react"
import { fetchRankBaseline, type RankBaseline, type RankBaselineScope } from "../rankBaseline"

/**
 * `undefined` while loading, `null` when skipped or there is no usable
 * baseline, else the saved list.
 *
 * @param scope - The list, or `null` to skip (past seasons).
 */
export function useRankBaseline(scope: RankBaselineScope | null): RankBaseline | null | undefined {
  const [state, setState] = useState<{ scope: RankBaselineScope; baseline: RankBaseline | null } | null>(null)
  useEffect(() => {
    if (scope === null) return
    let live = true
    void fetchRankBaseline(scope).then((baseline) => {
      if (live) setState({ scope, baseline })
    })
    return () => {
      live = false
    }
  }, [scope])
  if (scope === null) return null
  return state?.scope === scope ? state.baseline : undefined
}
