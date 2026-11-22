/**
 * @fileoverview Barkley Forum for High Schools (Emory University) Silver Key
 * winners in Policy ("Pelham Debates"), Lincoln-Douglas and Public Forum:
 * champions and, for Policy and PF, the top speaker. Each year's list comes
 * from the next year's tournament invitation ("RESULTS" section) or, for
 * 2026, the Barkley Forum's tournament page ({@link BARKLEY_SOURCE_URL}).
 * Years on record: 2018 and 2021–2026 (Tabroom's results pages for the
 * other years couldn't be read). Added from other published records:
 * Woodward Academy's own Barkley Forum history (its policy finals and
 * semifinals, 2001–2019, and Avery Dale's 2002 top speaker award, so the
 * 2002 and 2003 titles are Woodward's), and Victory Briefs' 2024 results
 * column (the LD and PF finalists and the LD top speaker).
 * School names are kept as the source spells them, apart from obvious
 * typos ("Flangan").
 * @module sync/barkley-champions
 */

import { matchTocSchool, tocSchoolKey } from "./toc-champions"

/** Woodward Academy's Barkley Forum history page. */
export const BARKLEY_WOODWARD_URL = "https://sites.google.com/a/woodward.edu/debate/accomplishments/the-barkley-forum-at-emory-university"
/** Victory Briefs' column with the 2024 LD and PF results. */
export const BARKLEY_VB_2024_URL = "https://victorybriefs.substack.com/p/124-131-ld-and-pf-tournament-results"

/** The Barkley Forum's own tournament page (lists the latest Silver Key winners). */
export const BARKLEY_SOURCE_URL = "https://barkleyforum.emory.edu/community_outreach/bfhs_tournament.html"

/** Years with results on record. */
export const BARKLEY_YEARS: readonly number[] = [2001, 2002, 2003, 2005, 2006, 2012, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026]

export interface BarkleyResult {
  /** The year the tournament was held (late January, so the season's end year). */
  year: number
  event: "Policy" | "Lincoln-Douglas" | "Public Forum"
  place: "Champion" | "Finalist" | "Semifinalist" | "Top speaker"
  school: string
  competitors: string
}

const P = "Policy" as const
const LD = "Lincoln-Douglas" as const
const PF = "Public Forum" as const

/** Silver Key winners and the finals and semifinals on record, oldest first. */
export const BARKLEY_RESULTS: BarkleyResult[] = [
  // Woodward Academy's Barkley Forum history (its own policy results only)
  { year: 2001, event: P, place: "Finalist", school: "Woodward Academy", competitors: "Avery Dale & Peter Miller" },
  { year: 2002, event: P, place: "Champion", school: "Woodward Academy", competitors: "Genna Cohen & Avery Dale" },
  { year: 2002, event: P, place: "Top speaker", school: "Woodward Academy", competitors: "Avery Dale" },
  { year: 2003, event: P, place: "Champion", school: "Woodward Academy", competitors: "Genna Cohen & Lauren Tanis" },
  { year: 2005, event: P, place: "Semifinalist", school: "Woodward Academy", competitors: "Aliya Bhatia & Seth Gannon" },
  { year: 2006, event: P, place: "Finalist", school: "Woodward Academy", competitors: "Aliya Bhatia & Bobo Bose-Kolanu" },
  { year: 2012, event: P, place: "Semifinalist", school: "Woodward Academy", competitors: "Rahim Shakoor & Jason Sigalos" },
  { year: 2017, event: P, place: "Finalist", school: "Woodward Academy", competitors: "Max Abramson & Tripp Haskins" },
  { year: 2019, event: P, place: "Finalist", school: "Woodward Academy", competitors: "Mona Mahadevan & Malachi Robinson" },
  // 2018 (from the 2019 invitation)
  { year: 2018, event: P, place: "Champion", school: "Greenhill School", competitors: "Christopher Eckert & Samuel Grimsley" },
  { year: 2018, event: P, place: "Top speaker", school: "North Broward Prep", competitors: "Giorgio Rabbini" },
  { year: 2018, event: LD, place: "Champion", school: "The Greenhill School", competitors: "Shruthi Krishnan" },
  { year: 2018, event: PF, place: "Champion", school: "Charles W. Flanagan High School", competitors: "Christian Sheerer & Eden Medina" },
  { year: 2018, event: PF, place: "Top speaker", school: "Charles W. Flanagan High School", competitors: "Christian Sheerer" },
  // 2021 (from the 2022 invitation)
  { year: 2021, event: P, place: "Champion", school: "Bellarmine College Preparatory", competitors: "Adarsh Hiremath & Surya Midha" },
  { year: 2021, event: P, place: "Top speaker", school: "Bellarmine College Preparatory", competitors: "Adarsh Hiremath" },
  { year: 2021, event: LD, place: "Champion", school: "Harvard-Westlake School", competitors: "Andrew Gong" },
  { year: 2021, event: PF, place: "Champion", school: "Bethesda Chevy Chase High School", competitors: "Eli Glickman & Roy Tiefer" },
  { year: 2021, event: PF, place: "Top speaker", school: "Richard Montgomery High School", competitors: "Jennifer Lin" },
  // 2022 (from the 2023 invitation)
  { year: 2022, event: P, place: "Champion", school: "Walter Payton College Prep", competitors: "Cole Weese & David McDermott" },
  { year: 2022, event: P, place: "Top speaker", school: "Berkeley Preparatory School", competitors: "Dhruv Kapadia" },
  { year: 2022, event: LD, place: "Champion", school: "Lexington High School", competitors: "Brett Fortier" },
  { year: 2022, event: PF, place: "Champion", school: "Strake Jesuit College Preparatory", competitors: "Ishan Dubey & Ben Goldin" },
  { year: 2022, event: PF, place: "Top speaker", school: "Blake School", competitors: "Skylar Wang" },
  // 2023 (from the 2024 invitation)
  { year: 2023, event: P, place: "Champion", school: "Alpharetta High School", competitors: "Anish Thatiparthi & Eshan Momin" },
  { year: 2023, event: P, place: "Top speaker", school: "Peninsula High School", competitors: "Coralynn Yang" },
  { year: 2023, event: LD, place: "Champion", school: "Strake Jesuit College Preparatory", competitors: "Nathan Wei" },
  { year: 2023, event: PF, place: "Champion", school: "Strake Jesuit College Preparatory", competitors: "Ishan Dubey & John Yates" },
  { year: 2023, event: PF, place: "Top speaker", school: "L.C. Anderson High School", competitors: "Ilan Ben-Avi" },
  // 2024 (from the 2025 invitation)
  { year: 2024, event: P, place: "Champion", school: "Liberal Arts and Science Academy", competitors: "Eleanor Barrett & Jack Dollinger" },
  { year: 2024, event: P, place: "Top speaker", school: "Liberal Arts and Science Academy", competitors: "Eleanor Barrett" },
  { year: 2024, event: LD, place: "Champion", school: "Lake Highland Preparatory School", competitors: "Harris Layson" },
  { year: 2024, event: LD, place: "Finalist", school: "Westlake High School", competitors: "Miller Roberts" },
  { year: 2024, event: LD, place: "Top speaker", school: "Marlborough School", competitors: "Wyeth Renwick" },
  { year: 2024, event: PF, place: "Champion", school: "The Blake School", competitors: "Zellie Olson & Eva Redmond" },
  { year: 2024, event: PF, place: "Finalist", school: "Durham Academy", competitors: "Michael Hansen & Alex Huang" },
  { year: 2024, event: PF, place: "Top speaker", school: "Strake Jesuit College Preparatory", competitors: "Jason Zhao" },
  // 2025 (from the 2026 invitation)
  { year: 2025, event: P, place: "Champion", school: "Berkeley Preparatory School", competitors: "Sameer Varkantham & Michael Ross" },
  { year: 2025, event: P, place: "Top speaker", school: "Berkeley Preparatory School", competitors: "Michael Ross" },
  { year: 2025, event: LD, place: "Champion", school: "The Greenhill School", competitors: "Sarah Koshy" },
  { year: 2025, event: PF, place: "Champion", school: "The Blake School", competitors: "Kaylee Chen & Ruhi Kurdikar" },
  { year: 2025, event: PF, place: "Top speaker", school: "Strake Jesuit College Preparatory", competitors: "Jason Zhao" },
  // 2026 (from the Barkley Forum's tournament page)
  { year: 2026, event: P, place: "Champion", school: "Montgomery Bell Academy", competitors: "Russell Howard & Jimmy Li" },
  { year: 2026, event: P, place: "Top speaker", school: "Taipei American School", competitors: "Jordan Yao" },
  { year: 2026, event: LD, place: "Champion", school: "Peninsula High School", competitors: "Sterling Utovac" },
  { year: 2026, event: PF, place: "Champion", school: "Strake Jesuit College Preparatory", competitors: "Mac Stratton & Sumith Murthy" },
  { year: 2026, event: PF, place: "Top speaker", school: "Lexington High School", competitors: "Siddharth Revankar" },
]

/** Every Barkley Forum result of one school, by {@link tocSchoolKey} and {@link matchTocSchool} like the TOC record. */
export function findBarkleySchoolResults(school: string, results: readonly BarkleyResult[] = BARKLEY_RESULTS): BarkleyResult[] {
  const bySchool = new Map<string, { school: string; results: BarkleyResult[] }>()
  for (const result of results) {
    const key = tocSchoolKey(result.school)
    const entry = bySchool.get(key) ?? { school: result.school, results: [] }
    entry.results.push(result)
    bySchool.set(key, entry)
  }
  return matchTocSchool(school, [...bySchool.values()])?.results ?? []
}
