/**
 * @fileoverview Pure helpers behind the profile of a past-season high school
 * team: an entry a school page lists under "Best ranked entries by season"
 * (any season since 2015-16) that is not in the current rankings, so it has
 * no ranked-team page of its own.
 *
 * Such a team links by the same `@handle` a ranked team gets — the school as
 * the rankings spell it plus the debaters' last names
 * (`/@st-mark-s-school-of-texas-smith-jones`, see `teamHandle`). The handle
 * holds no separator between school and names, so the school is found by
 * dropping trailing words ({@link pastHighSchoolSchoolKeys}) and looking each
 * candidate up in the school-seasons table.
 * @module leaderboard/profile/pastHighSchoolTeam
 */

import { entryLastNames, type SchoolSeason, type SchoolSeasonEvent } from "../../index"
import type { NationalsRow } from "./nationalsHistory"
import { profileSlug } from "./rankingProfileHelpers"

/** Most trailing words a handle's names can take: two debaters, each possibly hyphenated. */
const MAX_NAME_WORDS = 4

/**
 * The school keys (`schoolSeasonKey`) an `@handle` may start with, most
 * likely first: two name words (a pair), then one (an LD debater), then the
 * longer hyphenated-surname shapes. A one-word handle (a school's) has none.
 */
export function pastHighSchoolSchoolKeys(slug: string): string[] {
  let decoded = slug ?? ""
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // A malformed escape is used as-is.
  }
  const words = profileSlug(decoded).split("-").filter(Boolean)
  const keys: string[] = []
  for (const drop of [2, 1, 3, MAX_NAME_WORDS]) {
    if (words.length - drop < 1) continue
    keys.push(words.slice(0, words.length - drop).join("-"))
  }
  return keys
}

/** One season a past high school team was among its school's best entries. */
export interface PastHighSchoolTeamSeason {
  year: number
  event: SchoolSeasonEvent
  /** 1-based rank among every entry rated that season. */
  rank: number
  fieldSize: number
  bids: number
  /** The team's name as that season spelled it. */
  name: string
}

/** What the school-seasons table holds about one past high school team. */
export interface PastHighSchoolTeam {
  /** `schoolSeasonKey` of the team's school. */
  schoolKey: string
  /** The debaters, as the most recent season spells them. */
  name: string
  /** Every listed season, newest first (empty for a team known only from nationals). */
  seasons: PastHighSchoolTeamSeason[]
  /** The team's TOC, NDCA, Barkley, Cal and Glenbrooks finishes, newest first. */
  nationals?: NationalsRow[]
}

/** The handle a school-seasons team gets: school key plus last names, as `teamHandle` builds it. */
export function pastHighSchoolTeamHandle(schoolKey: string, name: string): string {
  return profileSlug(`${schoolKey} ${entryLastNames(name).join(" ")}`)
}

/**
 * The team `slug` names among one school's listed seasons, or `null`.
 *
 * @param seasons - The school's seasons, from `fetchSchoolSeasons`.
 * @param schoolKey - The school's key, one of {@link pastHighSchoolSchoolKeys}.
 * @param slug - The `@handle`, without its `@`.
 */
export function findPastHighSchoolTeam(
  seasons: readonly SchoolSeason[],
  schoolKey: string,
  slug: string,
): PastHighSchoolTeam | null {
  let decoded = slug ?? ""
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // A malformed escape is used as-is.
  }
  const target = profileSlug(decoded)
  const found: PastHighSchoolTeamSeason[] = []
  for (const season of seasons) {
    for (const team of season.teams) {
      if (pastHighSchoolTeamHandle(schoolKey, team.name) !== target) continue
      found.push({
        year: season.year,
        event: season.event,
        rank: team.rank,
        fieldSize: team.fieldSize,
        bids: team.bids,
        name: team.name,
      })
    }
  }
  if (found.length === 0) return null
  found.sort((a, b) => b.year - a.year || a.event.localeCompare(b.event))
  return { schoolKey, name: found[0].name, seasons: found }
}
