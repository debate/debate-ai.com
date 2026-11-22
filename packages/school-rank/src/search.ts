/**
 * @fileoverview Fuse.js fuzzy search over every bundled school, filtered by
 * level (college / high school), type, division, state or wordmark.
 * An exact name or alias match ("MIT", "Bronx Science") always ranks first;
 * the rest is Fuse's order, ties broken by rank.
 * @module search
 */

import Fuse from "fuse.js"
import { SCHOOLS, divisionRank, nameKey } from "./schools"
import type { Division, RankedSchool, SchoolLevel, SchoolSearchOptions, SchoolSearchResult, SchoolType } from "./types"

let fuse: Fuse<RankedSchool> | null = null
const index = (): Fuse<RankedSchool> =>
  (fuse ??= new Fuse(SCHOOLS as RankedSchool[], {
    keys: [
      { name: "name", weight: 0.6 },
      { name: "aliases", weight: 0.3 },
      { name: "city", weight: 0.05 },
      { name: "state", weight: 0.05 },
    ],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.35,
  }))

const matchesFilters = (school: RankedSchool, o: SchoolSearchOptions): boolean =>
  (!o.level || school.level === o.level) &&
  (!o.type || school.type === o.type) &&
  (!o.division || school.division === o.division) &&
  (!o.state || school.state === o.state.toUpperCase()) &&
  (o.hasWordmark === undefined || Boolean(school.wordmark) === o.hasWordmark)

const rankForSort = (school: RankedSchool): number => divisionRank(school) ?? Number.MAX_SAFE_INTEGER

/**
 * Fuzzy-find schools by name, nickname, city or state.
 *
 * @example
 * searchSchools("harvard", { level: "college" })[0].school.usNewsRank // 3
 * searchSchools("bronx science", { level: "high-school" })[0].wordmark // "high-schools/bronx.png"
 */
export function searchSchools(query: string, options: SchoolSearchOptions = {}): SchoolSearchResult[] {
  const limit = options.limit ?? 10
  const q = query.trim()
  if (!q) return []
  const key = nameKey(q)

  const exact = SCHOOLS.filter(
    (s) => matchesFilters(s, options) && (nameKey(s.name) === key || s.aliases.some((a) => nameKey(a) === key)),
  ).sort((a, b) => rankForSort(a) - rankForSort(b))
  const exactIds = new Set(exact.map((s) => s.id))

  const fuzzy = index()
    .search(q)
    .filter((hit) => !exactIds.has(hit.item.id) && matchesFilters(hit.item, options))
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1) || rankForSort(a.item) - rankForSort(b.item))

  return [
    ...exact.map((school) => ({ school, score: 0, wordmark: school.wordmark })),
    ...fuzzy.map((hit) => ({ school: hit.item, score: hit.score ?? 1, wordmark: hit.item.wordmark })),
  ].slice(0, limit)
}

const LEVELS: Record<string, SchoolLevel> = {
  college: "college",
  colleges: "college",
  university: "college",
  universities: "college",
  "high-school": "high-school",
  "high-schools": "high-school",
  highschool: "high-school",
  hs: "high-school",
}
const DIVISIONS = new Set<Division>(["college", "public-high-school", "private-high-school"])

/**
 * Reads search options from URL params, e.g. `?q=harvard&level=college`
 * or `?q=westwood&level=hs&state=TX&type=public&limit=5&wordmark=1`.
 * `level` accepts college / university / high-school / high school / hs.
 */
export function parseSchoolSearchParams(input: URLSearchParams | string | Record<string, string>): {
  query: string
  options: SchoolSearchOptions
} {
  const params = input instanceof URLSearchParams ? input : new URLSearchParams(input)
  const options: SchoolSearchOptions = {}
  const level = LEVELS[slugify(params.get("level") ?? "")]
  if (level) options.level = level
  const type = params.get("type")?.toLowerCase()
  if (type === "public" || type === "private") options.type = type as SchoolType
  const division = params.get("division")?.toLowerCase() as Division | undefined
  if (division && DIVISIONS.has(division)) options.division = division
  const state = params.get("state")?.trim()
  if (state && /^[a-z]{2}$/i.test(state)) options.state = state.toUpperCase()
  const wordmark = params.get("wordmark")
  if (wordmark !== null) options.hasWordmark = !/^(0|false|no)$/i.test(wordmark)
  const limit = Number(params.get("limit"))
  if (Number.isInteger(limit) && limit > 0) options.limit = limit
  return { query: params.get("q") ?? params.get("query") ?? "", options }
}

/** {@link searchSchools} driven by URL params ({@link parseSchoolSearchParams}). */
export function searchSchoolsFromParams(input: URLSearchParams | string | Record<string, string>): SchoolSearchResult[] {
  const { query, options } = parseSchoolSearchParams(input)
  return searchSchools(query, options)
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[\s_]+/g, "-")
}
