/**
 * @fileoverview Hook that loads this season's high school policy TOC bids
 * from `/api/toc-bids` for the policy rankings table's Bids column.
 * @module leaderboard/hooks/useTocBids
 */

"use client"

import { useState, useEffect } from "react"
import grab from "grab-url"
import type { TocBidTeam } from "@debate-ai/data-sync/src/rankings/sync-toc-bids-sheet"

/** Body of `GET /api/toc-bids`. */
interface TocBidsResponse {
  /** `"sheet"` when downloaded just now, `"snapshot"` when Google was unreachable. */
  source: "sheet" | "snapshot"
  /** ISO time of the download, or the snapshot's date. */
  fetchedAt: string
  teams: TocBidTeam[]
}

/**
 * Loads the bids sheet once `enabled` turns true and keeps it for the rest of
 * the visit. Returns `null` until it arrives, and on failure, so the table
 * simply goes without its Bids column rather than showing an error: bids are
 * supplementary to the rankings.
 *
 * @param enabled - Whether the policy table is showing.
 */
export function useTocBids(enabled: boolean): TocBidTeam[] | null {
  const [teams, setTeams] = useState<TocBidTeam[] | null>(null)

  useEffect(() => {
    if (!enabled || teams) return
    let cancelled = false
    grab<TocBidsResponse>("toc-bids", { baseURL: "/api/", cache: true, cancelOngoingIfNew: false })
      .then((result) => {
        if (cancelled || !result || result.error) return
        const body = (Array.isArray(result.teams) ? result : result.data) as TocBidsResponse | undefined
        if (Array.isArray(body?.teams)) setTeams(body.teams)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [enabled, teams])

  return teams
}
