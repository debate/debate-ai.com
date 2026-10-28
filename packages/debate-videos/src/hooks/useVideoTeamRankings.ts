/**
 * @fileoverview Looks up the rankings row behind a round's aff or neg team,
 * for the Aff and Neg cells of the list layout: a team found in the rankings
 * links to its `@<handle>` profile and shows its rating.
 *
 * `debate-rankings` covers the current season only, so a round from the
 * current season is looked up there — a team code from a past season names
 * different people, and its rating would be someone else's. A college policy
 * round from a past season is looked up instead in that season's own
 * debatedata table (2009-10 onward, see `college-history.ts` in
 * `@debate-ai/rankings-adapter`), which gives the team's rank that season and
 * its debaters' last names; such a row carries its `season` and links to
 * the team's past-season profile (`pastTeamHref`) instead.
 * @module hooks/useVideoTeamRankings
 */

"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  findCollegeHistoryTeam,
  loadCollegeHistory,
  type CollegeHistoryEntry,
  type RankingEntry,
} from "@debate-ai/rankings-adapter"
import { useAllRankingDatasets } from "./useAllRankingDatasets"
import { findVideoTeamRanking } from "../panels/leaderboard/profile/rankingProfileHelpers"
import { isRankedSeasonRound, pastCollegeSeason } from "../lib/video-team-ranks"
import type { VideoType } from "../types/videos"

// Kept importable from here, where they lived before the server needed them.
export { isRankedSeasonRound, pastCollegeSeason }

/** A past college season's table row for a team, tagged with that season. */
export interface PastSeasonTeamRanking extends CollegeHistoryEntry {
  /** Season year the row is from (the year the season ends in). */
  season: number
}

/** A team's current-season rankings row, or its row in a past college season's table. */
export type VideoTeamRanking = RankingEntry | PastSeasonTeamRanking

/** True for a row from a past season's table, whose team has a past-season profile rather than a rankings one. */
export function isPastSeasonRanking(ranking: VideoTeamRanking | null | undefined): ranking is PastSeasonTeamRanking {
  return ranking != null && "season" in ranking
}

/** The rankings row for one of a video's team labels, or `null`. */
export type VideoTeamRankingLookup = (
  video: VideoType,
  team: string | null | undefined,
) => VideoTeamRanking | null

/**
 * The lookup a video grid shares with its cards, so each card's team badges
 * can print the debaters' last names without every card loading and
 * scanning the rankings itself. `null` outside a grid.
 */
export const VideoTeamRankingContext = createContext<VideoTeamRankingLookup | null>(null)

/** The rankings row for `team` from the nearest grid's lookup, or `null`. */
export function useContextTeamRanking(video: VideoType | undefined, team: string | null | undefined): VideoTeamRanking | null {
  const lookup = useContext(VideoTeamRankingContext)
  return lookup && video ? lookup(video, team) : null
}

/**
 * A lookup from a video's team label to its rankings row. The datasets load
 * only once `videos` holds a current-season round, and a past season's
 * college table only once `videos` holds a college round from that season,
 * so a listing of lectures never fetches the CSVs.
 *
 * @param videos - The videos the listing shows.
 * @param enabled - `false` (e.g. a lecture listing) skips the lookup entirely.
 */
export function useVideoTeamRankings(
  videos: readonly VideoType[],
  enabled = true,
): VideoTeamRankingLookup {
  const needed = useMemo(
    () => enabled && videos.some((video) => isRankedSeasonRound(video)),
    [videos, enabled],
  )
  const { datasets } = useAllRankingDatasets(needed)

  // Past college seasons the listing has rounds from, as a stable key.
  const seasonsKey = useMemo(
    () =>
      enabled
        ? [...new Set(videos.map((video) => pastCollegeSeason(video)).filter((y): y is number => y !== null))]
            .sort()
            .join(",")
        : "",
    [videos, enabled],
  )
  const [history, setHistory] = useState<ReadonlyMap<number, CollegeHistoryEntry[]>>(() => new Map())
  useEffect(() => {
    if (!seasonsKey) return
    let cancelled = false
    for (const season of seasonsKey.split(",").map(Number)) {
      if (history.has(season)) continue
      loadCollegeHistory(season)
        .then((entries) => {
          if (!cancelled) setHistory((prev) => new Map(prev).set(season, entries))
        })
        // A table that fails to load leaves that season's teams as their codes.
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
    // `history` is read only to skip seasons already loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonsKey])

  // A listing asks for the same label once per render of each row; the match
  // scans a whole dataset, so each style + label is resolved once.
  const cache = useMemo(() => new Map<string, RankingEntry | null>(), [datasets])
  const historyCache = useMemo(() => new Map<string, PastSeasonTeamRanking | null>(), [history])

  return useCallback<VideoTeamRankingLookup>(
    (video, team) => {
      if (!team?.trim()) return null
      const season = pastCollegeSeason(video)
      if (season !== null) {
        const entries = history.get(season)
        if (!entries) return null
        const key = `${season}|${team}`
        let row = historyCache.get(key)
        if (row === undefined) {
          const entry = findCollegeHistoryTeam(entries, team)
          row = entry ? { ...entry, season } : null
          historyCache.set(key, row)
        }
        return row
      }
      if (datasets.length === 0 || !isRankedSeasonRound(video)) return null
      const key = `${video[6]}|${team}`
      let entry = cache.get(key)
      if (entry === undefined) {
        entry = findVideoTeamRanking(datasets, video[6], team)
        cache.set(key, entry)
      }
      return entry
    },
    [datasets, cache, history, historyCache],
  )
}
