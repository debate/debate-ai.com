/**
 * @fileoverview Every bundled school as one {@link RankedSchool} list:
 * the U.S. News 2027 top 100 national universities (plus the colleges with a
 * wordmark outside it), the top 1,000 public and 800 private high schools on
 * Niche's 2027 lists (the same lists high school pages on the site use, owned
 * by `@debate-ai/rankings`), and the U.S. News 2026-2027 public high school
 * ranks merged onto them.
 * @module schools
 */

import { PRIVATE_ACADEMIC_ROWS, PUBLIC_ACADEMIC_ROWS } from "@debate-ai/rankings/src/schools/academic-category-data"
import { COLLEGES_OUTSIDE_TOP_100, COLLEGE_ROWS } from "./data/colleges-usnews"
import { US_NEWS_HIGH_SCHOOL_ROWS } from "./data/high-schools-usnews"
import { HIGH_SCHOOL_ALIASES, WORDMARK_ROWS } from "./data/wordmarks"
import type { Division, RankedSchool, SchoolLevel } from "./types"

/** `"St. Mark’s School & Co."` → `"st-marks-school-and-co"`. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Matching key for a school name: slug without a leading "the". */
export function nameKey(name: string): string {
  return slugify(name).replace(/^the-/, "")
}

const wordmarkFor = (level: SchoolLevel, name: string, state: string): string | null =>
  WORDMARK_ROWS.find(([, l, n, s]) => l === level && s === state && nameKey(n) === nameKey(name))?.[0] ?? null

function build(): RankedSchool[] {
  const schools: RankedSchool[] = []
  const ids = new Set<string>()
  const uniqueId = (name: string, state: string): string => {
    const base = `${slugify(name)}-${state.toLowerCase()}`
    let id = base
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`
    ids.add(id)
    return id
  }

  for (const [rank, name, state, type, aliases] of [...COLLEGE_ROWS, ...COLLEGES_OUTSIDE_TOP_100]) {
    schools.push({
      id: uniqueId(name, state),
      name,
      level: "college",
      type,
      division: "college",
      city: null,
      state,
      aliases: aliases ?? [],
      usNewsRank: rank,
      nicheRank: null,
      wordmark: wordmarkFor("college", name, state),
    })
  }

  const highSchool = (name: string, state: string, type: "public" | "private", nicheRank: number | null): RankedSchool => ({
    id: uniqueId(name, state),
    name,
    level: "high-school",
    type,
    division: type === "public" ? "public-high-school" : "private-high-school",
    city: null,
    state,
    aliases: HIGH_SCHOOL_ALIASES[name] ?? [],
    usNewsRank: null,
    nicheRank,
    wordmark: wordmarkFor("high-school", name, state),
  })
  const publicSchools = PUBLIC_ACADEMIC_ROWS.map(([rank, name, state]) => highSchool(name, state, "public", rank))
  const privateSchools = PRIVATE_ACADEMIC_ROWS.map(([rank, name, state]) => highSchool(name, state, "private", rank))

  // Merge U.S. News ranks onto the Niche public list (first, i.e. best, match wins).
  for (const [rank, name, city, state, nicheName] of US_NEWS_HIGH_SCHOOL_ROWS) {
    const key = nameKey(nicheName ?? name)
    let school = publicSchools.find((s) => s.state === state && nameKey(s.name) === key)
    if (!school) {
      school = highSchool(name, state, "public", null)
      publicSchools.push(school)
    }
    school.usNewsRank = rank
    school.city = city
    // Show the U.S. News spelling; the Niche spelling stays searchable.
    if (school.name !== name) {
      school.aliases = [...school.aliases, school.name]
      school.name = name
    }
  }

  return [...schools, ...publicSchools, ...privateSchools]
}

/** Every bundled school: colleges first, then public, then private high schools. */
export const SCHOOLS: readonly RankedSchool[] = build()

const BY_ID = new Map(SCHOOLS.map((school) => [school.id, school]))

/** The school with this id, or `undefined`. */
export function getSchool(id: string): RankedSchool | undefined {
  return BY_ID.get(id)
}

/** The schools in one division. */
export function schoolsInDivision(division: Division): RankedSchool[] {
  return SCHOOLS.filter((school) => school.division === division)
}

/** Which ranking orders a division by default. */
export const DIVISION_RANKING: Readonly<Record<Division, "usNews" | "niche">> = {
  college: "usNews",
  "public-high-school": "usNews",
  "private-high-school": "niche",
}

/** The rank a division is ordered by, or `null` when the school has none. */
export function divisionRank(school: RankedSchool, by: "usNews" | "niche" = DIVISION_RANKING[school.division]): number | null {
  return by === "usNews" ? school.usNewsRank : school.nicheRank
}

/**
 * The best `count` ranked schools of a division, ordered by U.S. News
 * (colleges, public high schools) or Niche (private high schools, which
 * U.S. News does not rank) unless `by` says otherwise. Ties keep source order.
 */
export function topSchools(division: Division, count = 10, by: "usNews" | "niche" = DIVISION_RANKING[division]): RankedSchool[] {
  return schoolsInDivision(division)
    .filter((school) => divisionRank(school, by) !== null)
    .sort((a, b) => (divisionRank(a, by) as number) - (divisionRank(b, by) as number))
    .slice(0, count)
}
