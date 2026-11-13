/**
 * @fileoverview React hook over {@link loadNdtAllTimeRanks}: the all-time NDT
 * rank lookup once it has loaded, so a tooltip can load the NDT history only
 * when it first opens.
 * @module leaderboard/profile/useNdtAllTimeRanks
 */

"use client"

import { useEffect, useState } from "react"
import { loadNdtAllTimeRanks, type ndtAllTimeRankLookup } from "./ndtAllTimeRanks"

/** The lookup {@link ndtAllTimeRankLookup} returns. */
export type NdtAllTimeRankLookup = ReturnType<typeof ndtAllTimeRankLookup>

let loaded: NdtAllTimeRankLookup | null = null

/**
 * The all-time rank lookup, or `null` while it loads, if it failed, or until
 * `enabled` is first true.
 *
 * @param enabled - Start loading (e.g. when a tooltip opens). Once loaded the
 *   lookup stays available to every caller.
 */
export function useNdtAllTimeRanks(enabled: boolean): NdtAllTimeRankLookup | null {
  const [lookup, setLookup] = useState<NdtAllTimeRankLookup | null>(loaded)
  useEffect(() => {
    if (!enabled || lookup) return
    let live = true
    loadNdtAllTimeRanks()
      .then((ready) => {
        loaded = ready
        if (live) setLookup(() => ready)
      })
      .catch(() => {
        // The tooltip simply shows no ranks.
      })
    return () => {
      live = false
    }
  }, [enabled, lookup])
  return lookup
}
