/**
 * @fileoverview The Cal Invitational at UC Berkeley ("the Cal", "Berkeley"),
 * a February high school national in Lincoln-Douglas and Public Forum:
 * champions, finalists (the team that lost the final) and the top speaker.
 * School pages count a Cal win as a championship alongside the TOC and NDCA.
 * Not to be confused with the Barkley Forum at Emory
 * ({@link module:sync/barkley-champions}).
 *
 * Years on record: LD 2017–2019, 2022 and 2024; PF 2017–2019 and 2024, from
 * Victory Briefs' tournament write-ups ({@link CAL_SOURCE_URLS}). Tabroom's
 * own results pages couldn't be read, so the other years (and the
 * semifinalists) are left out rather than guessed. School names are kept as
 * the source spells them.
 * @module sync/berkeley-champions
 */

import { matchTocSchool, tocSchoolKey } from "./toc-champions"

/** Victory Briefs' write-ups each year's results come from. */
export const CAL_SOURCE_URLS: Readonly<Record<string, string>> = {
  "2017 LD": "https://www.vbriefly.com/2017/02/21/chris-wang-wins-berkeley/",
  "2017 PF": "https://victorybriefs.substack.com/p/nueva-wins-berkeley",
  "2018 LD": "https://www.vbriefly.com/2018/02/20/indu-pandey-wins-berkeley/",
  "2018 PF": "https://victorybriefs.substack.com/p/millburn-wins-berkeley",
  "2019 LD": "https://www.vbriefly.com/2019/02/20/vishan-chaudhary-wins-cal",
  "2019 PF": "https://victorybriefs.substack.com/p/nueva-reclaims-berkeley",
  "2022 LD": "https://victorybriefs.substack.com/p/deven-shah-wins-berkeley",
  "2024": "https://victorybriefs.substack.com/p/214-221-ld-and-pf-tournament-results",
}

/** Years with results on record. */
export const CAL_YEARS: readonly number[] = [2017, 2018, 2019, 2022, 2024]

export interface CalResult {
  /** The year the tournament was held (mid-February, so the season's end year). */
  year: number
  event: "Lincoln-Douglas" | "Public Forum"
  place: "Champion" | "Finalist" | "Top speaker"
  school: string
  competitors: string
}

const LD = "Lincoln-Douglas" as const
const PF = "Public Forum" as const

/** Cal Invitational finals and top speakers on record, oldest first. */
export const CAL_RESULTS: CalResult[] = [
  // 2017
  { year: 2017, event: LD, place: "Champion", school: "Lynbrook High School", competitors: "Chris Wang" },
  { year: 2017, event: LD, place: "Finalist", school: "Success Academy", competitors: "Sekou Cisse" },
  { year: 2017, event: LD, place: "Top speaker", school: "Success Academy", competitors: "Sekou Cisse" },
  { year: 2017, event: PF, place: "Champion", school: "Nueva School", competitors: "Zubin Aysola & Griffin Tarpenning" },
  { year: 2017, event: PF, place: "Finalist", school: "Lake Highland Preparatory School", competitors: "Jasper Ou & Anoosh Kumar" },
  { year: 2017, event: PF, place: "Top speaker", school: "Mission San Jose High School", competitors: "Steven Shi" },
  // 2018
  { year: 2018, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "Indu Pandey" },
  { year: 2018, event: LD, place: "Finalist", school: "Brentwood School", competitors: "Whit Jackson" },
  { year: 2018, event: PF, place: "Champion", school: "Millburn High School", competitors: "Brian Zhu & James Chen" },
  { year: 2018, event: PF, place: "Finalist", school: "Presentation High School", competitors: "Laurenn Vives & Megan Munce" },
  // 2019
  { year: 2019, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "Vishan Chaudhary" },
  { year: 2019, event: LD, place: "Finalist", school: "Immaculate Heart High School", competitors: "Lena Mizrahi" },
  { year: 2019, event: LD, place: "Top speaker", school: "Mountain View High School", competitors: "Varun Paranjpe" },
  { year: 2019, event: PF, place: "Champion", school: "Nueva School", competitors: "Ben Shahar & Ben Cheng" },
  { year: 2019, event: PF, place: "Finalist", school: "Fairmont Preparatory Academy", competitors: "Matthew Ong & Numair Razzak" },
  // 2022
  { year: 2022, event: LD, place: "Champion", school: "The Harker School", competitors: "Deven Shah" },
  { year: 2022, event: LD, place: "Finalist", school: "Sage Hill School", competitors: "Max Perin" },
  { year: 2022, event: LD, place: "Top speaker", school: "Sequoia High School", competitors: "Alyssa Sawyer" },
  // 2024
  { year: 2024, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "William Liu" },
  { year: 2024, event: LD, place: "Finalist", school: "The Harker School", competitors: "Ansh Sheth" },
  { year: 2024, event: LD, place: "Top speaker", school: "Oak Ridge Independent", competitors: "Arnav Arjula" },
  { year: 2024, event: PF, place: "Champion", school: "College Preparatory School", competitors: "Ahmad Elassaad & Arnav Ratna" },
  { year: 2024, event: PF, place: "Finalist", school: "Mission San Jose High School", competitors: "Vedesh Kodnani & Yuvraj Walia" },
  { year: 2024, event: PF, place: "Top speaker", school: "Westridge School", competitors: "Grace Wieland" },
]

/** Every Cal Invitational result of one school, by {@link tocSchoolKey} and {@link matchTocSchool} like the TOC record. */
export function findCalSchoolResults(school: string, results: readonly CalResult[] = CAL_RESULTS): CalResult[] {
  const bySchool = new Map<string, { school: string; results: CalResult[] }>()
  for (const result of results) {
    const key = tocSchoolKey(result.school)
    const entry = bySchool.get(key) ?? { school: result.school, results: [] }
    entry.results.push(result)
    bySchool.set(key, entry)
  }
  return matchTocSchool(school, [...bySchool.values()])?.results ?? []
}
