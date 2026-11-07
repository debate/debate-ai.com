/**
 * @fileoverview A round team's results in past seasons, for the watch page's
 * team cards: the last {@link TEAM_HISTORY_SEASONS} seasons the sources hold
 * for the same debaters, newest first.
 *
 * - College policy: debatedata's top-100 table for each season (2009-10 on,
 *   see `college-history.ts` in `@debate-ai/rankings`), matched the way a
 *   past team's profile is (`findPastTeamProfile`: school plus the debaters'
 *   last names, or plus their initials when they are the same people).
 * - High school (Policy, LD, PF): each school's best two entries per event
 *   and season from the Elo ratings (2015-16 on, `fetchSchoolSeasons`), so a
 *   team shows only the seasons it was one of its school's top two.
 *
 * A round from a past season whose team is not in the current rankings is
 * looked up in that season's own rows ({@link findCollegeRoundTeam},
 * {@link findHsRoundTeam}), which name its debaters for the rest of the history.
 *
 * Kept free of React so it can be tested on its own; the watch page's
 * `WatchTeamStats` loads the sources.
 * @module lib/watch-team-history
 */

import {
  entryInitials,
  entryLastNames,
  findCollegeHistoryTeam,
  parseTeamLabel,
  schoolMatchScore,
  SCHOOL_SEASON_FORMATS,
  type CollegeHistoryEntry,
  type RankingDataset,
  type RankingDatasetId,
  type SchoolSeason,
  type SchoolSeasonEvent,
} from "@debate-ai/rankings"
import { findPastTeamProfile, pastTeamSlug } from "@debate-ai/rankings/src/leaderboard/profile/pastTeamHelpers"

/** How many past seasons a team card lists at most. */
export const TEAM_HISTORY_SEASONS = 15

/** One season's result for a team. */
export interface TeamSeasonStat {
  /** Season year: the year the season ends in (2024-25 is 2025). */
  season: number
  /** 1-based rank that season. */
  rank: number
  /** Entries ranked that season; `null` for debatedata's top-100 tables. */
  fieldSize: number | null
  /** The debaters, as that season's source names them. */
  name: string
  /** debatedata's conservative rating (college only). */
  rating?: number
  /** debatedata's skill estimate and its uncertainty (college only). */
  mu?: number
  sigma?: number
  /** TOC bids earned that season (high school only). */
  bids?: number
}

/** A team the history is looked up for: its school and debaters. */
export interface HistoryTeam {
  school: string
  name: string
}

/** Season `2025` as `"2024-25"`. */
export function seasonLabel(year: number): string {
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`
}

/** The high-school event a rankings dataset lists, or `null` for college and others. */
export function hsSeasonEvent(datasetId: RankingDatasetId | null | undefined): SchoolSeasonEvent | null {
  return SCHOOL_SEASON_FORMATS.find((f) => f.datasetId === datasetId)?.event ?? null
}

/** The newest seasons within the {@link TEAM_HISTORY_SEASONS}-year window ending at `latest`. */
function lastSeasons(rows: TeamSeasonStat[], latest: number): TeamSeasonStat[] {
  return rows
    .filter((row) => row.season <= latest && row.season > latest - TEAM_HISTORY_SEASONS)
    .sort((a, b) => b.season - a.season)
}

/**
 * The seasons debatedata's tables rank `team`, newest first, back
 * {@link TEAM_HISTORY_SEASONS} seasons from `latest`.
 *
 * @param history - debatedata's tables by season year (`loadCollegeHistory`).
 * @param team - The school (any spelling) and debaters (`"Katz & Robinson"` or full names).
 * @param latest - The newest season to list, usually the current one.
 */
export function collegeTeamHistory(
  history: ReadonlyMap<number, readonly CollegeHistoryEntry[]>,
  team: HistoryTeam,
  latest: number,
): TeamSeasonStat[] {
  if (!team.school.trim() || !team.name.trim() || history.size === 0) return []
  const profile = findPastTeamProfile({ collegeHistory: history, ndt: null, cedaTitles: () => null }, pastTeamSlug(team))
  const rows = (profile?.seasons ?? []).map(({ season, entry }) => ({
    season,
    rank: entry.rank,
    fieldSize: null,
    name: entry.name,
    rating: entry.rating,
    mu: entry.mu,
    sigma: entry.sigma,
  }))
  return lastSeasons(rows, latest)
}

/**
 * The row of season `season`'s debatedata table a past college round's team
 * label (`"Kansas LS"`) names, or `null` when none or several do.
 */
export function findCollegeRoundTeam(
  history: ReadonlyMap<number, readonly CollegeHistoryEntry[]>,
  season: number,
  label: string | null | undefined,
): CollegeHistoryEntry | null {
  const entries = history.get(season)
  return entries && label?.trim() ? findCollegeHistoryTeam(entries, label) : null
}

/** Who an entry is, for matching across seasons: the pair's last names, or a single debater's whole name. */
function peopleKey(name: string): string {
  const parts = name.split(/\s*(?:&|\/|,| and )\s*/i).filter(Boolean)
  if (parts.length > 1) return entryLastNames(name).sort().join(" ")
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * The seasons a high school entry was one of its school's two best in
 * `event`, newest first, back {@link TEAM_HISTORY_SEASONS} seasons from `latest`.
 *
 * @param seasons - The school's rows from `fetchSchoolSeasons`.
 * @param event - Policy, Lincoln-Douglas or Public Forum.
 * @param name - The entry's debaters, as the rankings name them.
 * @param latest - The newest season to list.
 */
export function hsTeamHistory(
  seasons: readonly SchoolSeason[],
  event: SchoolSeasonEvent,
  name: string,
  latest: number,
): TeamSeasonStat[] {
  const key = peopleKey(name)
  if (!key) return []
  const rows: TeamSeasonStat[] = []
  for (const season of seasons) {
    if (season.event !== event) continue
    const team = season.teams.find((t) => peopleKey(t.name) === key)
    if (team) rows.push({ season: season.year, rank: team.rank, fieldSize: team.fieldSize, name: team.name, bids: team.bids })
  }
  return lastSeasons(rows, latest)
}

/**
 * The school, as the current rankings spell it, that a round label's school
 * (`"Harker"` of `"Harker LL"`) names in `dataset`: the closest match, or
 * `null` when none matches or two different schools tie.
 */
export function resolveRankedSchool(dataset: RankingDataset | undefined, labelSchool: string): string | null {
  if (!dataset || !labelSchool.trim()) return null
  let best: { school: string; score: number } | null = null
  let tied = false
  const seen = new Set<string>()
  for (const { school } of dataset.entries) {
    if (seen.has(school)) continue
    seen.add(school)
    const score = schoolMatchScore(labelSchool, school)
    if (score === 0) continue
    if (!best || score > best.score) {
      best = { school, score }
      tied = false
    } else if (score === best.score) {
      tied = true
    }
  }
  return best && !tied ? best.school : null
}

/** The same initials, in either order. */
function initialsMatch(code: string, name: string): boolean {
  const initials = entryInitials(name)
  return initials.length === code.length && [...initials].sort().join("") === [...code].sort().join("")
}

/**
 * The entry a past high school round's label (`"Harker LL"`) names among its
 * school's best entries that season, or `null` when none or several do.
 *
 * @param seasons - The label school's rows from `fetchSchoolSeasons`.
 * @param event - The round's event.
 * @param season - The round's season year.
 * @param label - The round's aff or neg team.
 */
export function findHsRoundTeam(
  seasons: readonly SchoolSeason[],
  event: SchoolSeasonEvent,
  season: number,
  label: string | null | undefined,
): TeamSeasonStat | null {
  const parsed = parseTeamLabel(label)
  if (!parsed) return null
  const row = seasons.find((s) => s.event === event && s.year === season)
  const matches = (row?.teams ?? []).filter((t) => initialsMatch(parsed.code, t.name))
  if (matches.length !== 1) return null
  const team = matches[0]
  return { season, rank: team.rank, fieldSize: team.fieldSize, name: team.name, bids: team.bids }
}
