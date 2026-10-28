/**
 * @fileoverview Cross Examination Debate Association (CEDA) national
 * tournament champions, 1986 onward, as published in CEDA's "History of
 * Winners and Topics". The school profile page lists each college's CEDA
 * titles beside its NDT record.
 * @module sync/ceda-champions
 */

export interface CedaChampion {
  year: number
  /** Winning school, by its current name. */
  school: string
  /** Debaters, as CEDA lists them. */
  team: string
  /** The school's name at the time, when it has since changed. */
  formerName?: string
}

/**
 * Other spellings of a winning school, as the rankings and the NDT print
 * them, compared after {@link coreSchoolName}.
 */
const ALIASES: Record<string, string[]> = {
  "Binghamton University": ["suny binghamton", "state new york binghamton", "binghamton"],
  "New York University": ["nyu"],
  "Rutgers University": ["rutgers newark"],
  "University of California, Berkeley": ["berkeley", "uc berkeley", "cal berkeley"],
  "University of Missouri-Kansas City": ["umkc"],
  "University of Texas": ["texas austin", "ut austin"],
  "University of West Georgia": ["state west georgia"],
}

/** Different schools whose core name collides with a champion's. */
const NOT_CHAMPIONS = new Set(["university of northwestern"])

/** `"University of California, Berkeley (CA)"` → `"california berkeley"`. */
export function coreSchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:university|college|of|the|at)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** One school's CEDA national titles, oldest first. */
export interface CedaSchoolTitles {
  school: string
  titles: CedaChampion[]
}

/** Seasons with no champion, and why. */
export const CEDA_NO_CHAMPION: Record<number, string> = {
  2020: "Tournament canceled due to COVID-19",
}

export const CEDA_CHAMPIONS: CedaChampion[] = [
  { year: 1986, school: "Macalester College", team: "Paul Benson & Molly McGinnis" },
  { year: 1987, school: "Macalester College", team: "Paul Benson & Molly McGinnis" },
  { year: 1988, school: "Southern Illinois University", team: "Mark West & John Lapham" },
  { year: 1989, school: "Gonzaga University", team: "Dave Hanson & Bill DeForeest" },
  {
    year: 1990,
    school: "University of Central Oklahoma",
    team: "Charles Mallard & Josh Hoe",
    formerName: "Central State University",
  },
  { year: 1991, school: "Kansas State University", team: "David Filippi & Richard McCollum" },
  { year: 1992, school: "Missouri State University", team: "Jeffrey Jarman & TJ Wolfe" },
  { year: 1993, school: "Kansas State University", team: "Jill Basinger & KJ Wall" },
  {
    year: 1994,
    school: "University of Missouri-Kansas City",
    team: "David Kingston (Genco) & James Brian Johnston",
  },
  { year: 1995, school: "Michigan State University", team: "Elizabeth Repko & Jason Trice" },
  { year: 1996, school: "Southern Illinois University", team: "Glen Frappier & Bill Shinn" },
  { year: 1997, school: "Northwestern University", team: "Terry Johnson & Brandon Fletcher" },
  { year: 1998, school: "Emory University", team: "Stephen Heidt & Dan Fitzmier" },
  { year: 1999, school: "Whitman College", team: "Jessica Clarke & Adam Symonds" },
  { year: 2000, school: "University of West Georgia", team: "Rachel Saloom & Sarah Holbrook", formerName: "State University of West Georgia" },
  { year: 2001, school: "University of West Georgia", team: "Rashad Evans & Sarah Holbrook", formerName: "State University of West Georgia" },
  { year: 2002, school: "Fort Hays State University", team: "Joe Ramsey & Jason Regnier" },
  { year: 2003, school: "New York University", team: "Richard Garner & Nate Gorelick" },
  { year: 2004, school: "Emory University", team: "Mike Beckley & Henry Liu" },
  { year: 2005, school: "University of California, Berkeley", team: "Craig Wickersham & Stacey Nathan" },
  { year: 2006, school: "Harvard University", team: "Michael Klinger & Nikhil Mirchandani" },
  { year: 2007, school: "University of Oklahoma", team: "Conor Cleary & Blake Johnson" },
  { year: 2008, school: "Towson University", team: "Dayvon Love & Deven Cooper" },
  { year: 2009, school: "University of Oklahoma", team: "R.J. Giglio & Nick Watts" },
  { year: 2010, school: "University of Oklahoma", team: "R.J. Giglio & Nick Watts" },
  { year: 2011, school: "Kansas State University", team: "Beth Mendenhall & Derek Ziegler" },
  { year: 2012, school: "University of Oklahoma", team: "R.J. Giglio & Christopher Leonardi" },
  { year: 2013, school: "Emporia State University", team: "Ryan Wash & Eli Smith" },
  { year: 2014, school: "Towson University", team: "Korey Johnson & Ameena Ruffin" },
  { year: 2015, school: "Towson University", team: "Troi Thomas & Kevin Whitley" },
  { year: 2016, school: "University of Vermont", team: "Khalil Lee & Taylor Brough" },
  { year: 2017, school: "Rutgers University", team: "Nick Nave & Devane Murphy" },
  { year: 2018, school: "University of Iowa", team: "Sam Gustavson & Geordano Liriano" },
  { year: 2019, school: "University of Oklahoma", team: "Jazmine Pickens & Darius White" },
  { year: 2021, school: "University of Texas", team: "Het Desai & Zachary Watts" },
  { year: 2022, school: "Wake Forest University", team: "Asya Taylor & Dimarvin Puerto" },
  { year: 2023, school: "Wake Forest University", team: "Ana Bittner & Ari Davidson" },
  { year: 2024, school: "Binghamton University", team: "Eli T. Louis & Akif Choudhury" },
  { year: 2025, school: "University of Iowa", team: "Grey Parfenoff & Spencer Anderson McElligott" },
  { year: 2026, school: "University of Kansas", team: "Kate'Lynn Shaw & Nargis Suleman" },
]

/**
 * Groups {@link CEDA_CHAMPIONS} by school.
 *
 * @returns One entry per winning school, in first-title order.
 */
export function cedaTitlesBySchool(champions: CedaChampion[] = CEDA_CHAMPIONS): CedaSchoolTitles[] {
  const bySchool = new Map<string, CedaChampion[]>()
  for (const champion of [...champions].sort((a, b) => a.year - b.year)) {
    const titles = bySchool.get(champion.school) ?? []
    titles.push(champion)
    bySchool.set(champion.school, titles)
  }
  return [...bySchool].map(([school, titles]) => ({ school, titles }))
}

/**
 * A school's CEDA titles, or `null` when it never won. Names must agree
 * exactly once "University", "College", state tags and punctuation are
 * dropped (or match a listed alias), so "Texas State" never inherits
 * "Texas" and "Michigan" never inherits "Michigan State".
 *
 * @param school - School name as the rankings or the NDT spell it.
 */
export function findCedaSchoolTitles(school: string, schools: CedaSchoolTitles[] = cedaTitlesBySchool()): CedaSchoolTitles | null {
  const core = coreSchoolName(school)
  if (!core || NOT_CHAMPIONS.has(school.toLowerCase().replace(/\([^)]*\)/g, "").trim())) return null
  return (
    schools.find((entry) => coreSchoolName(entry.school) === core || ALIASES[entry.school]?.includes(core)) ?? null
  )
}
