/**
 * @fileoverview React hook over {@link loadNdtAllTimeRanks}: the all-time NDT
 * rank lookup once it has loaded, so a tooltip can load the NDT history only
 * when it first opens.
 * @module leaderboard/profile/useNdtAllTimeRanks
 */

"use client"

import { useEffect, useState } from "react"
import {
  loadNdtAllTimeRankMaps,
  loadNdtAllTimeRanks,
  type NdtAllTimeRank,
  type ndtAllTimeRankLookup,
} from "./ndtAllTimeRanks"

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

type RankMaps = Awaited<ReturnType<typeof loadNdtAllTimeRankMaps>>

let loadedMaps: RankMaps | null = null

function useRankMaps(enabled: boolean): RankMaps | null {
  const [maps, setMaps] = useState<RankMaps | null>(loadedMaps)
  useEffect(() => {
    if (!enabled || maps) return
    let live = true
    loadNdtAllTimeRankMaps()
      .then((ready) => {
        loadedMaps = ready
        if (live) setMaps(ready)
      })
      .catch(() => {
        // The page simply shows no all-time rank.
      })
    return () => {
      live = false
    }
  }, [enabled, maps])
  return maps
}

/**
 * A school's all-time rank among schools by all-seasons NDT points, or `null`
 * while it loads or when the school has no NDT points.
 *
 * @param school - NDT school name (`"Harvard University (MA)"`); `null` skips loading.
 */
export function useNdtSchoolAllTimeRank(school: string | null): NdtAllTimeRank | null {
  const maps = useRankMaps(!!school)
  return (school && maps?.schools.get(school)) || null
}

/**
 * A past college team's all-time rank among NDT partnerships, by its page slug.
 *
 * @param slug - The team's `@handle` without `@`; `null` skips loading.
 */
export function useNdtTeamAllTimeRank(slug: string | null): (NdtAllTimeRank & { mode: "teams" | "strict" }) | null {
  const maps = useRankMaps(!!slug)
  return (slug && maps?.teams.get(slug)) || null
}
