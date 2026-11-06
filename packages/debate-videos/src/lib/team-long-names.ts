/**
 * @fileoverview Debaters' last names for round videos whose teams are only
 * initials — `"Strath Haven YS"` becomes `"yang-smith"` — looked up in the
 * season's top-team rankings. The result is what `videos.aff_team_long` /
 * `neg_team_long` store: lowercase last names joined by hyphens, in the order
 * the label's initials give them.
 *
 * Which rankings a round is matched against:
 *
 * - **College policy** (style 4): debatedata's past-season top-100 table
 *   (2009-10 on, `college-history.ts`) first, then the upstream College
 *   Policy ratings (2015-16 on), matched with `findCollegeHistoryTeam` so
 *   college shorthand ("KU", "Gtown") resolves.
 * - **HS policy and PF** (styles 1, 2): the upstream ratings for the
 *   format (2015-16 on), matched like a tournament entry code.
 *
 * Each video is tried against its own season and then the season before,
 * since rounds are often uploaded a season after they were debated. A label
 * that matches more than one team (two teams of one school with the same
 * initials) is left unresolved rather than guessed. LD is not filled: its
 * entries are one debater, and the column holds a team's two last names.
 *
 * Pure: loading the tables is the caller's job (the web app's
 * `lib/videos/fill-team-long-names.ts`).
 * @module lib/team-long-names
 */

import {
  cleanCollegeTeamLabel,
  entryLastNames,
  findCollegeHistoryTeam,
  matchTournamentEntry,
  parseSchoolTeamCode,
  parseTeamLabel,
  type CollegeHistoryEntry,
} from "@debate-ai/rankings"

/** Rankings families a round can be looked up in. */
export type TeamLongNameFormat = "hspolicy" | "hspf" | "collegepolicy"

/** Video styles this fills, and the rankings format each is matched in. */
export const TEAM_LONG_NAME_STYLE_FORMAT: Readonly<Record<number, TeamLongNameFormat>> = {
  1: "hspolicy",
  2: "hspf",
  4: "collegepolicy",
}

/** One ranked team: school as the source spells it, and `"Last & Last"`. */
export interface TeamLongNameEntry {
  school: string
  name: string
  /** The team's place in that season's table (1 = best), when the table ranks. */
  rank?: number
}

/** One season's tables for one format, tried in order. */
export type TeamLongNameTables = readonly (readonly TeamLongNameEntry[])[]

/** The rankings format a round of `style` is matched in, or null when it isn't filled. */
export function teamLongNameFormat(style: number | null | undefined): TeamLongNameFormat | null {
  return typeof style === "number" ? (TEAM_LONG_NAME_STYLE_FORMAT[style] ?? null) : null
}

/**
 * True when `label` is a school plus two initials (`"Strath Haven YS"`,
 * `"Kansas LS - 1AC"`): the teams this fills in.
 */
export function isInitialsTeamLabel(label: string | null | undefined): boolean {
  const parsed = parseTeamLabel(cleanCollegeTeamLabel(label ?? ""))
  return parsed !== null && parsed.code.length === 2
}

/**
 * `"Smith & Yang"` as `"yang-smith"` for the code `"YS"`: each last name
 * lowercased, in the order the code's initials name them (the entry's own
 * order when the initials don't single one out). Null unless the entry has
 * exactly two debaters.
 */
export function teamLongName(entryName: string, code: string): string | null {
  const names = entryLastNames(entryName)
  if (names.length !== 2) return null
  const [a, b] = names as [string, string]
  const letters = code.toLowerCase()
  const swapped = letters.length === 2 && letters[0] === b[0] && letters[1] === a[0] && !(letters[0] === a[0] && letters[1] === b[0])
  return (swapped ? [b, a] : [a, b]).join("-")
}

/** Gives a plain table the shape `findCollegeHistoryTeam` reads (only school and name matter). */
function asCollegeTable(entries: readonly TeamLongNameEntry[]): CollegeHistoryEntry[] {
  return entries.map((entry, i) => ({ rank: entry.rank ?? i + 1, school: entry.school, name: entry.name, rating: 0, mu: 0, sigma: 0 }))
}

const collegeTables = new WeakMap<readonly TeamLongNameEntry[], CollegeHistoryEntry[]>()

/** The one entry `label` names in `entries`, or null for none or several. */
function findEntry(format: TeamLongNameFormat, entries: readonly TeamLongNameEntry[], label: string): TeamLongNameEntry | null {
  if (format === "collegepolicy") {
    let table = collegeTables.get(entries)
    if (!table) {
      table = asCollegeTable(entries)
      collegeTables.set(entries, table)
    }
    return findCollegeHistoryTeam(table, label)
  }
  return matchTournamentEntry(entries, { code: label })
}

/**
 * The stored long name for one team label, or null when the label isn't
 * school-plus-two-initials or no table names exactly one team for it.
 *
 * @param format - From {@link teamLongNameFormat}.
 * @param label - The video's aff or neg team.
 * @param seasons - Tables per season, most likely season first (the video's
 *   own, then the one before); within a season, the preferred table first.
 */
export function resolveTeamLongName(
  format: TeamLongNameFormat,
  label: string | null | undefined,
  seasons: readonly TeamLongNameTables[],
): string | null {
  const cleaned = cleanCollegeTeamLabel(label ?? "")
  const parsed = parseTeamLabel(cleaned)
  if (!parsed || parsed.code.length !== 2) return null
  for (const tables of seasons) {
    for (const entries of tables) {
      const entry = findEntry(format, entries, cleaned)
      if (entry) return teamLongName(entry.name, parsed.code)
    }
  }
  return null
}

/** Strips accents and case, for comparing an initial with a name. */
function foldInitial(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().charAt(0)
}

/**
 * `"Smith & Yang"` as `"Yang & Smith"` for the code `"YS"`: each debater's
 * last name as the rankings spell it, in the order the code's initials name
 * them (the entry's own order when they don't single one out). Null unless
 * the entry has exactly two debaters.
 */
export function teamDisplayNames(entryName: string, code: string): string | null {
  const names = (entryName ?? "")
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*(?:&|\/|,| and )\s*/i)
    .map((part) => part.trim().split(/\s+/).at(-1) ?? "")
    .filter(Boolean)
  if (names.length !== 2) return null
  const [a, b] = names as [string, string]
  const letters = code.toLowerCase()
  const fa = foldInitial(a)
  const fb = foldInitial(b)
  const swapped = letters.length === 2 && letters[0] === fb && letters[1] === fa && !(letters[0] === fa && letters[1] === fb)
  return (swapped ? [b, a] : [a, b]).join(" & ")
}

/**
 * A stored long name (`"yang-smith"`) as the title prints it (`"Yang & Smith"`).
 * Hyphenated surnames can't be told apart from the separator, so a value that
 * doesn't split into exactly two names is returned as null.
 */
export function longNameToDisplay(longName: string | null | undefined): string | null {
  const parts = (longName ?? "").split("-").filter(Boolean)
  if (parts.length !== 2) return null
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" & ")
}

/** What a computed title prints for one team: last names and rank, when known. */
export interface TeamTitleParts {
  /** `"Eltyeb & Weimar"`, or null when no table names the team. */
  names: string | null
  /** The team's rank in its own season's table, or null. */
  rank: number | null
}

/**
 * The debaters' last names and the rank for one team label. Names may come
 * from any season given (the video's own, then the one before); the rank only
 * from the first, so a title never shows last season's rank as this one's.
 *
 * @param format - From {@link teamLongNameFormat}.
 * @param label - The video's aff or neg team.
 * @param seasons - As for {@link resolveTeamLongName}.
 */
export function resolveTeamTitleParts(
  format: TeamLongNameFormat,
  label: string | null | undefined,
  seasons: readonly TeamLongNameTables[],
): TeamTitleParts {
  const result: TeamTitleParts = { names: null, rank: null }
  const cleaned = cleanCollegeTeamLabel(label ?? "")
  const parsed = parseTeamLabel(cleaned)
  if (!parsed || parsed.code.length !== 2) return result
  for (let seasonIndex = 0; seasonIndex < seasons.length; seasonIndex++) {
    // The rank is only looked for in the video's own season.
    if (result.names && (seasonIndex > 0 || result.rank !== null)) break
    for (const entries of seasons[seasonIndex]!) {
      const entry = findEntry(format, entries, cleaned)
      if (!entry) continue
      result.names ??= teamDisplayNames(entry.name, parsed.code)
      if (seasonIndex === 0 && typeof entry.rank === "number" && entry.rank > 0) result.rank = entry.rank
      // The preferred table that knows the team speaks for it.
      break
    }
  }
  return result
}

/** One row of an upstream ratings file, as far as names go. */
interface ExtinctionRatingRow {
  SchoolTeamCode?: unknown
  FullName1?: unknown
  FullName2?: unknown
  OverallELO?: unknown
}

/**
 * The teams in an upstream ratings file body
 * (`/live/teams/HSPolicy1819.json`): school and `"Last & Last"` from each
 * `SchoolTeamCode` (`"Whitney Young BM: Boss & Mohan"`), falling back to the
 * full names when the code has none. Malformed bodies give an empty list.
 */
export function parseExtinctionTeams(body: string): TeamLongNameEntry[] {
  let teams: unknown
  try {
    const parsed = JSON.parse(body) as { teams?: unknown }
    teams = typeof parsed?.teams === "string" ? JSON.parse(parsed.teams) : parsed?.teams
  } catch {
    return []
  }
  if (!Array.isArray(teams)) return []
  // The file isn't sorted by strength; rank by Elo as the rankings page does
  // (`extinctionEntries`), the file's own order breaking ties.
  const elo = (team: ExtinctionRatingRow) => {
    const value = Number(team?.OverallELO)
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
  }
  const ranks = new Map<ExtinctionRatingRow, number>()
  ;(teams as ExtinctionRatingRow[])
    .map((team, index) => ({ team, index }))
    .sort((a, b) => elo(b.team) - elo(a.team) || a.index - b.index)
    .forEach(({ team }, i) => ranks.set(team, i + 1))
  const entries: TeamLongNameEntry[] = []
  for (const team of teams as ExtinctionRatingRow[]) {
    if (typeof team?.SchoolTeamCode !== "string") continue
    const parts = parseSchoolTeamCode(team.SchoolTeamCode)
    const full = [team.FullName1, team.FullName2].filter((n): n is string => typeof n === "string" && n.trim() !== "")
    const name = parts.names || full.join(" & ")
    if (parts.school && name) entries.push({ school: parts.school, name, rank: ranks.get(team) })
  }
  return entries
}

/** The fields of a `videos` row the fill reads. */
export interface TeamLongNameRow {
  videoId: string
  style: number | null
  seasonYear: number
  affTeam: string | null
  negTeam: string | null
  affTeamLong: string | null
  negTeamLong: string | null
}

/** A row's new long names; a side left undefined is unchanged. */
export interface TeamLongNameUpdate {
  videoId: string
  affTeamLong?: string
  negTeamLong?: string
}

/**
 * The updates for `rows` of one format and season, given that season's
 * tables and the previous one's. Sides that already hold a value are kept
 * unless `overwrite`; a side that resolves to what it already holds is not
 * an update.
 */
export function planTeamLongNames(
  rows: readonly TeamLongNameRow[],
  format: TeamLongNameFormat,
  seasons: readonly TeamLongNameTables[],
  overwrite = false,
): TeamLongNameUpdate[] {
  const updates: TeamLongNameUpdate[] = []
  for (const row of rows) {
    const update: TeamLongNameUpdate = { videoId: row.videoId }
    const aff = overwrite || !row.affTeamLong ? resolveTeamLongName(format, row.affTeam, seasons) : null
    const neg = overwrite || !row.negTeamLong ? resolveTeamLongName(format, row.negTeam, seasons) : null
    if (aff && aff !== row.affTeamLong) update.affTeamLong = aff
    if (neg && neg !== row.negTeamLong) update.negTeamLong = neg
    if (update.affTeamLong || update.negTeamLong) updates.push(update)
  }
  return updates
}
