/**
 * @fileoverview `@debate-ai/school-rank`: top colleges and public and private
 * high schools with their U.S. News (and Niche) ranks, fuzzy search, and
 * wordmark logos. The png assets live behind `@debate-ai/school-rank/wordmarks`.
 * @module school-rank
 */

export type {
  Division,
  RankList,
  RankListEntry,
  RankListId,
  RankListMatch,
  RankListMetadata,
  RankMatchKind,
  RankRange,
  RankStatus,
  RankedSchool,
  SchoolLevel,
  SchoolReconcileStatus,
  SchoolSearchOptions,
  SchoolSearchResult,
  SchoolType,
} from "./types"
export { COLLEGE_RANK_SOURCE, COLLEGE_ROWS, COLLEGES_OUTSIDE_TOP_100, type CollegeRow } from "./data/colleges-usnews"
export { HIGH_SCHOOL_RANK_SOURCE, US_NEWS_HIGH_SCHOOL_ROWS, type UsNewsHighSchoolRow } from "./data/high-schools-usnews"
export { WORDMARK_ROWS, type WordmarkRow } from "./data/wordmarks"
export { DIVISION_RANKING, SCHOOLS, divisionRank, getSchool, nameKey, schoolsInDivision, slugify, topSchools } from "./schools"
export {
  NICHE_2027_PRIVATE_HIGH_SCHOOLS,
  NICHE_2027_PUBLIC_HIGH_SCHOOLS,
  RANK_LISTS,
  RANK_LIST_IDS,
  US_NEWS_2027_NATIONAL_UNIVERSITIES,
  entriesAtRank,
  entriesInRankRange,
  findRankEntry,
  getRankList,
  matchSchoolToRankList,
  rankListCoverage,
  rankListIdForSchool,
  rankStatus,
  reconcileSchool,
  schoolMatchKey,
  wordmarkRankCoverage,
  type RankEntryQuery,
  type RankListCoverage,
  type SchoolReconciliation,
} from "./rank-lists"
export { parseSchoolSearchParams, searchSchools, searchSchoolsFromParams } from "./search"
export { allWordmarkCoverage, wordmarkCoverage, type WordmarkCoverage } from "./wordmark-stats"

/** Where the high school Niche ranks come from (the lists `@debate-ai/rankings` bundles). */
export const NICHE_RANK_SOURCE = {
  list: "Niche 2027 Best High Schools in America (public top 1,000, private top 800)",
  url: "https://www.niche.com/k12/search/best-high-schools/",
} as const
