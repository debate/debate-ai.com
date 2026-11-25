/**
 * @fileoverview U.S. News & World Report 2027 Best National Universities,
 * ranks 1-100 (108 schools, ties share a rank), released 2026-09-22.
 *
 * Ranks and names were copied from Poets & Quants for Undergrads' table of
 * the top 100 (ranks 1-11 cross-checked against Master Grad Schools' guide),
 * fetched 2026-11-22. Neither source gives a state or a public / private
 * flag, so those two columns are filled in from each school's location and
 * control; they are facts about the school, not part of the ranking.
 *
 * {@link COLLEGES_OUTSIDE_TOP_100} adds the colleges that have a wordmark in
 * `@debate-ai/icons` but are not in the top 100, with no rank: the bundled
 * list stops at 100, so their U.S. News rank is a known gap, not "unranked".
 * @module data/colleges-usnews
 */

/** Where the college ranks come from. */
export const COLLEGE_RANK_SOURCE = {
  list: "U.S. News 2027 Best National Universities",
  edition: "2027",
  published: "2026-09-22",
  url: "https://www.usnews.com/best-colleges/rankings/national-universities",
  via: [
    "https://poetsandquantsforundergrads.com/news/u-s-news-best-colleges-ranking-2027-mit-ends-princetons-long-run-at-the-top/2/",
    "https://mastergradschools.com/master-rankings/us-news-best-national-universities-rankings-2027",
  ],
} as const

/** `[U.S. News rank, name, state, control, other names]`. */
export type CollegeRow = readonly [
  rank: number | null,
  name: string,
  state: string,
  type: "public" | "private",
  aliases?: readonly string[],
]

/** The 2027 top 100, best first, in the source's order within a tie. */
export const COLLEGE_ROWS: readonly CollegeRow[] = [
  [1, "Massachusetts Institute of Technology", "MA", "private", ["MIT"]],
  [2, "Princeton University", "NJ", "private", ["Princeton"]],
  [3, "Harvard University", "MA", "private", ["Harvard"]],
  [4, "Yale University", "CT", "private", ["Yale"]],
  [5, "California Institute of Technology", "CA", "private", ["Caltech"]],
  [5, "Stanford University", "CA", "private", ["Stanford"]],
  [7, "University of Pennsylvania", "PA", "private", ["Penn", "UPenn"]],
  [8, "Duke University", "NC", "private", ["Duke"]],
  [9, "Johns Hopkins University", "MD", "private", ["Johns Hopkins", "JHU"]],
  [9, "Northwestern University", "IL", "private", ["Northwestern", "NU"]],
  [9, "University of Chicago", "IL", "private", ["UChicago", "Chicago"]],
  [12, "Columbia University", "NY", "private", ["Columbia"]],
  [12, "Dartmouth College", "NH", "private", ["Dartmouth"]],
  [14, "Carnegie Mellon University", "PA", "private", ["CMU", "Carnegie Mellon"]],
  [14, "Cornell University", "NY", "private", ["Cornell"]],
  [16, "Brown University", "RI", "private", ["Brown"]],
  [16, "Rice University", "TX", "private", ["Rice"]],
  [16, "Vanderbilt University", "TN", "private", ["Vanderbilt", "Vandy"]],
  [16, "Washington University in St. Louis", "MO", "private", ["WashU", "WUSTL"]],
  [20, "University of California, Berkeley", "CA", "public", ["UC Berkeley", "Cal", "Berkeley"]],
  [20, "University of California, Los Angeles", "CA", "public", ["UCLA"]],
  [20, "University of Notre Dame", "IN", "private", ["Notre Dame"]],
  [23, "Emory University", "GA", "private", ["Emory"]],
  [23, "Georgetown University", "DC", "private", ["Georgetown", "Gtown"]],
  [25, "University of Michigan–Ann Arbor", "MI", "public", ["Michigan", "UMich"]],
  [26, "University of Virginia", "VA", "public", ["UVA", "Virginia"]],
  [27, "University of North Carolina–Chapel Hill", "NC", "public", ["UNC", "North Carolina"]],
  [27, "University of Southern California", "CA", "private", ["USC", "Southern California"]],
  [29, "Georgia Institute of Technology", "GA", "public", ["Georgia Tech", "GT"]],
  [29, "University of California San Diego", "CA", "public", ["UCSD", "UC San Diego"]],
  [31, "Boston College", "MA", "private", ["BC"]],
  [31, "New York University", "NY", "private", ["NYU"]],
  [31, "Tufts University", "MA", "private", ["Tufts"]],
  [34, "Boston University", "MA", "private", ["BU"]],
  [34, "University of California, Davis", "CA", "public", ["UC Davis"]],
  [34, "University of California, Irvine", "CA", "public", ["UC Irvine", "UCI"]],
  [34, "University of Florida", "FL", "public", ["UF", "Florida"]],
  [34, "University of Illinois Urbana-Champaign", "IL", "public", ["UIUC", "Illinois"]],
  [34, "University of Texas–Austin", "TX", "public", ["UT Austin", "Texas"]],
  [34, "University of Wisconsin–Madison", "WI", "public", ["UW-Madison", "Wisconsin"]],
  [34, "Wake Forest University", "NC", "private", ["Wake Forest", "Wake"]],
  [42, "Northeastern University", "MA", "private", ["Northeastern"]],
  [42, "Villanova University", "PA", "private", ["Villanova"]],
  [44, "Case Western Reserve University", "OH", "private", ["Case Western", "CWRU"]],
  [44, "Lehigh University", "PA", "private", ["Lehigh"]],
  [44, "The Ohio State University", "OH", "public", ["Ohio State", "OSU"]],
  [44, "Rutgers University–New Brunswick", "NJ", "public", ["Rutgers"]],
  [44, "University of California, Santa Barbara", "CA", "public", ["UCSB"]],
  [49, "University of Maryland, College Park", "MD", "public", ["UMD", "Maryland"]],
  [49, "University of Rochester", "NY", "private", ["Rochester"]],
  [49, "University of Washington", "WA", "public", ["UW", "Washington"]],
  [52, "University of Georgia", "GA", "public", ["UGA", "Georgia"]],
  [52, "Virginia Tech", "VA", "public", ["VT"]],
  [52, "William & Mary", "VA", "public", ["William and Mary", "W&M"]],
  [55, "Pennsylvania State University–University Park", "PA", "public", ["Penn State", "PSU"]],
  [55, "Purdue University–Main Campus", "IN", "public", ["Purdue"]],
  [55, "Santa Clara University", "CA", "private", ["Santa Clara"]],
  [55, "University of Miami", "FL", "private", ["Miami"]],
  [59, "Brandeis University", "MA", "private", ["Brandeis"]],
  [59, "Florida State University", "FL", "public", ["FSU"]],
  [59, "George Washington University", "DC", "private", ["GWU", "GW"]],
  [59, "Stevens Institute of Technology", "NJ", "private", ["Stevens"]],
  [59, "Stony Brook University–SUNY", "NY", "public", ["Stony Brook"]],
  [59, "Texas A&M University", "TX", "public", ["Texas A&M", "TAMU"]],
  [59, "Tulane University of Louisiana", "LA", "private", ["Tulane"]],
  [59, "University of Massachusetts–Amherst", "MA", "public", ["UMass Amherst", "UMass"]],
  [59, "University of Minnesota–Twin Cities", "MN", "public", ["Minnesota", "UMN"]],
  [59, "University of Pittsburgh", "PA", "public", ["Pitt"]],
  [69, "Michigan State University", "MI", "public", ["Michigan State", "MSU"]],
  [69, "Rensselaer Polytechnic Institute", "NY", "private", ["RPI"]],
  [69, "University of California, Merced", "CA", "public", ["UC Merced"]],
  [72, "Syracuse University", "NY", "private", ["Syracuse"]],
  [73, "Binghamton University–SUNY", "NY", "public", ["Binghamton"]],
  [73, "Howard University", "DC", "private", ["Howard"]],
  [73, "Indiana University–Bloomington", "IN", "public", ["Indiana", "IU"]],
  [73, "North Carolina State University", "NC", "public", ["NC State"]],
  [73, "Rutgers University–Newark", "NJ", "public", ["Rutgers Newark"]],
  [73, "University of Connecticut", "CT", "public", ["UConn"]],
  [73, "Worcester Polytechnic Institute", "MA", "private", ["WPI"]],
  [80, "Clemson University", "SC", "public", ["Clemson"]],
  [80, "Colorado School of Mines", "CO", "public", ["Mines"]],
  [80, "Drexel University", "PA", "private", ["Drexel"]],
  [80, "Pepperdine University", "CA", "private", ["Pepperdine"]],
  [80, "University of California, Riverside", "CA", "public", ["UC Riverside", "UCR"]],
  [85, "Fordham University", "NY", "private", ["Fordham"]],
  [85, "New Jersey Institute of Technology", "NJ", "public", ["NJIT"]],
  [85, "Southern Methodist University", "TX", "private", ["SMU"]],
  [85, "University at Buffalo–SUNY", "NY", "public", ["Buffalo", "UB"]],
  [85, "University of Delaware", "DE", "public", ["Delaware", "UD"]],
  [90, "Baylor University", "TX", "private", ["Baylor"]],
  [90, "Gonzaga University", "WA", "private", ["Gonzaga"]],
  [90, "Marquette University", "WI", "private", ["Marquette"]],
  [90, "Texas Christian University", "TX", "private", ["TCU"]],
  [90, "Yeshiva University", "NY", "private", ["Yeshiva"]],
  [95, "American University", "DC", "private", ["American"]],
  [95, "Rochester Institute of Technology", "NY", "private", ["RIT"]],
  [95, "Rutgers University–Camden", "NJ", "public", ["Rutgers Camden"]],
  [95, "University of Illinois Chicago", "IL", "public", ["UIC"]],
  [95, "University of Missouri", "MO", "public", ["Mizzou", "Missouri"]],
  [100, "Auburn University", "AL", "public", ["Auburn"]],
  [100, "Chapman University", "CA", "private", ["Chapman"]],
  [100, "Creighton University", "NE", "private", ["Creighton"]],
  [100, "Elon University", "NC", "private", ["Elon"]],
  [100, "Florida International University", "FL", "public", ["FIU"]],
  [100, "Saint Louis University", "MO", "private", ["SLU"]],
  [100, "University of Iowa", "IA", "public", ["Iowa"]],
  [100, "University of San Diego", "CA", "private", ["USD"]],
  [100, "University of South Florida", "FL", "public", ["USF", "South Florida"]],
]

/**
 * Colleges with a wordmark in `@debate-ai/icons` that are not in the bundled
 * top 100. Most have no rank bundled here (`null`: the rank exists but is not
 * sourced); Kansas and Kentucky are at rank 148. Macalester and Redlands are
 * ranked on other U.S. News lists (National Liberal Arts Colleges and Regional
 * Universities West) rather than National Universities.
 */
export const COLLEGES_OUTSIDE_TOP_100: readonly CollegeRow[] = [
  [null, "California State University, Long Beach", "CA", "public", ["CSU Long Beach", "Long Beach State", "CSULB"]],
  [null, "George Mason University", "VA", "public", ["George Mason", "GMU"]],
  [null, "University of Houston", "TX", "public", ["Houston", "UH"]],
  [148, "University of Kansas", "KS", "public", ["Kansas", "KU"]],
  [148, "University of Kentucky", "KY", "public", ["Kentucky", "UK"]],
  [null, "Liberty University", "VA", "private", ["Liberty"]],
  [null, "Loyola University Chicago", "IL", "private", ["Loyola Chicago", "LUC"]],
  [null, "Macalester College", "MN", "private", ["Macalester", "Mac"]],
  [null, "University of North Texas", "TX", "public", ["North Texas", "UNT"]],
  [null, "University of Oklahoma", "OK", "public", ["Oklahoma", "OU"]],
  [null, "University of Redlands", "CA", "private", ["Redlands"]],
  [null, "Towson University", "MD", "public", ["Towson"]],
  [null, "University of Texas at Dallas", "TX", "public", ["UT Dallas", "UTD"]],
  [null, "Western Kentucky University", "KY", "public", ["Western Kentucky", "WKU"]],
]
