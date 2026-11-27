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

/** The bundled rank lists under `data/`. */
export type RankListId = "us-news-2027-national-universities" | "niche-2027-public-high-schools" | "niche-2027-private-high-schools"

/** An inclusive run of ranks. `reason` is set on gaps. */
export interface RankRange {
  from: number
  to: number
  reason?: string
}

/** One ranked school as a source prints it. */
export interface RankListEntry {
  /** The published rank. Tied schools share it and the next rank skips ahead. */
  rank: number
  /** `true` when another school in the list has the same rank. */
  tie: boolean
  /** The name as the source spells it. */
  name: string
  /** Only where the source states it. */
  city?: string
  /** Two-letter state, only where the source states it. */
  state?: string
  /** The raw location text when it could not be read safely as a city or state. */
  locationRaw?: string
}

/** What a rank list does and does not cover. Partial lists say so here. */
export interface RankListMetadata {
  /** `true` only when every rank from `firstRank` to `lastRank` is present. */
  complete: boolean
  firstRank: number
  /** The last rank of the full published list, or of the slice bundled for the U.S. News top 100. */
  lastRank: number
  entryCount: number
  /** Rank runs that have entries. */
  rankRangesPresent: readonly RankRange[]
  /** Rank runs inside `firstRank`-`lastRank` that are not compiled: unknown, never guessed. */
  knownGaps: readonly RankRange[]
  notes: readonly string[]
}

/** The shape of every file under `data/`. */
export interface RankList {
  schemaVersion: 1
  source: { publisher: string; list: string; url: string; publishedAt?: string; listLabel?: string }
  year: number
  listType: "national-universities" | "public-high-schools" | "private-high-schools"
  level: SchoolLevel
  schoolType?: SchoolType
  metadata: RankListMetadata
  entries: readonly RankListEntry[]
}

/** How a school name was tied to a list entry, strongest first. */
export type RankMatchKind = "name" | "alias" | "loose"

/** A school matched to an entry of one rank list. */
export interface RankListMatch {
  list: RankListId
  entry: RankListEntry
  matchedBy: RankMatchKind
}

/** Whether a rank is compiled in a list. */
export type RankStatus = "present" | "gap" | "outside"

/** What reconciling one school with the rank lists found. */
export type SchoolReconcileStatus =
  /** Entry found and, where the school already has that rank, the ranks agree. */
  | "matched"
  /** Entry found but the school's own rank for the same list differs. */
  | "rank-conflict"
  /** The school's rank falls in a gap of the list, so no entry is expected. */
  | "in-gap"
  /** The school's rank is in a compiled range but no entry matched its name. */
  | "name-mismatch"
  /** No rank for the school in this list's scope (e.g. a college outside the top 100). */
  | "not-compiled"
