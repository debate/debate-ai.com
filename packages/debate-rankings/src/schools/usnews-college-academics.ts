/**
 * @fileoverview The academics rank college pages show: a school's place on
 * U.S. News & World Report's 2027 Best National Universities list, as Alexa
 * supplied it on 2026-11-24 for the 16 top debate programs. Ties keep the
 * published rank (Emory and Georgetown are both 23). Kansas and Kentucky sit
 * outside the top 100, at 148. A college not listed here shows no rank.
 *
 * Rows are keyed by the school's page handle (`schoolHandle`), so every
 * spelling a source uses ("Kansas", "University of Kansas", "State University
 * of New York - Binghamton") lands on the one row, and look-alikes with their
 * own pages ("Kansas State", "Michigan State" vs "Michigan", "Georgia Tech",
 * "Texas - Dallas") never borrow another school's rank.
 *
 * @module schools/usnews-college-academics
 */

/** Where the ranks come from. */
export const USNEWS_COLLEGE_ACADEMICS_SOURCE = {
  label: "U.S. News 2027 Best National Universities",
  url: "https://www.usnews.com/best-colleges/rankings/national-universities",
} as const

/** One college on the list. */
export interface UsNewsCollegeAcademics {
  /** The school's page handle, e.g. `kansas`. */
  handle: string
  /** The school's name as U.S. News lists it. */
  name: string
  /** U.S. News 2027 National Universities rank, 1 = best; ties share a rank. */
  rank: number
}

/** Best first; `[handle, U.S. News name, rank]`. */
const ROWS: readonly [handle: string, name: string, rank: number][] = [
  ["harvard", "Harvard University", 3],
  ["northwestern", "Northwestern University", 9],
  ["dartmouth", "Dartmouth College", 12],
  ["uc-berkeley", "University of California, Berkeley", 20],
  ["emory", "Emory University", 23],
  ["georgetown", "Georgetown University", 23],
  ["michigan", "University of Michigan–Ann Arbor", 25],
  ["southern-california", "University of Southern California", 27],
  ["wake-forest", "Wake Forest University", 34],
  ["texas", "University of Texas at Austin", 34],
  ["georgia", "University of Georgia", 52],
  ["michigan-state", "Michigan State University", 69],
  ["binghamton", "Binghamton University–SUNY", 73],
  ["iowa", "University of Iowa", 100],
  ["kansas", "University of Kansas", 148],
  ["kentucky", "University of Kentucky", 148],
]

/** Every listed college, best first. */
export const USNEWS_COLLEGE_ACADEMICS: readonly UsNewsCollegeAcademics[] = ROWS.map(([handle, name, rank]) => ({
  handle,
  name,
  rank,
}))

const BY_HANDLE = new Map(USNEWS_COLLEGE_ACADEMICS.map((row) => [row.handle, row]))

/**
 * A college's U.S. News 2027 National Universities rank, or `null` when it
 * isn't in the supplied list.
 *
 * @param handle - The school's page handle (`schoolHandle(name)`).
 */
export function findUsNewsCollegeRank(handle: string | null | undefined): UsNewsCollegeAcademics | null {
  return (handle && BY_HANDLE.get(handle)) || null
}
