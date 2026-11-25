"use client"

/**
 * @fileoverview The team stats hover card `/tournament` hands to
 * `<TournamentsApp TeamHoverCard>`: the site's shared {@link TeamHoverCard}
 * from `@debate-ai/rankings`, fed the entry's code and, once matched, the
 * rankings row behind its rating ({@link teamRatingRow}).
 */

import type { TeamHoverCardComponent } from "@debate-ai/tournaments/ui"
import { TeamHoverCard } from "@debate-ai/rankings/src/leaderboard/team-label/TeamLabel"
import { teamHref } from "@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers"
import { pastTeamHref } from "@debate-ai/rankings/src/leaderboard/profile/pastTeamHelpers"
import { teamRatingRow } from "./enrichment"

/** An entry's hover card; see the module overview. */
export const EntryHoverCard: TeamHoverCardComponent = ({ query, team, side, children }) => {
  const ranking = teamRatingRow(team)
  const href = ranking ? (typeof ranking.season === "number" ? pastTeamHref(ranking) : teamHref(ranking)) : undefined
  return (
    <TeamHoverCard
      query={{
        label: query.code,
        school: team?.school ?? query.school,
        debaters: team?.names ?? null,
        ranking,
        year: query.season ?? null,
      }}
      side={side}
      href={href}
    >
      {children}
    </TeamHoverCard>
  )
}
