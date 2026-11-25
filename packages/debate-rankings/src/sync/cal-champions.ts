/**
 * @fileoverview University of California, Berkeley ("Cal") invitational
 * championship history: Lincoln-Douglas and Public Forum champions,
 * runners-up and top speakers on record. Years on record: 2017, 2018, 2019,
 * 2022 and 2024. Sources: vbriefly's Berkeley recaps
 * ({@link CAL_VBRIEFLY_2017_LD_URL}, {@link CAL_VBRIEFLY_2018_LD_URL},
 * {@link CAL_VBRIEFLY_2019_LD_URL}, {@link CAL_VBRIEFLY_2017_PF_URL}),
 * Victory Briefs' Berkeley results columns
 * ({@link CAL_VB_2022_LD_URL}, {@link CAL_VB_2024_LD_URL},
 * {@link CAL_VB_2019_PF_URL}, {@link CAL_VB_2024_PF_URL}) and the Tournament
 * Directors Intensive results page ({@link CAL_TDI_URL}). School names are
 * kept as the source spells them. Elimination finishes below the title and
 * lower speaker places are not on record for any year.
 * @module sync/cal-champions
 */

import { matchTocSchool, tocSchoolKey } from "./toc-champions"

/** vbriefly's recap of the 2017 Berkeley LD results. */
export const CAL_VBRIEFLY_2017_LD_URL = "https://www.vbriefly.com/2017/02/21/chris-wang-wins-berkeley/"
/** vbriefly's recap of the 2018 Berkeley LD results. */
export const CAL_VBRIEFLY_2018_LD_URL = "https://www.vbriefly.com/2018/02/20/indu-pandey-wins-berkeley/"
/** vbriefly's recap of the 2019 Berkeley LD results. */
export const CAL_VBRIEFLY_2019_LD_URL = "https://www.vbriefly.com/2019/02/20/vishan-chaudhary-wins-cal"
/** vbriefly's recap of the 2017 Berkeley PF results. */
export const CAL_VBRIEFLY_2017_PF_URL = "https://www.vbriefly.com/2017/02/21/nueva-wins-berkeley/"
/** Victory Briefs' column with the 2022 Berkeley LD results. */
export const CAL_VB_2022_LD_URL = "https://victorybriefs.substack.com/p/deven-shah-wins-berkeley"
/** Victory Briefs' column with the 2024 LD and PF tournament results. */
export const CAL_VB_2024_URL = "https://victorybriefs.substack.com/p/214-221-ld-and-pf-tournament-results"
/** Victory Briefs' column with the 2019 Berkeley PF results. */
export const CAL_VB_2019_PF_URL = "https://victorybriefs.substack.com/p/nueva-reclaims-berkeley"
/** Tournament Directors Intensive's results index. */
export const CAL_TDI_URL = "https://blog.debateintensive.org/category/results/"

/** Years with Cal results on record. */
export const CAL_YEARS: readonly number[] = [2017, 2018, 2019, 2022, 2024]

export interface CalResult {
  /** The year the tournament was held (February, so the season's end year). */
  year: number
  event: "Lincoln-Douglas" | "Public Forum"
  place: "Champion" | "Runner-up" | "Top speaker"
  school: string
  /** Competitors, as the source lists them. */
  competitors: string
}

const LD = "Lincoln-Douglas" as const
const PF = "Public Forum" as const

/** LD and PF champions, runners-up and top speakers, oldest first. */
export const CAL_RESULTS: CalResult[] = [
  // 2017 (vbriefly)
  { year: 2017, event: LD, place: "Champion", school: "Lynbrook High School", competitors: "Chris Wang" },
  { year: 2017, event: LD, place: "Runner-up", school: "Success Academy", competitors: "Sekou Cisse" },
  { year: 2017, event: LD, place: "Top speaker", school: "Success Academy", competitors: "Sekou Cisse" },
  { year: 2017, event: PF, place: "Champion", school: "The Nueva School", competitors: "Zubin Aysola & Griffin Tarpenning" },
  { year: 2017, event: PF, place: "Runner-up", school: "Lake Highland Preparatory School", competitors: "Jasper Ou & Anoosh Kumar" },
  // 2018 (vbriefly)
  { year: 2018, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "Indu Pandey" },
  { year: 2018, event: LD, place: "Runner-up", school: "Brentwood School", competitors: "Whit Jackson" },
  // 2019 (vbriefly LD; Victory Briefs PF)
  { year: 2019, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "Vishan Chaudhary" },
  { year: 2019, event: LD, place: "Runner-up", school: "Immaculate Heart High School", competitors: "Lena Mizrahi" },
  { year: 2019, event: LD, place: "Top speaker", school: "Mountain View High School", competitors: "Varun Paranjpe" },
  { year: 2019, event: PF, place: "Champion", school: "The Nueva School", competitors: "Ben Shahar & Ben Cheng" },
  { year: 2019, event: PF, place: "Runner-up", school: "Fairmont Preparatory Academy", competitors: "Matthew Ong & Numair Razzak" },
  // 2022 (Victory Briefs)
  { year: 2022, event: LD, place: "Champion", school: "The Harker School", competitors: "Deven Shah" },
  { year: 2022, event: LD, place: "Runner-up", school: "Sage Hill School", competitors: "Max Perin" },
  { year: 2022, event: LD, place: "Top speaker", school: "Sequoia High School", competitors: "Alyssa Sawyer" },
  // 2024 (Victory Briefs; Tournament Directors Intensive)
  { year: 2024, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "William Liu" },
  { year: 2024, event: LD, place: "Runner-up", school: "The Harker School", competitors: "Ansh Sheth" },
  { year: 2024, event: LD, place: "Top speaker", school: "Oak Ridge High School", competitors: "Arnav Arjula" },
  { year: 2024, event: PF, place: "Champion", school: "The College Preparatory School", competitors: "Ahmad Elassaad & Arnav Ratna" },
  { year: 2024, event: PF, place: "Runner-up", school: "Mission San Jose High School", competitors: "Vedesh Kodnani & Yuvraj Walia" },
  { year: 2024, event: PF, place: "Top speaker", school: "Westridge School", competitors: "Grace Wieland" },
]

/** Every Cal result of one school, by {@link tocSchoolKey} and {@link matchTocSchool}. */
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
