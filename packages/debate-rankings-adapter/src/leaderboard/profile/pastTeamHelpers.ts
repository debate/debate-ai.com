/**
 * @fileoverview Pure helpers behind the profile of a past-season team: a
 * college policy team that is not in the current season's rankings but is
 * named in a past season's debatedata table, the NDT's school history or the
 * CEDA champions list. Such a team has no ratings of the site's own, so its
 * page shows what those sources hold — each season's rank, its NDT results,
 * its CEDA titles — plus the library's videos of it.
 *
 * A past team shares the `@<handle>` shape of a ranked team (school plus
 * initials, see `teamHandle`), so a link needs no extra data; the page splits
 * the handle back into school and initials and looks the team up in each
 * source with that source's own loose school matching.
 * @module leaderboard/profile/pastTeamHelpers
 */

import {
  collegeSchoolKey,
  entryInitials,
  findCollegeHistoryTeam,
  schoolSearchNames,
  type CollegeHistoryEntry,
} from "../../index"
import { CEDA_CHAMPIONS, type CedaChampion, type CedaSchoolTitles } from "@debate-ai/data-sync/src/rankings/ceda-champions"
import type { NdtSchoolHistory, NdtTeamResult } from "@debate-ai/data-sync/src/rankings/ndt-school-history"
import type { VideoDebateStyle as DebateStyle } from "@debate-ai/types"
import { findNdtSchoolHistory, profileSlug, teamHref, type ProfileVideoSearch } from "./rankingProfileHelpers"

/** Video style of college policy rounds, the only division with past-season data. */
const COLLEGE_POLICY_STYLE: DebateStyle = 4

/** A school name without the NDT's state tag: `"Harvard University (MA)"` → `"Harvard University"`. */
function withoutStateTag(school: string): string {
  return school.replace(/\s*\([^)]*\)/g, "").trim()
}

/**
 * Path of a past team's profile: the same `@<handle>` a ranked team gets
 * (school plus initials), with the NDT's state tag left out of the school.
 *
 * @param team - The school as any source spells it, and the debaters
 *   (`"Smith & Jones"` or full names).
 */
export function pastTeamHref(team: { school: string; name: string }): string {
  return teamHref({ school: withoutStateTag(team.school), name: team.name })
}

/**
 * Path of a past team's profile by its debaters' names (school plus names,
 * like the older `teamSlug`), for a pair whose initials another pair of the
 * same school shares, or a list (the NDT's, CEDA's) whose school the
 * initials lookup may not pin down.
 */
export function pastTeamNamesHref(team: { school: string; name: string }): string {
  return `/@${profileSlug(`${withoutStateTag(team.school)} ${team.name}`)}`
}

/** A team `@handle` split back into its school and initials. */
export interface TeamHandleParts {
  /** The school's words, lowercase, e.g. `"harvard university"`. */
  school: string
  /** The debaters' initials, uppercase, e.g. `"BM"`. */
  code: string
}

/**
 * The school and initials of a team handle (`harvard-university-bm`), or
 * `null` when the handle doesn't end in a two-letter initials segment after
 * at least one school word. College policy teams are pairs, so two letters is
 * the only shape a past team's handle takes.
 */
export function parseTeamHandle(slug: string): TeamHandleParts | null {
  let decoded = slug ?? ""
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // A malformed escape is used as-is.
  }
  const match = /^(.+)-([a-z]{2})$/.exec(profileSlug(decoded))
  return match ? { school: match[1].replace(/-/g, " "), code: match[2].toUpperCase() } : null
}

/** The same people, in either order. */
function sameInitials(name: string, code: string): boolean {
  const initials = entryInitials(name)
  return initials.length === code.length && [...initials].sort().join("") === [...code].sort().join("")
}

/** One season's row for the team in debatedata's top-100 table. */
export interface PastTeamSeason {
  /** Season year (the year the season ends in). */
  season: number
  entry: CollegeHistoryEntry
}

/** One NDT result of the team, with the list it came from. */
export interface PastTeamNdtResult extends NdtTeamResult {
  kind: "Championship" | "Elims" | "First-round bid" | "Copeland Award"
}

/** Everything the sources hold about one past team. */
export interface PastTeamProfile {
  /** The school, as the most specific source spells it. */
  school: string
  /** The debaters, from the most recent source that names them. */
  name: string
  /** The handle's initials. */
  code: string
  /** Seasons the team made debatedata's top 100, newest first. */
  seasons: PastTeamSeason[]
  /** NDT results, newest first. */
  ndt: PastTeamNdtResult[]
  /** CEDA national titles, newest first. */
  ceda: CedaChampion[]
}

/** The sources a past team is looked up in; any can be missing while it loads. */
export interface PastTeamSources {
  /** debatedata's tables by season year, from `loadCollegeHistory`. */
  collegeHistory: ReadonlyMap<number, readonly CollegeHistoryEntry[]>
  /** Parsed `ndt-school-history.json`. */
  ndt: NdtSchoolHistory[] | null
  /** Finds a school's CEDA titles (`findCedaSchoolTitles`). */
  cedaTitles: (school: string) => CedaSchoolTitles | null
}

/** What one lookup over the sources found. */
interface PastTeamMatches {
  seasons: PastTeamSeason[]
  ndt: PastTeamNdtResult[]
  ceda: CedaChampion[]
}

/** Each NDT list of a school, with the label its results carry. */
function ndtLists(school: NdtSchoolHistory): [PastTeamNdtResult["kind"], NdtTeamResult[]][] {
  return [
    ["Championship", school.championships],
    ["Elims", school.elims],
    ["First-round bid", school.atLargeBids],
    ["Copeland Award", school.copelandWinners],
  ]
}

/** The debaters' last names, lowercase and sorted: `"Stephen Weil & Andrew Halpern"` → `"halpern weil"`. */
function lastNameKey(name: string): string {
  return name
    .split(/\s*(?:&|\/|,| and )\s*/i)
    .map((part) => profileSlug(part).split("-").at(-1) ?? "")
    .filter(Boolean)
    .sort()
    .join(" ")
}

/** Rows and results of the school (each source's loose matcher) whose debaters have initials `code`. */
function matchByInitials(sources: PastTeamSources, school: string, code: string): PastTeamMatches & { ndtSchool: string | null } {
  const seasons: PastTeamSeason[] = []
  for (const [season, entries] of sources.collegeHistory) {
    const entry = findCollegeHistoryTeam(entries, `${school} ${code}`)
    if (entry) seasons.push({ season, entry })
  }
  const ndtSchool = sources.ndt ? findNdtSchoolHistory(sources.ndt, school) : null
  const ndt: PastTeamNdtResult[] = []
  if (ndtSchool) {
    for (const [kind, items] of ndtLists(ndtSchool)) {
      for (const item of items) if (sameInitials(item.team, code)) ndt.push({ ...item, kind })
    }
  }
  const ceda = (sources.cedaTitles(school)?.titles ?? []).filter((title) => sameInitials(title.team, code))
  return { seasons, ndt, ceda, ndtSchool: ndtSchool?.school ?? null }
}

/**
 * Rows and results whose school plus debaters slugify to exactly `slug` (see
 * {@link pastTeamNamesHref}), with the school each source spells.
 */
function matchByNames(
  sources: PastTeamSources,
  slug: string,
): PastTeamMatches & { ndtSchool: string | null; first: { school: string; name: string } | null } {
  const named = (school: string, name: string) => profileSlug(`${withoutStateTag(school)} ${name}`) === slug
  const seasons: PastTeamSeason[] = []
  for (const [season, entries] of sources.collegeHistory) {
    for (const entry of entries) if (named(entry.school, entry.name)) seasons.push({ season, entry })
  }
  const ndt: PastTeamNdtResult[] = []
  let ndtSchool: string | null = null
  for (const school of sources.ndt ?? []) {
    for (const [kind, items] of ndtLists(school)) {
      for (const item of items) {
        if (!named(school.school, item.team)) continue
        ndt.push({ ...item, kind })
        ndtSchool ??= school.school
      }
    }
  }
  const ceda = CEDA_CHAMPIONS.filter((title) => named(title.school, title.team))
  const first =
    (seasons[0] && { school: seasons[0].entry.school, name: seasons[0].entry.name }) ||
    (ndt[0] && ndtSchool && { school: ndtSchool, name: ndt[0].team }) ||
    (ceda[0] && { school: ceda[0].school, name: ceda[0].team }) ||
    null
  return { seasons, ndt, ceda, ndtSchool, first }
}

/** `a` plus the items of `b` whose key `a` lacks. */
function union<T>(a: T[], b: T[], key: (item: T) => string): T[] {
  const seen = new Set(a.map(key))
  return [...a, ...b.filter((item) => !seen.has(key(item)))]
}

/**
 * The past team an `@handle` names, or `null` when no source has it. Two
 * slug shapes resolve:
 *
 * - The team handle, school plus initials ({@link pastTeamHref}). Each
 *   season's table is matched the way a round video's team label is
 *   (`findCollegeHistoryTeam`: loose school, initials in either order, an
 *   ambiguous match left out); the NDT and CEDA lists by their school
 *   matcher and the debaters' initials.
 * - School plus the debaters' names ({@link pastTeamNamesHref}), for a pair
 *   whose initials another pair of its school shares. The rows naming them
 *   exactly are joined by the initials matches whose debaters have the same
 *   last names, so an NDT entry ("Stephen Weil & Andrew Halpern") still meets
 *   its debatedata rows ("Weil & Halpern").
 */
export function findPastTeamProfile(sources: PastTeamSources, slug: string): PastTeamProfile | null {
  let decoded = slug ?? ""
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    // A malformed escape is used as-is.
  }
  const exact = matchByNames(sources, profileSlug(decoded))
  const parts = exact.first
    ? { school: exact.first.school, code: entryInitials(exact.first.name) }
    : parseTeamHandle(slug)
  if (!parts) return null
  const loose = matchByInitials(sources, withoutStateTag(parts.school), parts.code)
  const people = exact.first ? lastNameKey(exact.first.name) : null
  const samePeople = (name: string) => people === null || lastNameKey(name) === people

  const seasons = union(exact.seasons, loose.seasons.filter((s) => samePeople(s.entry.name)), (s) => String(s.season))
    .sort((a, b) => b.season - a.season)
  const ndt = union(exact.ndt, loose.ndt.filter((r) => samePeople(r.team)), (r) => `${r.year}|${r.kind}|${r.team}`)
    .sort((a, b) => b.year - a.year)
  const ceda = union(exact.ceda, loose.ceda.filter((t) => samePeople(t.team)), (t) => String(t.year))
    .sort((a, b) => b.year - a.year)
  if (seasons.length === 0 && ndt.length === 0 && ceda.length === 0) return null

  // The most recent naming of the team wins, so the page reads like its latest season.
  const ndtSchool = ndt.length > 0 ? (exact.ndtSchool ?? loose.ndtSchool) : null
  const named = [
    ...seasons.map(({ season, entry }) => ({ year: season, school: entry.school, name: entry.name })),
    ...ndt.map((r) => ({ year: r.year, school: ndtSchool ?? parts.school, name: r.team })),
    ...ceda.map((t) => ({ year: t.year, school: t.school, name: t.team })),
  ].sort((a, b) => b.year - a.year)
  const latest = named[0]
  return {
    school: withoutStateTag(ndtSchool ?? ceda[0]?.school ?? latest.school),
    name: latest.name,
    code: parts.code,
    seasons,
    ndt,
    ceda,
  }
}

/** Most phrases one video search sends. */
const MAX_SEARCH_NAMES = 12

/**
 * Video search for a past team: college policy rounds whose aff or neg team
 * is the school plus the team's initials, in either order. The school is
 * tried as the profile spells it, as each season's table spells it, and in
 * its short college form (`"Harvard University"` → `"harvard"`), since round
 * labels use the short names.
 */
export function pastTeamVideoSearch(
  team: Pick<PastTeamProfile, "school" | "code"> & Partial<Pick<PastTeamProfile, "seasons">>,
): ProfileVideoSearch {
  const codes = [...new Set([team.code, [...team.code].reverse().join("")])].map((c) => c.toLowerCase())
  const spellings = [team.school, ...(team.seasons ?? []).map((s) => s.entry.school)]
  const schools = new Set([
    ...spellings.map(collegeSchoolKey),
    ...spellings.flatMap((school) => schoolSearchNames(school)),
  ])
  schools.delete("")
  return {
    competitors: [...schools].flatMap((school) => codes.map((c) => `${school} ${c}`)).slice(0, MAX_SEARCH_NAMES),
    styles: [COLLEGE_POLICY_STYLE],
    label: `${team.school} ${team.code}`,
  }
}
