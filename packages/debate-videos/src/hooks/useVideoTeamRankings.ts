/**
 * @fileoverview Looks up the rankings row behind a round's aff or neg team,
 * for the Aff and Neg cells of the list layout: a team found in the rankings
 * links to its `@<handle>` profile and shows its rating.
 *
 * `debate-rankings` covers the current season only, so only a round from the
 * current season is looked up — a team code from a past season names
 * different people, and its rating would be someone else's.
 * @module hooks/useVideoTeamRankings
 */

"use client"

import { useCallback, useMemo } from "react"
import type { RankingEntry } from "@debate/rankings-adapter"
import { useAllRankingDatasets } from "./useAllRankingDatasets"
import { currentSeasonYear } from "../panels/leaderboard/leaderboardUtils"
import {
  findVideoTeamRanking,
  videoStyleDatasetId,
} from "../panels/leaderboard/profile/rankingProfileHelpers"
import type { VideoType } from "../types/videos"

/** The rankings row for one of a video's team labels, or `null`. */
export type VideoTeamRankingLookup = (
  video: VideoType,
  team: string | null | undefined,
) => RankingEntry | null

/**
 * Whether the rankings can say anything about `video`'s teams: a round of a
 * ranked style from the season `debate-rankings` covers.
 *
 * @param video - Video tuple.
 * @param now - Date to evaluate the current season at.
 */
export function isRankedSeasonRound(video: VideoType, now: Date = new Date()): boolean {
  return video[17] === currentSeasonYear(now) && videoStyleDatasetId(video[6]) !== null
}

/**
 * A lookup from a video's team label to its rankings row. The datasets load
 * only once `videos` holds a current-season round, so a listing of past
 * seasons or lectures never fetches the CSVs.
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

  // A listing asks for the same label once per render of each row; the match
  // scans a whole dataset, so each style + label is resolved once.
  const cache = useMemo(() => new Map<string, RankingEntry | null>(), [datasets])

  return useCallback<VideoTeamRankingLookup>(
    (video, team) => {
      if (!team?.trim() || datasets.length === 0 || !isRankedSeasonRound(video)) return null
      const key = `${video[6]}|${team}`
      let entry = cache.get(key)
      if (entry === undefined) {
        entry = findVideoTeamRanking(datasets, video[6], team)
        cache.set(key, entry)
      }
      return entry
    },
    [datasets, cache],
  )
}
