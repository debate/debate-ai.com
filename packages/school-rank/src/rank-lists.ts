/**
 * @fileoverview The compiled rank lists under `data/` (U.S. News 2027 national
 * universities, Niche 2027 public and private high schools) with typed
 * accessors and name matching. Matching reuses {@link nameKey} from `schools`
 * and adds a looser key for high school spellings ("HS", "Prep").
 * Partial lists say which ranks they cover; a missing rank is a gap, never a guess.
 * @module rank-lists
 */

import niche2027PrivateHighSchools from "../data/niche-2027-private-high-schools.json"
import niche2027PublicHighSchools from "../data/niche-2027-public-high-schools.json"
import usNews2027NationalUniversities from "../data/us-news-2027-national-universities.json"
import { RANK_ENTRY_ALIASES } from "./data/rank-entry-aliases"
import { SCHOOLS, nameKey, slugify } from "./schools"
import type {
  RankList,
  RankListEntry,
  RankListId,
  RankListMatch,
  RankMatchKind,
  RankRange,
  RankStatus,
  RankedSchool,
  SchoolReconcileStatus,
} from "./types"

export const US_NEWS_2027_NATIONAL_UNIVERSITIES = usNews2027NationalUniversities as RankList
export const NICHE_2027_PUBLIC_HIGH_SCHOOLS = niche2027PublicHighSchools as RankList
export const NICHE_2027_PRIVATE_HIGH_SCHOOLS = niche2027PrivateHighSchools as RankList

export const RANK_LISTS: Readonly<Record<RankListId, RankList>> = {
  "us-news-2027-national-universities": US_NEWS_2027_NATIONAL_UNIVERSITIES,
  "niche-2027-public-high-schools": NICHE_2027_PUBLIC_HIGH_SCHOOLS,
  "niche-2027-private-high-schools": NICHE_2027_PRIVATE_HIGH_SCHOOLS,
}

export const RANK_LIST_IDS = Object.keys(RANK_LISTS) as RankListId[]

/** The list a school is ranked on: colleges on U.S. News, high schools on Niche by control. */
export function rankListIdForSchool(school: Pick<RankedSchool, "level" | "type">): RankListId {
  if (school.level === "college") return "us-news-2027-national-universities"
  return school.type === "public" ? "niche-2027-public-high-schools" : "niche-2027-private-high-schools"
}

/** A bundled list by id. */
export function getRankList(id: RankListId): RankList {
  return RANK_LISTS[id]
}

const inRange = (rank: number, ranges: readonly RankRange[]): boolean => ranges.some((r) => rank >= r.from && rank <= r.to)

/**
 * Whether a rank is compiled (`"present"`), inside the list but not compiled
 * (`"gap"`), or beyond the list's first and last rank (`"outside"`).
 */
export function rankStatus(id: RankListId, rank: number): RankStatus {
  const { metadata } = RANK_LISTS[id]
  if (!Number.isInteger(rank) || rank < metadata.firstRank || rank > metadata.lastRank) return "outside"
  return inRange(rank, metadata.rankRangesPresent) ? "present" : "gap"
}

/** The entries sharing this rank (several when tied), or `[]` when the rank is a gap or outside. */
export function entriesAtRank(id: RankListId, rank: number): RankListEntry[] {
  return RANK_LISTS[id].entries.filter((entry) => entry.rank === rank)
}

/** The compiled entries between two ranks, inclusive, best first. */
export function entriesInRankRange(id: RankListId, from: number, to: number): RankListEntry[] {
  return RANK_LISTS[id].entries.filter((entry) => entry.rank >= from && entry.rank <= to)
}

const GENERIC_WORDS = new Set(["the", "of", "and", "school", "schools", "high", "senior", "hs", "sr"])
const WORD_FORMS: Record<string, string> = { prep: "preparatory" }

/**
 * Looser matching key for names that differ only in "HS" / "High School",
 * "Senior", "Prep" / "Preparatory", a leading "The" or "of" / "and".
 * `"Payton College Prep"` and `"Payton College Preparatory High School"` share one.
 */
export function schoolMatchKey(name: string): string {
  return slugify(name)
    .split("-")
    .map((word) => WORD_FORMS[word] ?? word)
    .filter((word) => word && !GENERIC_WORDS.has(word))
    .join("-")
}

/** What a caller knows about a school besides its name; each narrows the match. */
export interface RankEntryQuery {
  state?: string | null
  city?: string | null
  /** Other names the school goes by, tried after the name. */
  aliases?: readonly string[]
  /**
   * The rank the caller already holds for the school. It only breaks a tie:
   * when an entry has no state and several bundled schools share its name,
   * the entry is taken only if this rank equals the entry's.
   */
  rank?: number | null
}

const compatible = (entry: RankListEntry, query: RankEntryQuery): boolean =>
  (!entry.state || !query.state || entry.state === query.state.toUpperCase()) &&
  (!entry.city || !query.city || nameKey(entry.city) === nameKey(query.city))

const variantKeys = (id: RankListId, entry: RankListEntry): string[] =>
  (RANK_ENTRY_ALIASES[id][entry.name] ?? []).map(nameKey)

/** How many bundled schools of this list's pool share a key, so a state-less entry can be told apart. */
const poolCounts = new Map<string, Map<string, number>>()
function poolCount(id: RankListId, keyOf: (text: string) => string, tag: string, key: string): number {
  const cacheKey = `${id}:${tag}`
  let counts = poolCounts.get(cacheKey)
  if (!counts) {
    counts = new Map()
    for (const school of SCHOOLS) {
      if (rankListIdForSchool(school) !== id) continue
      const k = keyOf(school.name)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    poolCounts.set(cacheKey, counts)
  }
  return counts.get(key) ?? 0
}

/**
 * Finds the entry of one list for a school name. Tries three tiers, strongest
 * first, and the first tier that names exactly one entry wins:
 *
 * 1. `"name"`: the same {@link nameKey} as the entry's name.
 * 2. `"alias"`: the school's aliases equal the entry's name, or its name equals a
 *    spelling in `RANK_ENTRY_ALIASES`.
 * 3. `"loose"`: the same {@link schoolMatchKey}.
 *
 * When the query and an entry both state a state or city they must agree. An
 * entry with no state can belong to several schools ("University HS"); when
 * the query has a state and more than one bundled school shares the name,
 * the entry is taken only if `query.rank` equals the entry's rank. No match is `undefined`.
 */
export function findRankEntry(id: RankListId, name: string, query: RankEntryQuery = {}): RankListMatch | undefined {
  const candidates = RANK_LISTS[id].entries.filter((entry) => compatible(entry, query))
  const queryName = nameKey(name)
  const queryAliases = (query.aliases ?? []).map(nameKey)
  const tiers: readonly [RankMatchKind, (entry: RankListEntry) => boolean, (text: string) => string][] = [
    ["name", (entry) => nameKey(entry.name) === queryName, nameKey],
    [
      "alias",
      (entry) => {
        const own = nameKey(entry.name)
        const variants = variantKeys(id, entry)
        return variants.includes(queryName) || queryAliases.some((a) => a === own || variants.includes(a))
      },
      nameKey,
    ],
    ["loose", (entry) => schoolMatchKey(entry.name) === schoolMatchKey(name), schoolMatchKey],
  ]
  for (const [matchedBy, matches, keyOf] of tiers) {
    const hits = candidates.filter(matches)
    if (hits.length !== 1) continue
    const [entry] = hits
    const shared = query.state && !entry.state && poolCount(id, keyOf, matchedBy, keyOf(name)) > 1
    if (shared && query.rank !== entry.rank) continue
    return { list: id, entry, matchedBy }
  }
  return undefined
}

/** The entry of the school's own list ({@link rankListIdForSchool}), matched by name, aliases, state and city. */
export function matchSchoolToRankList(school: RankedSchool): RankListMatch | undefined {
  return findRankEntry(rankListIdForSchool(school), school.name, {
    state: school.state,
    city: school.city,
    aliases: school.aliases,
    rank: ownRank(school),
  })
}

/** The school's own rank for the list it belongs to, as the package already holds it. */
function ownRank(school: RankedSchool): number | null {
  return school.level === "college" ? school.usNewsRank : school.nicheRank
}

/** One school reconciled with the rank lists. */
export interface SchoolReconciliation {
  school: RankedSchool
  list: RankListId
  status: SchoolReconcileStatus
  match?: RankListMatch
}

/**
 * Whether a school lines up with the compiled list it belongs to.
 * `rank-conflict` means the name matched but the school's existing rank is a different number.
 */
export function reconcileSchool(school: RankedSchool): SchoolReconciliation {
  const list = rankListIdForSchool(school)
  const match = matchSchoolToRankList(school)
  if (match) {
    const rank = ownRank(school)
    return { school, list, match, status: rank === null || rank === match.entry.rank ? "matched" : "rank-conflict" }
  }
  const rank = ownRank(school)
  if (rank === null) return { school, list, status: "not-compiled" }
  const status = rankStatus(list, rank)
  return { school, list, status: status === "present" ? "name-mismatch" : status === "gap" ? "in-gap" : "not-compiled" }
}

/** How many schools of one group reconciled each way. */
export interface RankListCoverage {
  total: number
  matched: number
  byStatus: Readonly<Record<SchoolReconcileStatus, number>>
  unmatched: readonly SchoolReconciliation[]
}

function summarize(results: SchoolReconciliation[]): RankListCoverage {
  const byStatus: Record<SchoolReconcileStatus, number> = {
    matched: 0,
    "rank-conflict": 0,
    "in-gap": 0,
    "name-mismatch": 0,
    "not-compiled": 0,
  }
  for (const r of results) byStatus[r.status]++
  return {
    total: results.length,
    matched: byStatus.matched + byStatus["rank-conflict"],
    byStatus,
    unmatched: results.filter((r) => r.status !== "matched" && r.status !== "rank-conflict"),
  }
}

/**
 * Reconciles every school that has a wordmark with the compiled lists:
 * how many matched, and for the rest why not (gap, outside the top 100, name mismatch).
 */
export function wordmarkRankCoverage(level?: RankedSchool["level"]): RankListCoverage {
  return summarize(SCHOOLS.filter((s) => s.wordmark && (!level || s.level === level)).map(reconcileSchool))
}

/** Reconciles every bundled school of one list's level and control with that list. */
export function rankListCoverage(id: RankListId): RankListCoverage {
  return summarize(SCHOOLS.filter((s) => rankListIdForSchool(s) === id).map(reconcileSchool))
}
