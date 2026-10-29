/**
 * @fileoverview Which rankings can speak for a round video's teams, and — for
 * the server, which renders a watch page's title before any client hook has
 * run — each team's rank in them.
 *
 * `debate-rankings-sync-data` covers the current season only, so a round from the
 * current season is looked up there; a college policy round from a past
 * season is looked up in that season's debatedata table instead (2009-10
 * onward, see `college-history.ts` in `@debate-ai/rankings`). Any other
 * round's team codes name people the rankings do not know.
 *
 * Kept free of React so a server component can import it; the client lookup
 * is `useVideoTeamRankings`.
 * @module lib/video-team-ranks
 */

import {
  collegeSeasonYearOf,
  findCollegeHistoryTeam,
  hasCollegeHistory,
  loadCollegeHistory,
  loadRankingDataset,
} from "@debate-ai/rankings"
import { currentSeasonYear } from "@debate-ai/rankings/src/leaderboard/leaderboardUtils"
import {
  findVideoTeamRanking,
  videoStyleDatasetId,
} from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"
import type { VideoType } from "../types/videos"
import type { VideoPageTitleRanks } from "./video-page-title"

/**
 * Whether the rankings can say anything about `video`'s teams: a round of a
 * ranked style from the season `debate-rankings-sync-data` covers.
 *
 * @param video - Video tuple.
 * @param now - Date to evaluate the current season at.
 */
export function isRankedSeasonRound(video: VideoType, now: Date = new Date()): boolean {
  return video[17] === currentSeasonYear(now) && videoStyleDatasetId(video[6]) !== null
}

/**
 * The past season whose college table `video`'s teams are looked up in: a
 * college policy round from before the current season, back to 2009-10.
 * `null` for any other video. The season is the video's `seasonYear`, or
 * its publish date's season when the tuple has none.
 *
 * @param video - Video tuple.
 * @param now - Date to evaluate the current season at.
 */
export function pastCollegeSeason(video: VideoType, now: Date = new Date()): number | null {
  if (videoStyleDatasetId(video[6]) !== "cpd") return null
  const season = typeof video[17] === "number" && video[17] > 0 ? video[17] : collegeSeasonYearOf(video[2])
  return season && season !== currentSeasonYear(now) && hasCollegeHistory(season) ? season : null
}

/**
 * Each team's rank, from the same rankings the watch page's team badges read.
 * A team the rankings do not know, or a round no rankings cover, has none;
 * a table that fails to load leaves both unranked rather than failing the page.
 *
 * @param video - Video tuple.
 * @param now - Date to evaluate the current season at.
 */
export async function loadVideoTeamRanks(
  video: VideoType,
  now: Date = new Date(),
): Promise<VideoPageTitleRanks> {
  const affTeam = video[9]
  const negTeam = video[10]
  if (!affTeam?.trim() && !negTeam?.trim()) return {}

  try {
    const season = pastCollegeSeason(video, now)
    if (season !== null) {
      const entries = await loadCollegeHistory(season)
      const rankOf = (team: string | null | undefined) =>
        team?.trim() ? (findCollegeHistoryTeam(entries, team)?.rank ?? null) : null
      return { aff: rankOf(affTeam), neg: rankOf(negTeam) }
    }

    const id = videoStyleDatasetId(video[6])
    if (!id || !isRankedSeasonRound(video, now)) return {}
    const datasets = [await loadRankingDataset(id)]
    return {
      aff: findVideoTeamRanking(datasets, video[6], affTeam)?.rank ?? null,
      neg: findVideoTeamRanking(datasets, video[6], negTeam)?.rank ?? null,
    }
  } catch {
    return {}
  }
}
