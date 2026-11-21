/**
 * @fileoverview Wake Forest's Franklin R. Shirley Classic: every champion and
 * runner-up from 1956 to 2022, as Wake Forest's historical winners list
 * records them. College policy school pages list each school's Shirley
 * championships and second places.
 *
 * Gaps are kept as gaps: the archive skips 1994, 2007 and 2008 and stops at
 * 2022, and the 2023–2026 winners are not yet verified. Names are kept as the
 * archive spells them, surname-only entries included.
 * @module sync/shirley-results
 */

import { coreSchoolName } from "./ceda-champions"

/** Where the archive's winners list lives. */
export const SHIRLEY_SOURCE_URL = "https://debate.wfu.edu/history/historical-lists/shirley-debate-tournament-winners/"

/** Where the finals the archive lacks (2007, 2008, 2023 on) come from. */
export const SHIRLEY_BRACKETS_URL = "https://collegedebateresults.vercel.app"

export type ShirleyPlace = "Champion" | "Second place"

export interface ShirleyResult {
  year: number
  place: ShirleyPlace
  /** The school, by its current name. */
  school: string
  /** Debaters, as the archive lists them; absent when it lists none. */
  team?: string
  /** The school's name at the time, when it has since changed. */
  formerName?: string
  /** Anything unusual about the result (format, ties, a second edition). */
  note?: string
  /** Held in February, so it belongs to the season ending that spring rather than the next one. */
  february?: boolean
}

/**
 * The season a Shirley final belongs to, named by the year it ends in (as
 * program strength names seasons): the November tournament opens the next
 * season (Nov 2024 is 2024–25, so 2025); the two February editions belong to
 * the season ending that spring.
 */
export function shirleySeasonYear(result: Pick<ShirleyResult, "year" | "february">): number {
  return result.february ? result.year : result.year + 1
}

/** Years with no recorded final, and why. */
export const SHIRLEY_NO_RESULT: Record<number, string> = {
  1994: "No result listed; the archive notes a move to February",
}

const FOUR_PERSON = "Four-person debate"
const TOP_AFF = "Top affirmative team"
const TOP_NEG = "Top negative team"
const MICHIGAN_1996 = "Michigan-hosted edition"
const FEB = { february: true }
const SECOND_1996 = "Second 1996 edition"

const C = (year: number, school: string, team?: string, extra: Partial<ShirleyResult> = {}): ShirleyResult => ({
  year,
  place: "Champion",
  school,
  ...(team ? { team } : {}),
  ...extra,
})
const S = (year: number, school: string, team?: string, extra: Partial<ShirleyResult> = {}): ShirleyResult => ({
  year,
  place: "Second place",
  school,
  ...(team ? { team } : {}),
  ...extra,
})

const FLORIDA = "University of Florida"
const DUKE = "Duke University"
const PITT = "University of Pittsburgh"
const KENTUCKY = "University of Kentucky"
const NOTRE_DAME = "University of Notre Dame"
const GWU = "George Washington University"
const WM = "College of William & Mary"
const SOUTH_CAROLINA = "University of South Carolina"
const WAYNE = "Wayne State University"
const VERMONT = "University of Vermont"
const GEORGETOWN = "Georgetown University"
const CANISIUS = "Canisius University"
const WLU = "Washington and Lee University"
const RICHMOND = "University of Richmond"
const MARIETTA = "Marietta College"
const DETROIT = "University of Detroit Mercy"
const GEORGIA = "University of Georgia"
const NORTHWESTERN = "Northwestern University"
const SYRACUSE = "Syracuse University"
const WEST_GEORGIA = "University of West Georgia"
const VIRGINIA = "University of Virginia"
const REDLANDS = "University of Redlands"
const USC = "University of Southern California"
const CATHOLIC = "Catholic University of America"
const KANSAS = "University of Kansas"
const UCF = "University of Central Florida"
const DARTMOUTH = "Dartmouth College"
const HARVARD = "Harvard University"
const BATES = "Bates College"
const UNC = "University of North Carolina at Chapel Hill"
const UMASS = "University of Massachusetts Amherst"
const MICHIGAN = "University of Michigan"
const BAYLOR = "Baylor University"
const IOWA = "University of Iowa"
const TEXAS = "University of Texas"
const EMORY = "Emory University"
const WAKE = "Wake Forest University"
const LOUISVILLE = "University of Louisville"
const BERKELEY = "University of California, Berkeley"
const FORT_HAYS = "Fort Hays State University"
const MSU = "Michigan State University"
const OKLAHOMA = "University of Oklahoma"
const BINGHAMTON = "Binghamton University"

const WGC = { formerName: "West Georgia College" }
const CANISIUS_COLLEGE = { formerName: "Canisius College" }
const DETROIT_FORMER = { formerName: "University of Detroit" }

export const SHIRLEY_RESULTS: ShirleyResult[] = [
  C(1956, FLORIDA, "Harold Eisner, Joe Schwartz & unidentified teammates", { note: FOUR_PERSON }),
  S(1956, DUKE, "Dick Weed & unidentified teammates", { note: FOUR_PERSON }),
  C(1957, PITT, "Dick Mattern, Garr Hess, John Strauch & Jim Pomarico", { note: FOUR_PERSON }),
  S(1957, FLORIDA, undefined, { note: FOUR_PERSON }),
  C(1958, KENTUCKY, undefined, { note: FOUR_PERSON }),
  S(1958, NOTRE_DAME, undefined, { note: FOUR_PERSON }),
  C(1959, GWU, "David Aaronson & Al Capp", { note: TOP_AFF }),
  S(1959, WM, "William Goddard & Tony Seinmeyer", { note: TOP_NEG }),
  C(1960, WM),
  S(1960, FLORIDA),
  C(1961, FLORIDA, "Bill Biglow & Bill McCormick"),
  S(1961, SOUTH_CAROLINA, "Eddie Roberts & Jim Mann"),
  C(1962, WAYNE),
  S(1962, VERMONT),
  C(1963, SOUTH_CAROLINA, "Toby Van Buren & Frank Cantrell"),
  S(1963, GEORGETOWN, "Richard Hayes & unidentified partner"),
  C(1964, WAYNE, "David Ling & Doug Frost"),
  S(1964, GWU, "Dion Meek & unidentified partner"),
  C(1965, CANISIUS, "Tom Farrell & Tom Elmer", CANISIUS_COLLEGE),
  S(1965, WLU, "Chris Mills & unidentified partner"),
  C(1966, RICHMOND, "Tim Finchem & Robert Cox"),
  S(1966, MARIETTA),
  C(1967, SOUTH_CAROLINA, "Bob Salane & Tom Salene"),
  S(1967, DETROIT, "Steve Kempski & David Peruch", DETROIT_FORMER),
  C(1968, CANISIUS, "Shimminger & Wagner", CANISIUS_COLLEGE),
  S(1968, GEORGIA, "McCurley & Brussack"),
  C(1969, NORTHWESTERN, "Ken Strange & Steve Gunderson"),
  S(1969, SYRACUSE),
  C(1970, GWU, "Michael Newcity & Mary Alyce McKeen"),
  S(1970, WEST_GEORGIA, "Barry Banther & Tom Greer", WGC),
  C(1971, VIRGINIA, "Thrash & Bittner"),
  S(1971, GWU, "Ledford & Pistolessi"),
  C(1972, WEST_GEORGIA, "Elliott Pood & Barry Barther", WGC),
  S(1972, REDLANDS, "Pat Webb & Hanson"),
  C(1973, USC, "Higelin & Hozduk"),
  S(1973, USC, "Solum & Johnson"),
  C(1974, NORTHWESTERN, "Erwin Chemerinksy & Alan Lowenshohn"),
  S(1974, REDLANDS, "Conrad Clark & Pat Webb"),
  C(1975, NORTHWESTERN, "Alan Lowinsohn & Louis Kaplow"),
  S(1975, CATHOLIC, "Chris Mooney & Geoff Ringer"),
  C(1976, KANSAS, "Frank Cross & Robin Rowland"),
  S(1976, GEORGIA, "Richard Lively & Jon Bow"),
  C(1977, USC, "Steve Combs & Jon Cassonelli"),
  S(1977, REDLANDS, "Mark Beltramo & Paul McNamara"),
  C(1978, WEST_GEORGIA, "Paul Weathington & Randy Evans", WGC),
  S(1978, KANSAS, "Kevin Fowler & Steve Griffin"),
  C(1979, REDLANDS, "Bill Isaacson & Lane Bearden"),
  S(1979, UCF, "Barry Ragsdale & Jeff Liddicoat"),
  C(1980, DARTMOUTH, "Tom Lyon & Cy Smith"),
  S(1980, WEST_GEORGIA, "Paul Weathington & Kelli Sager", WGC),
  C(1981, KENTUCKY, "Condon McGlothlin & Steve Mancuso"),
  S(1981, KANSAS, "Mark Gidley & Zac Grant"),
  C(1982, DARTMOUTH, "Robin Jacobsohn & Tom Lyon"),
  S(1982, HARVARD, "Jonathan Massey & Jonathan Weiner"),
  C(1983, HARVARD, "Jonathan Weiner & Johnathan Massey"),
  S(1983, BATES, "Steven Dolley & Glenn Graham"),
  C(1984, BATES, "Glenn Graham & Paul Rostenthal"),
  S(1984, NORTHWESTERN, "Doug Segal & Lyn Coyne"),
  C(1985, UNC, "Michael Egues & Jeremy Ofseyer"),
  S(1985, UMASS, "Danny Povenelli & Mark Friedman"),
  C(1986, KANSAS, "John Culver & George Lopez"),
  S(1986, REDLANDS, "Jeff Leon & Jeff LaFave"),
  C(1987, NORTHWESTERN, "Gordon Mitchell & Ben Attias"),
  S(1987, MICHIGAN, "Michael Green & Andrew Schrank"),
  C(1988, NORTHWESTERN, "Gordon Mitchell & Danny Reiter"),
  S(1988, BAYLOR, "Danny Plants & Marty Loeber"),
  C(1989, IOWA, "Nathan Coco & Chuck Smith"),
  S(1989, DARTMOUTH, "Neal Katyal & Scott Groussman"),
  C(1990, REDLANDS, "Rodger Cole & Marc Rubinstein"),
  S(1990, TEXAS, "Derek Jinks & Ryan Goodman"),
  C(1991, DARTMOUTH, "Kenny Agran & Ara Lovitt"),
  S(1991, GEORGETOWN, "Ahilan Arulanantham & Kevin Kuswa"),
  C(1992, GEORGETOWN, "Ahilan Arulanantham & Eric Truett"),
  S(1992, DARTMOUTH, "Ara Lovitt & Steven Sklaver"),
  C(1993, HARVARD, "Stephen Andrews & Fred Karem"),
  S(1993, GEORGETOWN, "Ahilan Arulanantham & Lars Berg"),
  C(1995, DARTMOUTH, "Andre Hylton & Marc Wilson", FEB),
  S(1995, EMORY, "Charlie Henn & Jamie McKown", FEB),
  C(1996, NORTHWESTERN, "Shawn McCaffity & Mason Miller", { note: MICHIGAN_1996, ...FEB }),
  S(1996, WAKE, "Brian Prestes & John Hughes", { note: MICHIGAN_1996, ...FEB }),
  C(1996, MICHIGAN, "Scott Hessell & Corey Stoughton", { note: SECOND_1996 }),
  S(1996, LOUISVILLE, "Dave Arnett & Jason Renzelmann", { note: SECOND_1996 }),
  C(1997, DARTMOUTH, "David Hung & Steven Lehotsky"),
  S(1997, HARVARD, "Sonja Starr & Carl Engstrom"),
  C(1998, EMORY, "Steven Bailey & Kamal Ghali"),
  S(1998, EMORY, "Larry Heftman & Jeff McNabb"),
  C(1999, KANSAS, "Grant McKeehen & Mike Eber"),
  S(1999, IOWA, "Kristen Langwell & Andy Ryan"),
  C(2000, BERKELEY, "Randy Luskey & Dan Shalmon"),
  S(2000, TEXAS, "Krik Evans & Loe Hornbuckle"),
  C(2001, NORTHWESTERN, "Foster & Paul", { note: "Listed as a tie" }),
  S(2001, NORTHWESTERN, "Gadddipati & Lux", { note: "Listed second in a tie" }),
  C(2002, NORTHWESTERN, "Garen & Morales"),
  S(2002, FORT_HAYS, "Regnier & Saindon"),
  C(2003, BERKELEY, "Shalmon & Singh"),
  S(2003, GEORGIA, "Watson & Ramachandrappa"),
  C(2004, NORTHWESTERN, "Tristan Morales & Josh Branson"),
  S(2004, EMORY, "Bob Allen & Scott Phillips"),
  C(2005, HARVARD, "Michael Klinger & Nikhill Mirchandani"),
  S(2005, MSU, "Ryan Burke & Casey Harrigan"),
  C(2006, OKLAHOMA, "Conor Cleary & Blake Johnson"),
  S(2006, GEORGIA, "Brent Culpepper & Kevin Rabinowitz"),
  C(2007, HARVARD, "Anders & Murray"),
  S(2007, DARTMOUTH, "Kernoff & Olsen"),
  C(2008, NORTHWESTERN, "Fisher & Warden"),
  S(2008, KANSAS, "Bricker & Johnson"),
  C(2009, NORTHWESTERN, "Matt Fisher & Stephanie Spies"),
  S(2009, EMORY, "Stephen Weil & Ovais Inamullah"),
  C(2010, KANSAS, "Sean Kennedy & Dylan Quigley"),
  S(2010, EMORY, "Stephen Weil & Ovais Inamullah"),
  C(2011, NORTHWESTERN, "Layne Kirshon & Ryan Beiermeister", { note: "Co-champions" }),
  C(2011, NORTHWESTERN, "Peyton Lee & Arjun Vellayappan", { note: "Co-champions" }),
  C(2012, NORTHWESTERN, "Peyton Lee & Arjun Vellayappan"),
  S(2012, WEST_GEORGIA, "Miguel Feliciano & Damiyr Davis"),
  C(2013, NORTHWESTERN, "Alex Miles & Arjun Vellayappan"),
  S(2013, HARVARD, "Bradley Bolman & Michael Suo"),
  C(2014, NORTHWESTERN, "Alex Miles & Arjun Vellayapan"),
  S(2014, MICHIGAN, "Ellis Allen & Alex Pappas"),
  C(2015, MICHIGAN, "Joe Krakoff & Will Morgan"),
  S(2015, NORTHWESTERN, "Evan McCarty & Connor O'Brien"),
  C(2016, HARVARD, "Ayush Midha & Hemanth Sanjeev"),
  S(2016, USC, "Aron Berger & Beau Larsen"),
  C(2017, KANSAS, "Will Katz & Quaram Robinson"),
  S(2017, EMORY, "Saul Forman & Alex Gazmararian"),
  C(2018, KENTUCKY, "Dan Bannister & Anthony Trufanov"),
  S(2018, OKLAHOMA, "Nicolas Juarez & Jacob Smith"),
  C(2019, BERKELEY, "Miles Gray & Nathan Fleming"),
  S(2019, MICHIGAN, "Rafael Pierry & Giorgio Rabbini"),
  C(2020, MICHIGAN, "Rafael Pierry & Giorgio Rabbini"),
  S(2020, DARTMOUTH, "Raam Tambe & Tyler Vergho"),
  C(2021, MICHIGAN, "Rafael Pierry & Giorgio Rabbini"),
  S(2021, NORTHWESTERN, "Nina Fridman & Deo Akash"),
  C(2022, MICHIGAN, "Kelly Phil & Rafael Pierry"),
  S(2022, WAKE, "Tajaih Robinson & Iyana Trotman"),
  C(2023, EMORY, "Kessler & Rajagopal"),
  S(2023, WAKE, "Dua & Smith"),
  C(2024, BINGHAMTON, "Cohn & T. Louis"),
  S(2024, MICHIGAN, "Barrett & Park"),
  C(2025, KANSAS, "Larson & Schultz"),
  S(2025, EMORY, "Gallagher & Song"),
  C(2026, EMORY, "Gallagher & Young"),
  S(2026, MICHIGAN, "Barrett & Song"),
]

/**
 * Other spellings of a school, as the rankings and the NDT print them,
 * compared after {@link coreSchoolName}.
 */
const ALIASES: Record<string, string[]> = {
  [WM]: ["william and mary", "william mary", "w m"],
  [CATHOLIC]: ["catholic", "catholic university america", "cua"],
  [UNC]: ["north carolina", "unc", "unc chapel hill", "north carolina chapel hill"],
  [UMASS]: ["massachusetts", "umass", "umass amherst"],
  [USC]: ["usc"],
  [UCF]: ["ucf"],
  [TEXAS]: ["texas austin", "ut austin"],
  [BERKELEY]: ["berkeley", "uc berkeley", "cal berkeley"],
  [WEST_GEORGIA]: ["state west georgia", "west georgia college"],
  [DETROIT]: ["detroit"],
  [CANISIUS]: ["canisius"],
  [GWU]: ["gwu", "george washington"],
  [BINGHAMTON]: ["suny binghamton", "state new york binghamton", "binghamton"],
}

/** Different schools whose core name collides with a Shirley school's. */
const NOT_SHIRLEY = new Set(["university of northwestern", "georgetown college"])

/** One school's Shirley finals, oldest first. */
export interface ShirleySchoolResults {
  school: string
  results: ShirleyResult[]
  championships: number
  secondPlaces: number
}

/**
 * Groups {@link SHIRLEY_RESULTS} by school.
 *
 * @returns One entry per school, in first-final order.
 */
export function shirleyResultsBySchool(results: ShirleyResult[] = SHIRLEY_RESULTS): ShirleySchoolResults[] {
  const bySchool = new Map<string, ShirleyResult[]>()
  for (const result of [...results].sort((a, b) => a.year - b.year)) {
    const list = bySchool.get(result.school) ?? []
    list.push(result)
    bySchool.set(result.school, list)
  }
  return [...bySchool].map(([school, list]) => ({
    school,
    results: list,
    championships: list.filter((r) => r.place === "Champion").length,
    secondPlaces: list.filter((r) => r.place === "Second place").length,
  }))
}

/**
 * A school's Shirley finals, or `null` when it never reached one. Names must
 * agree exactly once "University", "College", state tags and punctuation are
 * dropped (or match a listed alias), so "Michigan" never inherits
 * "Michigan State".
 *
 * @param school - School name as the rankings or the NDT spell it.
 */
export function findShirleySchoolResults(
  school: string,
  schools: ShirleySchoolResults[] = shirleyResultsBySchool(),
): ShirleySchoolResults | null {
  const core = coreSchoolName(school)
  if (!core || NOT_SHIRLEY.has(school.toLowerCase().replace(/\([^)]*\)/g, "").trim())) return null
  return schools.find((entry) => coreSchoolName(entry.school) === core || ALIASES[entry.school]?.includes(core)) ?? null
}
