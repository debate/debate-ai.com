/**
 * @fileoverview The shapes this package hands out.
 * @module types
 */

/** College or high school; the `level` search filter. */
export type SchoolLevel = "college" | "high-school"

/** Public or private control. */
export type SchoolType = "public" | "private"

/** The three ranked divisions the README and {@link topSchools} use. */
export type Division = "college" | "public-high-school" | "private-high-school"

/** One school, with every rank this package knows for it. */
export interface RankedSchool {
  /** Stable slug: name plus state, e.g. `harvard-university-ma`. */
  id: string
  name: string
  level: SchoolLevel
  type: SchoolType
  division: Division
  /** City when a source states it, else `null`. */
  city: string | null
  /** Two-letter state (DC included). */
  state: string
  /** Short names and nicknames the search also matches ("MIT", "Bronx Science"). */
  aliases: readonly string[]
  /**
   * U.S. News national rank: 2027 Best National Universities for colleges,
   * 2026-2027 Best High Schools for public high schools. Always `null` for
   * private high schools (U.S. News does not rank them) and `null` wherever
   * the rank exists but is not bundled.
   */
  usNewsRank: number | null
  /**
   * High schools only: rank within the school's category (public or private)
   * on Niche's 2027 Best High Schools in America. `null` for colleges.
   */
  nicheRank: number | null
  /** Path of the school's wordmark png inside `@debate-ai/icons`, or `null`. */
  wordmark: string | null
}

/** Search filters; all optional. */
export interface SchoolSearchOptions {
  /** Only colleges or only high schools. */
  level?: SchoolLevel
  /** Only public or only private schools. */
  type?: SchoolType
  /** Only one division (overrides nothing; combines with the filters above). */
  division?: Division
  /** Only schools in this two-letter state. */
  state?: string
  /** Only schools that have a wordmark. */
  hasWordmark?: boolean
  /** Most results to return (default 10). */
  limit?: number
}

/** One search hit. */
export interface SchoolSearchResult {
  school: RankedSchool
  /** Fuse score, 0 = exact; exact name or alias matches score 0. */
  score: number
  /** Shortcut to `school.wordmark`. */
  wordmark: string | null
}
