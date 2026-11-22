/**
 * @fileoverview U.S. News & World Report 2026-2027 Best High Schools,
 * national ranks, released 2026-08-18 (data from the 2023-24 school year).
 *
 * U.S. News ranks only public high schools (charter and magnet schools
 * included), so no private school has a U.S. News rank. Its full list is not
 * reachable from here, so only the ranks published in these articles are
 * bundled, fetched 2026-11-22:
 *
 * - Ranks 1-10: U.S. News' own press release (PR Newswire, 2026-08-18).
 * - Ranks 11-20: Black America Web's "Top 20 High Schools in America for
 *   2026-27", which matches the release on 1-10.
 * - Arizona schools in the top 100: AZFamily, 2026-08-18.
 * - New York and New Jersey schools: FOX 5 New York, 2026-08-18.
 *
 * Every other public school's U.S. News rank is a gap. Each school also
 * carries its Niche rank (see `high-schools.ts`), which covers the top 1,000
 * public and 800 private schools.
 * @module data/high-schools-usnews
 */

/** Where the high school U.S. News ranks come from. */
export const HIGH_SCHOOL_RANK_SOURCE = {
  list: "U.S. News 2026-2027 Best High Schools",
  edition: "2026-2027",
  published: "2026-08-18",
  url: "https://www.usnews.com/education/best-high-schools/national-rankings",
  via: [
    "https://aijourn.com/u-s-news-reveals-2026-2027-best-high-schools-rankings/",
    "https://blackamericaweb.com/2026/10/16/top-20-high-schools-in-america-for-2026-27/",
    "https://www.azfamily.com/2026/08/18/report-13-arizona-charter-public-high-schools-rank-among-top-100-nationwide/",
    "https://www.fox5ny.com/news/best-public-high-schools-ny-nj-2026-us-news",
  ],
} as const

/**
 * `[national rank, name, city, state, name on the Niche list]`. City is
 * `null` where no source states it. The last column is set only when the
 * Niche list spells the school differently enough that name matching misses.
 */
export type UsNewsHighSchoolRow = readonly [
  rank: number,
  name: string,
  city: string | null,
  state: string,
  nicheName?: string,
]

/** Every sourced national rank, best first. Ranks 1-20 are complete. */
export const US_NEWS_HIGH_SCHOOL_ROWS: readonly UsNewsHighSchoolRow[] = [
  [1, "Central Magnet School", "Murfreesboro", "TN"],
  [2, "Signature School", "Evansville", "IN"],
  [3, "Julia R. Masterman Secondary School", "Philadelphia", "PA", "Julia R. Masterman Laboratory and Demonstration School"],
  [4, "Davidson Academy", "Reno", "NV", "The Davidson Academy"],
  [5, "School Without Walls High School", "Washington", "DC"],
  [6, "Thomas Jefferson High School for Science and Technology", "Alexandria", "VA", "Thomas Jefferson High School for Science & Technology"],
  [7, "Gwinnett School of Mathematics, Science and Technology", "Lawrenceville", "GA", "Gwinnett School of Mathematics Science & Technology"],
  [8, "The School for the Talented and Gifted", "Dallas", "TX", "School for the Talented & Gifted"],
  [9, "Nikola Tesla STEM High School", "Redmond", "WA", "Tesla STEM High School"],
  [10, "Science Academy STEM Magnet", "North Hollywood", "CA"],
  [11, "Whitney High School", "Cerritos", "CA"],
  [12, "International Academy", "Bloomfield Hills", "MI"],
  [13, "Pine View School", "Osprey", "FL"],
  [14, "Aiken Scholars Academy", "Aiken", "SC"],
  [15, "BASIS Oro Valley", "Oro Valley", "AZ"],
  [16, "BASIS Goodyear", "Goodyear", "AZ"],
  [17, "Oxford Academy", "Cypress", "CA"],
  [18, "HCS Scholars Academy High", "Conway", "SC", "Hcs Scholars Academy High School"],
  [19, "Downingtown STEM Academy", "Downingtown", "PA"],
  [20, "Haas Hall Bentonville", "Bentonville", "AR", "Haas Hall Academy Bentonville"],
  [28, "High Technology High School", "Lincroft", "NJ"],
  [29, "BASIS Prescott", null, "AZ"],
  [38, "BASIS Chandler", null, "AZ"],
  [40, "Edison Academy Magnet School", "Edison", "NJ"],
  [42, "BASIS Mesa", null, "AZ"],
  [50, "University High School", "Tucson", "AZ"],
  [51, "BASIS Scottsdale", null, "AZ"],
  [52, "BASIS Flagstaff", null, "AZ"],
  [58, "BASIS Tucson North", null, "AZ"],
  [59, "Union County Magnet High School", "Scotch Plains", "NJ"],
  [61, "BASIS Ahwatukee", null, "AZ"],
  [62, "BASIS Peoria", null, "AZ"],
  [72, "Biotechnology High School", "Freehold", "NJ"],
  [73, "Brooklyn Latin School", "Brooklyn", "NY"],
  [74, "BASIS Phoenix", null, "AZ"],
  [75, "Woodbridge Academy Magnet School", "Woodbridge", "NJ"],
  [78, "Bergen County Academies", "Hackensack", "NJ"],
  [79, "Gilbert Classical Academy", null, "AZ", "Gilbert Classical Academy High School"],
  [83, "Academy for Information Technology", "Scotch Plains", "NJ"],
  [84, "Bergen County Technical High School", "Teterboro", "NJ", "Bergen County Technical High School - Teterboro"],
  [187, "City Honors School", "Buffalo", "NY", "P.S. 195 - City Honors School"],
  [201, "Baccalaureate School for Global Education", null, "NY"],
]
