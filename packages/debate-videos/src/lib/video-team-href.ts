/**
 * @fileoverview The team-page address a video's team name links to, shared by
 * every place the videos UI shows a team (list rows, cards, the watch page
 * header, the player's title bar).
 *
 * A team the rankings know links by the helpers the leaderboard uses:
 * {@link teamHref} for a current-season (or past high school) row and
 * {@link pastTeamHref} for a past college season's row. A team with no
 * rankings row still has its label's school and initials (`"Harker LL"`), and
 * the team page resolves that `@school-initials` handle itself — against the
 * rankings, a past college season's table or a past high school season — so it
 * links there too. A label with no code (`"SMU"`, `"Boston College"`) names
 * only a school and has no team page, so the caller keeps its old behaviour
 * (search the library, or plain text).
 * @module lib/video-team-href
 */

import { parseTeamLabel } from "@debate-ai/rankings"
import { pastTeamHref } from "@debate-ai/rankings/src/leaderboard/profile/pastTeamHelpers"
import { profileSlug, teamHref } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"
import { isPastSeasonRanking, type VideoTeamRanking } from "../hooks/useVideoTeamRankings"

/**
 * Path of the team page for a video's aff or neg team, or `null` when the
 * label cannot be resolved to one.
 *
 * @param team - The team as the video names it, e.g. `"Harker LL"`.
 * @param ranking - The team's rankings row, when the listing found one.
 */
export function videoTeamHref(
  team: string | null | undefined,
  ranking?: VideoTeamRanking | null,
): string | null {
  if (!team?.trim()) return null
  if (ranking) return isPastSeasonRanking(ranking) ? pastTeamHref(ranking) : teamHref(ranking)
  const parsed = parseTeamLabel(team)
  if (!parsed) return null
  const handle = profileSlug(`${parsed.school} ${parsed.code}`)
  return handle ? `/@${handle}` : null
}
