/**
 * @fileoverview Tournament of Champions (TOC) history: every champion and
 * runner-up the University of Kentucky's national high school tournament has
 * crowned, in every debate and speech event, plus the policy top speakers,
 * 1972 onward. The school profile page lists a high school's TOC record the
 * way a college page lists its NDT and CEDA record.
 *
 * Results are from Wikipedia's "List of Tournament of Champions winners"
 * (CC BY-SA 4.0) and the TOC's policy top-speaker history, with each school
 * written under one canonical name so its variants ("Harker", "Harker School",
 * "The Harker School") count as one school.
 * @module rankings/toc-champions
 */

export type TocEvent =
  | "Policy"
  | "Lincoln-Douglas"
  | "Public Forum"
  | "World Schools"
  | "Congress"
  | "Extemporaneous Speaking"
  | "Original Oratory"
  | "Dramatic Interpretation"
  | "Duo Interpretation"
  | "Humorous Interpretation"
  | "Oral Interpretation"
  | "Program Oral Interpretation"
  | "Informative Speaking"

/**
 * A close-out (two teammates who don't debate the final) and the 2006 PF
 * final's shared title are `"Co-champion"`.
 */
export type TocPlace = "Champion" | "Co-champion" | "Runner-up" | "Top speaker" | "Presiding officer"

export interface TocResult {
  year: number
  event: TocEvent
  place: TocPlace
  /** Canonical school name, with its state when the source gives one. */
  school: string
  /** Competitors, as the source lists them. */
  competitors: string
  /** The school's name at the time, when it has since changed. */
  formerName?: string
}

export const TOC_SOURCE_URL = "https://en.wikipedia.org/wiki/List_of_Tournament_of_Champions_winners"

/** The order events are listed in on a school page. */
export const TOC_EVENTS: readonly TocEvent[] = [
  "Policy",
  "Lincoln-Douglas",
  "Public Forum",
  "World Schools",
  "Congress",
  "Extemporaneous Speaking",
  "Original Oratory",
  "Dramatic Interpretation",
  "Duo Interpretation",
  "Humorous Interpretation",
  "Oral Interpretation",
  "Program Oral Interpretation",
  "Informative Speaking",
]

/** Seasons an event had no champion, and why. */
export const TOC_NO_CHAMPION: Partial<Record<TocEvent, Record<number, string>>> = {
  "Duo Interpretation": { 2020: "Event did not occur" },
}

/**
 * Spellings the rankings and circuit use for a school that don't reduce to
 * its canonical name's {@link tocSchoolKey}.
 */
const ALIASES: Record<string, string[]> = {
  "American Heritage Broward (FL)": ["american heritage plantation"],
  "Hunter College High School (NY)": ["hunter"],
  "Lawrence Free State (KS)": ["free state"],
  "Liberal Arts and Science Academy (TX)": ["lasa"],
  "Montgomery Bell Academy (TN)": ["mba"],
  "NSU University School (FL)": ["nsu", "nova southeastern university", "university"],
  "Thomas Jefferson HSST (VA)": ["thomas jefferson", "tjhsst"],
  "University of Chicago Laboratory Schools (IL)": ["chicago labs", "chicago lab", "uchicago lab"],
  "Valley High School (IA)": ["west des moines valley", "wdm valley"],
  "Whitney M. Young Magnet High School (IL)": ["whitney young"],
}

/**
 * Bare names several circuit schools answer to ("St. Thomas" is also St.
 * Thomas in Houston, "Stratford" also Stratford in Houston); these match only
 * with the state tag of the school that placed.
 */
const AMBIGUOUS_KEYS = new Set(["robinson", "st thomas", "stratford"])

/** Two-letter state tag in a name, `"Greenhill School (TX)"` → `"TX"`. */
export function tocSchoolState(name: string): string | null {
  const tags = name.match(/\(([A-Z]{2})\)/g)
  return tags ? tags[tags.length - 1].slice(1, 3) : null
}

/**
 * `"The Harker School (CA)"` → `"harker"`. Drops state tags, "The", "High",
 * "School", "Senior", "Academy", "HS" and "of", and spells "Preparatory" as
 * "Prep", so "Bronx High School of Science" is "bronx science" and "Strake
 * Jesuit College Preparatory" is the rankings' "Strake Jesuit College Prep".
 */
export function tocSchoolKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/preparatory/g, "prep")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !["the", "high", "school", "schools", "senior", "hs", "academy", "of"].includes(word))
    .join(" ")
}

export const TOC_RESULTS: TocResult[] = [
  // Policy
  { year: 1972, event: "Policy", place: "Champion", school: "Marquette University High School", competitors: "Jeff Clark & Mark Foley" },
  { year: 1972, event: "Policy", place: "Runner-up", school: "Marquette University High School", competitors: "Mark Miner & David Dries" },
  { year: 1973, event: "Policy", place: "Champion", school: "Hillsboro", competitors: "Mary Thomson & Kather Zickert" },
  { year: 1973, event: "Policy", place: "Runner-up", school: "Upper Arlington", competitors: "Peter Koeniz & Doug Dougherty" },
  { year: 1974, event: "Policy", place: "Champion", school: "Walter Panas", competitors: "Denise Gilbert & Larry Falkin" },
  { year: 1974, event: "Policy", place: "Runner-up", school: "Wilkinsburg", competitors: "John Tumazos & David Snowball" },
  { year: 1975, event: "Policy", place: "Champion", school: "Cardinal Spellman", competitors: "Leo Gagion & John Bredehoft" },
  { year: 1975, event: "Policy", place: "Runner-up", school: "Lakeland", competitors: "Amy Davidoff & Virginia Raymond" },
  { year: 1976, event: "Policy", place: "Champion", school: "Cardinal Spellman", competitors: "Leo Gagion & John Bredehoft" },
  { year: 1976, event: "Policy", place: "Runner-up", school: "Soquel", competitors: "Ron Aitken & Jeff Lorenzen" },
  { year: 1977, event: "Policy", place: "Champion", school: "Lake Forest High School (IL)", competitors: "Karen Albrecht & Hugh Abrams" },
  { year: 1977, event: "Policy", place: "Runner-up", school: "Robinson", competitors: "Michael Laurence & Shelly Coleman" },
  { year: 1978, event: "Policy", place: "Champion", school: "Walter Panas", competitors: "Donna Gilbert & Patrick O'Neill" },
  { year: 1978, event: "Policy", place: "Runner-up", school: "Bronx High School of Science (NY)", competitors: "Eric Raps & Matthew Mandell" },
  { year: 1979, event: "Policy", place: "Champion", school: "Bronx High School of Science (NY)", competitors: "Andrew Berman & Herschel Goldfield" },
  { year: 1979, event: "Policy", place: "Runner-up", school: "Marquette University High School", competitors: "Jim Boehner & John Barrett" },
  { year: 1980, event: "Policy", place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Jeff Wagner & Brad Malis" },
  { year: 1980, event: "Policy", place: "Runner-up", school: "Bronx High School of Science (NY)", competitors: "Stuart Weich & Andrew Berman" },
  { year: 1981, event: "Policy", place: "Champion", school: "Glenbrook South (IL)", competitors: "Jeffrey Wortman & Mark Koulogeorge" },
  { year: 1981, event: "Policy", place: "Runner-up", school: "Firestone", competitors: "Alan Gerber & Steve Dist" },
  { year: 1982, event: "Policy", place: "Champion", school: "Oak Park & River Forest (IL)", competitors: "Todd Martin & Eric Brackett" },
  { year: 1982, event: "Policy", place: "Runner-up", school: "Glenbrook North High School (IL)", competitors: "Peter Braverman & Ken Karas" },
  { year: 1983, event: "Policy", place: "Champion", school: "Oak Park & River Forest (IL)", competitors: "Macklin Trimnell & C.V. Doherty" },
  { year: 1983, event: "Policy", place: "Runner-up", school: "Creighton Prep", competitors: "Wally Mullin & Don Erftmier, Jr." },
  { year: 1984, event: "Policy", place: "Champion", school: "Lake Braddock", competitors: "Shaun Martin & Mike Green" },
  { year: 1984, event: "Policy", place: "Runner-up", school: "New Trier High School (IL)", competitors: "Laura Michaelis & Moria McDermott" },
  { year: 1985, event: "Policy", place: "Champion", school: "Lake Braddock", competitors: "Joe Pettit & Mike Green" },
  { year: 1985, event: "Policy", place: "Runner-up", school: "Marquette University High School", competitors: "Ed Lynch & Kevin Roe" },
  { year: 1986, event: "Policy", place: "Champion", school: "Albany", competitors: "Peter Gross & Andrew Schrank" },
  { year: 1986, event: "Policy", place: "Runner-up", school: "Bishop Guertin (NH)", competitors: "Pete Klamka & Tim Pramas" },
  { year: 1987, event: "Policy", place: "Champion", school: "Manchester", competitors: "Sarah Gannett & Zach Leber" },
  { year: 1987, event: "Policy", place: "Runner-up", school: "Stuyvesant (NY)", competitors: "Hanna Rosin & David Coleman" },
  { year: 1988, event: "Policy", place: "Champion", school: "Downers Grove South (IL)", competitors: "Karrie Schwartz & Bill Fick" },
  { year: 1988, event: "Policy", place: "Runner-up", school: "Albuquerque Academy (NM)", competitors: "Kevin Kuswa & Chris Harris" },
  { year: 1989, event: "Policy", place: "Champion", school: "St. Mark's School of Texas (TX)", competitors: "Steven Sklaver & Jack Stroube" },
  { year: 1989, event: "Policy", place: "Runner-up", school: "Richmond Kennedy", competitors: "Colin Kahl & Todd Cort" },
  { year: 1990, event: "Policy", place: "Champion", school: "Oak Park & River Forest (IL)", competitors: "Eric Truett & Brian Ruder" },
  { year: 1990, event: "Policy", place: "Runner-up", school: "Harvard-Westlake School (CA)", competitors: "Ara Lovitt & Ahilan Arulanantham", formerName: "Harvard School" },
  { year: 1991, event: "Policy", place: "Champion", school: "Omaha Westside (NE)", competitors: "Paul Skiermont & Jason Patil" },
  { year: 1991, event: "Policy", place: "Runner-up", school: "Georgetown Day School (DC)", competitors: "Daniel Nexon & Rebecca Tushnet" },
  { year: 1992, event: "Policy", place: "Champion", school: "Edgemont (NY)", competitors: "Jason Feldman & Derek Schaffer" },
  { year: 1992, event: "Policy", place: "Runner-up", school: "Albuquerque Academy (NM)", competitors: "Jeremy Pena & Mark Kutny" },
  { year: 1993, event: "Policy", place: "Champion", school: "Isidore Newman School (LA)", competitors: "Ben Norwood & Taavi Reiss" },
  { year: 1993, event: "Policy", place: "Runner-up", school: "Brookfield Central High School (WI)", competitors: "David Frank & Joshua Heling" },
  { year: 1994, event: "Policy", place: "Champion", school: "Lexington High School (MA)", competitors: "Li-Cheng Wang & Steve Lehotsky" },
  { year: 1994, event: "Policy", place: "Runner-up", school: "Edgemont (NY)", competitors: "Sanket J. Bulsara & Chris Lennon" },
  { year: 1995, event: "Policy", place: "Champion", school: "Niles West (IL)", competitors: "Armands Revelins & George Kouros" },
  { year: 1995, event: "Policy", place: "Runner-up", school: "Lexington High School (MA)", competitors: "Steve Lehotsky & Matt Nichols" },
  { year: 1996, event: "Policy", place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Larry Heftman & Adam Hurder" },
  { year: 1996, event: "Policy", place: "Runner-up", school: "Katy-Taylor (TX)", competitors: "Jeff McNabb & Kim Sikora" },
  { year: 1997, event: "Policy", place: "Champion", school: "Caddo Magnet (LA)", competitors: "Andy Ryan & Kamal Ghali" },
  { year: 1997, event: "Policy", place: "Runner-up", school: "Greenhill School (TX)", competitors: "Josh Goldberg & Rashad Hussain" },
  { year: 1998, event: "Policy", place: "Champion", school: "Glenbrook South (IL)", competitors: "Adam Goldstein & Todd Fine" },
  { year: 1998, event: "Policy", place: "Runner-up", school: "Greenhill School (TX)", competitors: "Caitlin Talmadge & Andrew Bradt" },
  { year: 1999, event: "Policy", place: "Champion", school: "Montgomery Bell Academy (TN)", competitors: "Raja Gaddipati/Robbie Quinn" },
  { year: 1999, event: "Policy", place: "Runner-up", school: "Lexington High School (MA)", competitors: "Josh Lynn & Yoni Cohen" },
  { year: 2000, event: "Policy", place: "Champion", school: "Greenhill School (TX)", competitors: "Asher Haig/Jordan Pietzsch" },
  { year: 2000, event: "Policy", place: "Runner-up", school: "Centerville (OH)", competitors: "Caleb Liang & Henry Liu" },
  { year: 2001, event: "Policy", place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Michael Klinger/Stacey Nathan" },
  { year: 2001, event: "Policy", place: "Runner-up", school: "Woodward Academy (GA)", competitors: "Avery Dale and Peter Miller" },
  { year: 2002, event: "Policy", place: "Champion", school: "Pace Academy (GA)", competitors: "Bob Allen/Brian Smith" },
  { year: 2002, event: "Policy", place: "Runner-up", school: "St. Mark's School of Texas (TX)", competitors: "Josh Branson/Michael Martin" },
  { year: 2003, event: "Policy", place: "Champion", school: "The College Preparatory School (CA)", competitors: "Michael Burshteyn/Eli Anders" },
  { year: 2003, event: "Policy", place: "Runner-up", school: "Greenhill School (TX)", competitors: "Maggie Ahn & Saad Hussain" },
  { year: 2004, event: "Policy", place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Jake Ziering/Michael Rosecrans" },
  { year: 2004, event: "Policy", place: "Runner-up", school: "The College Preparatory School (CA)", competitors: "Michael Burshteyn/Eli Anders" },
  { year: 2005, event: "Policy", place: "Champion", school: "The Westminster Schools (GA)", competitors: "Anusha Deshpande/Stephen Weil" },
  { year: 2005, event: "Policy", place: "Runner-up", school: "Chattahoochee (GA)", competitors: "Garrett Abelkop/John Warden" },
  { year: 2006, event: "Policy", place: "Champion", school: "Greenhill School (TX)", competitors: "Mathew Andrews/Stephen Polley" },
  { year: 2006, event: "Policy", place: "Runner-up", school: "Glenbrook South (IL)", competitors: "Abe Corrigan/Mima Lazarevic" },
  { year: 2007, event: "Policy", place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Matt Fisher/Stephanie Spies" },
  { year: 2007, event: "Policy", place: "Runner-up", school: "The Westminster Schools (GA)", competitors: "Stephen Weil/Sanjena Anshu Sathian" },
  { year: 2008, event: "Policy", place: "Champion", school: "Greenhill School (TX)", competitors: "Nicholas Rogan and Olivia Rogan" },
  { year: 2008, event: "Policy", place: "Runner-up", school: "Colleyville Heritage High School (TX)", competitors: "James Hamraie and Evan Defillipis" },
  { year: 2009, event: "Policy", place: "Champion", school: "The Westminster Schools (GA)", competitors: "Sanjena Anshu Sathian/Rajesh Jegadeesh" },
  { year: 2009, event: "Policy", place: "Runner-up", school: "Bellarmine College Preparatory (CA)", competitors: "Will Rafey/Sagar Vijay" },
  { year: 2010, event: "Policy", place: "Champion", school: "The Westminster Schools (GA)", competitors: "Ellis Allen/Daniel Taylor" },
  { year: 2010, event: "Policy", place: "Runner-up", school: "St. Mark's School of Texas (TX)", competitors: "Alex Miles/Rishee Batra" },
  { year: 2011, event: "Policy", place: "Champion", school: "The Westminster Schools (GA)", competitors: "Ellis Allen/Daniel Taylor" },
  { year: 2011, event: "Policy", place: "Runner-up", school: "Lexington High School (MA)", competitors: "Arjun Vellayappan/Tyler Engler" },
  { year: 2012, event: "Policy", place: "Champion", school: "Iowa City West High School (IA)", competitors: "Jeffrey Ding/Liam Hancock" },
  { year: 2012, event: "Policy", place: "Runner-up", school: "Glenbrook North High School (IL)", competitors: "Rachel Boroditsky/Nathaniel Sawyer" },
  { year: 2013, event: "Policy", place: "Champion", school: "C. K. McClatchy High School (CA)", competitors: "John Spurlock/Keenan Harris" },
  { year: 2013, event: "Policy", place: "Runner-up", school: "Glenbrook North High School (IL)", competitors: "Natalie Knez/Nathaniel Sawyer" },
  { year: 2014, event: "Policy", place: "Champion", school: "Centennial High School (MD)", competitors: "Gabriel Koo/Michael Koo" },
  { year: 2014, event: "Policy", place: "Runner-up", school: "Polytechnic High School (CA)", competitors: "Julia Alison/Les Asimow" },
  { year: 2015, event: "Policy", place: "Champion", school: "The Westminster Schools (GA)", competitors: "Saul Forman/Naman Gupta" },
  { year: 2015, event: "Policy", place: "Runner-up", school: "Baltimore City College (MD)", competitors: "Peymaan Motevalli/Joseph Gaylin" },
  { year: 2016, event: "Policy", place: "Champion", school: "Highland Park (MN)", competitors: "Dan Bannister/Ian Dill" },
  { year: 2016, event: "Policy", place: "Runner-up", school: "Little Rock Central High School (AR)", competitors: "Payton Woods/Darrin “DJ” Williams Jr." },
  { year: 2017, event: "Policy", place: "Champion", school: "McDonogh (MD)", competitors: "Ryan James/Nishad Neelakandan" },
  { year: 2017, event: "Policy", place: "Runner-up", school: "Peninsula High School (CA)", competitors: "Raam Tambe/Jerry Wang" },
  { year: 2018, event: "Policy", place: "Champion", school: "Monta Vista (CA)", competitors: "Rafael Pierry/Dhruv Sudesh" },
  { year: 2018, event: "Policy", place: "Runner-up", school: "Blue Valley Southwest High School (KS)", competitors: "Danish Khan/Stephen Lowe" },
  { year: 2019, event: "Policy", place: "Champion", school: "North Broward Preparatory School (FL)", competitors: "Nicholas Mancini/Giorgio Rabbini" },
  { year: 2019, event: "Policy", place: "Runner-up", school: "Montgomery Bell Academy (TN)", competitors: "Aden Barton/Julian Habermann" },
  { year: 2020, event: "Policy", place: "Champion", school: "Montgomery Bell Academy (TN)", competitors: "Aden Barton/Sam Meacham" },
  { year: 2020, event: "Policy", place: "Runner-up", school: "Whitney M. Young Magnet High School (IL)", competitors: "Jeremy Margolin/Henry Mitchell" },
  { year: 2021, event: "Policy", place: "Champion", school: "Bellarmine College Preparatory (CA)", competitors: "Adarsh Hiremath/Surya Midha" },
  { year: 2021, event: "Policy", place: "Runner-up", school: "Chaminade College Preparatory (CA)", competitors: "Dhruv Ahuja/Azi Hormozdiari" },
  { year: 2022, event: "Policy", place: "Champion", school: "Lawrence Free State (KS)", competitors: "John Marshall/Serena Rupp" },
  { year: 2022, event: "Policy", place: "Runner-up", school: "Berkeley Preparatory School (FL)", competitors: "Kyle Shah/Antonio Souchet" },
  { year: 2023, event: "Policy", place: "Champion", school: "Liberal Arts and Science Academy (TX)", competitors: "Sam Church/Alexandrea Huang" },
  { year: 2023, event: "Policy", place: "Runner-up", school: "Montgomery Bell Academy (TN)", competitors: "Chanden Climaco/Raleigh Maxwell" },
  { year: 2024, event: "Policy", place: "Champion", school: "Westwood High School (TX)", competitors: "Ishan Sharma/Ayush Tripathi" },
  { year: 2024, event: "Policy", place: "Runner-up", school: "Montgomery Bell Academy (TN)", competitors: "Cy Turner/Raleigh Maxwell" },
  { year: 2025, event: "Policy", place: "Champion", school: "Greenhill School (TX)", competitors: "Rory Liu/Gautam Chamarthy" },
  { year: 2025, event: "Policy", place: "Runner-up", school: "Northview High School (GA)", competitors: "Jerry Chen/Kento Taylor" },
  { year: 2026, event: "Policy", place: "Champion", school: "Montgomery Bell Academy (TN)", competitors: "Russell Howard/Jimmy Li" },
  { year: 2026, event: "Policy", place: "Runner-up", school: "Glenbrook North High School (IL)", competitors: "Ethan Camp/Joe Rosenblat" },
  { year: 1972, event: "Policy", place: "Top speaker", school: "Marquette University High School", competitors: "Jeff Clark, Mark Foley" },
  { year: 1973, event: "Policy", place: "Top speaker", school: "Hillsboro", competitors: "Mary Thompson" },
  { year: 1974, event: "Policy", place: "Top speaker", school: "Woodson", competitors: "Dave Ottoson" },
  { year: 1975, event: "Policy", place: "Top speaker", school: "Cardinal Spellman", competitors: "John Bredehoft" },
  { year: 1976, event: "Policy", place: "Top speaker", school: "Soquel", competitors: "Jeff Lorenzen" },
  { year: 1977, event: "Policy", place: "Top speaker", school: "Lakeland", competitors: "Patrick Finegan" },
  { year: 1978, event: "Policy", place: "Top speaker", school: "Soquel", competitors: "Sandra Seville-Jones" },
  { year: 1979, event: "Policy", place: "Top speaker", school: "Bronx High School of Science (NY)", competitors: "Herschel Goldfield" },
  { year: 1980, event: "Policy", place: "Top speaker", school: "University of Detroit", competitors: "Kevin O'Shea" },
  { year: 1981, event: "Policy", place: "Top speaker", school: "Maine East", competitors: "Lenny Gail" },
  { year: 1982, event: "Policy", place: "Top speaker", school: "Bronx High School of Science (NY)", competitors: "Erik Jaffe" },
  { year: 1983, event: "Policy", place: "Top speaker", school: "Montgomery Bell Academy (TN)", competitors: "Lyn Robbins" },
  { year: 1984, event: "Policy", place: "Top speaker", school: "Bronx High School of Science (NY)", competitors: "Stuart Rabin" },
  { year: 1985, event: "Policy", place: "Top speaker", school: "Lake Braddock", competitors: "Mike Green" },
  { year: 1986, event: "Policy", place: "Top speaker", school: "Lexington High School (MA)", competitors: "Jonathan Bines" },
  { year: 1987, event: "Policy", place: "Top speaker", school: "Churchill", competitors: "Michael Tomz" },
  { year: 1988, event: "Policy", place: "Top speaker", school: "Bronx High School of Science (NY)", competitors: "Noah Millman" },
  { year: 1989, event: "Policy", place: "Top speaker", school: "Detroit Catholic Central", competitors: "Omar Guevara" },
  { year: 1990, event: "Policy", place: "Top speaker", school: "The Kinkaid School (TX)", competitors: "Jon Brody" },
  { year: 1991, event: "Policy", place: "Top speaker", school: "Jefferson Science", competitors: "Stephen Andrews" },
  { year: 1992, event: "Policy", place: "Top speaker", school: "Pace Academy (GA)", competitors: "Sinan Aral" },
  { year: 1993, event: "Policy", place: "Top speaker", school: "Brookfield Central High School (WI)", competitors: "Joshua Heling" },
  { year: 1994, event: "Policy", place: "Top speaker", school: "Martin Luther King", competitors: "Dan Fitzmier" },
  { year: 1995, event: "Policy", place: "Top speaker", school: "Lexington High School (MA)", competitors: "Steve Lehotsky" },
  { year: 1996, event: "Policy", place: "Top speaker", school: "Greenhill School (TX)", competitors: "Dustin Marshall" },
  { year: 1997, event: "Policy", place: "Top speaker", school: "Grapevine", competitors: "David Harkin" },
  { year: 1998, event: "Policy", place: "Top speaker", school: "East Grand Rapids", competitors: "Geoff Lundeen" },
  { year: 1999, event: "Policy", place: "Top speaker", school: "Head-Royce School (CA)", competitors: "Jake Foster" },
  { year: 2000, event: "Policy", place: "Top speaker", school: "Pace Academy (GA)", competitors: "Ben Thorpe" },
  { year: 2001, event: "Policy", place: "Top speaker", school: "St. Thomas Academy (MN)", competitors: "Scott Phillips" },
  { year: 2002, event: "Policy", place: "Top speaker", school: "Glenbrook North High School (IL)", competitors: "Reuben Schy" },
  { year: 2003, event: "Policy", place: "Top speaker", school: "Colleyville Heritage High School (TX)", competitors: "Justin Murray" },
  { year: 2004, event: "Policy", place: "Top speaker", school: "Colleyville Heritage High School (TX)", competitors: "Jason Murray" },
  { year: 2005, event: "Policy", place: "Top speaker", school: "Montgomery Bell Academy (TN)", competitors: "Tripp Rebrovick" },
  { year: 2006, event: "Policy", place: "Top speaker", school: "Glenbrook North High School (IL)", competitors: "Matt Fisher" },
  { year: 2007, event: "Policy", place: "Top speaker", school: "The Westminster Schools (GA)", competitors: "Stephen Weil" },
  { year: 2008, event: "Policy", place: "Top speaker", school: "Stratford Academy (GA)", competitors: "William Karlson" },
  { year: 2009, event: "Policy", place: "Top speaker", school: "New Trier High School (IL)", competitors: "Ross Gordon" },
  { year: 2010, event: "Policy", place: "Top speaker", school: "Carrollton School of the Sacred Heart", competitors: "Anna Dimitrijevic" },
  { year: 2011, event: "Policy", place: "Top speaker", school: "The Beacon School", competitors: "Damiyr Davis" },
  { year: 2012, event: "Policy", place: "Top speaker", school: "Woodward Academy (GA)", competitors: "Jason Sigalos" },
  { year: 2013, event: "Policy", place: "Top speaker", school: "C. K. McClatchy High School (CA)", competitors: "John Spurlock" },
  { year: 2014, event: "Policy", place: "Top speaker", school: "University Prep Academy", competitors: "Rayvon Dean" },
  { year: 2015, event: "Policy", place: "Top speaker", school: "The Westminster Schools (GA)", competitors: "Saul Forman" },
  { year: 2016, event: "Policy", place: "Top speaker", school: "Little Rock Central High School (AR)", competitors: "Payton Woods" },
  { year: 2017, event: "Policy", place: "Top speaker", school: "Peninsula High School (CA)", competitors: "Raam Tambe" },
  { year: 2018, event: "Policy", place: "Top speaker", school: "Blue Valley Southwest High School (KS)", competitors: "Stephen Lowe" },
  { year: 2019, event: "Policy", place: "Top speaker", school: "North Broward Preparatory School (FL)", competitors: "Giorgio Rabbini" },
  { year: 2020, event: "Policy", place: "Top speaker", school: "Montgomery Bell Academy (TN)", competitors: "Aden Barton" },
  { year: 2021, event: "Policy", place: "Top speaker", school: "Bellarmine College Preparatory (CA)", competitors: "Surya Midha" },
  { year: 2022, event: "Policy", place: "Top speaker", school: "Berkeley Preparatory School (FL)", competitors: "Antonio Souchet" },
  { year: 2023, event: "Policy", place: "Top speaker", school: "Peninsula High School (CA)", competitors: "Coralynn Yang" },
  { year: 2024, event: "Policy", place: "Top speaker", school: "University of Chicago Laboratory Schools (IL)", competitors: "Mahi Shah" },
  { year: 2025, event: "Policy", place: "Top speaker", school: "Taipei American School", competitors: "Jordan Yao" },
  { year: 2026, event: "Policy", place: "Top speaker", school: "Glenbrook North High School (IL)", competitors: "Ethan Camp" },
  // Lincoln-Douglas
  { year: 1986, event: "Lincoln-Douglas", place: "Champion", school: "Bronx High School of Science (NY)", competitors: "Hee-Sun Hong" },
  { year: 1986, event: "Lincoln-Douglas", place: "Runner-up", school: "Jenks High School (OK)", competitors: "Greg Hewett" },
  { year: 1987, event: "Lincoln-Douglas", place: "Champion", school: "Twin Lakes High School (FL)", competitors: "Scott Tucker" },
  { year: 1987, event: "Lincoln-Douglas", place: "Runner-up", school: "Miami Palmetto High School (FL)", competitors: "Craig Tinsky" },
  { year: 1988, event: "Lincoln-Douglas", place: "Co-champion", school: "Bronx High School of Science (NY)", competitors: "Jonathan Koppell" },
  { year: 1988, event: "Lincoln-Douglas", place: "Co-champion", school: "Bronx High School of Science (NY)", competitors: "Peter Colavito" },
  { year: 1989, event: "Lincoln-Douglas", place: "Champion", school: "Regis High School (NY)", competitors: "David Kennedy" },
  { year: 1989, event: "Lincoln-Douglas", place: "Runner-up", school: "Homewood High School", competitors: "Amy Forsee" },
  { year: 1990, event: "Lincoln-Douglas", place: "Champion", school: "Tampa Jesuit High School (FL)", competitors: "Chris Kellner" },
  { year: 1990, event: "Lincoln-Douglas", place: "Runner-up", school: "Albuquerque Academy (NM)", competitors: "Arthur Chu" },
  { year: 1991, event: "Lincoln-Douglas", place: "Champion", school: "Miami Palmetto High School (FL)", competitors: "Jeff Marcus" },
  { year: 1991, event: "Lincoln-Douglas", place: "Runner-up", school: "Regis High School (NY)", competitors: "Bill Harrington" },
  { year: 1992, event: "Lincoln-Douglas", place: "Champion", school: "La Cueva High School (NM)", competitors: "Michael Erickson" },
  { year: 1992, event: "Lincoln-Douglas", place: "Runner-up", school: "Vestavia Hills High School (AL)", competitors: "Jason Baldwin" },
  { year: 1993, event: "Lincoln-Douglas", place: "Champion", school: "Vestavia Hills High School (AL)", competitors: "Jason Baldwin" },
  { year: 1993, event: "Lincoln-Douglas", place: "Runner-up", school: "Christopher Columbus High School (FL)", competitors: "Carlos Gonzales" },
  { year: 1994, event: "Lincoln-Douglas", place: "Champion", school: "Palo Alto High School (CA)", competitors: "Ann Miura" },
  { year: 1994, event: "Lincoln-Douglas", place: "Runner-up", school: "Vestavia Hills High School (AL)", competitors: "Claire Carman" },
  { year: 1995, event: "Lincoln-Douglas", place: "Champion", school: "Miami Palmetto High School (FL)", competitors: "Greg Goldfarb" },
  { year: 1995, event: "Lincoln-Douglas", place: "Runner-up", school: "Vestavia Hills High School (AL)", competitors: "Tyrenda Williams" },
  { year: 1996, event: "Lincoln-Douglas", place: "Champion", school: "Valley High School (IA)", competitors: "Courtney Balentine" },
  { year: 1996, event: "Lincoln-Douglas", place: "Runner-up", school: "Apple Valley High School (MN)", competitors: "David Singh" },
  { year: 1997, event: "Lincoln-Douglas", place: "Champion", school: "Vestavia Hills High School (AL)", competitors: "Hetal Doshi" },
  { year: 1997, event: "Lincoln-Douglas", place: "Runner-up", school: "Valley High School (IA)", competitors: "Brian Fletcher" },
  { year: 1998, event: "Lincoln-Douglas", place: "Champion", school: "Valley High School (IA)", competitors: "Ari Simon" },
  { year: 1998, event: "Lincoln-Douglas", place: "Runner-up", school: "St. James School (AL)", competitors: "Anna Manasco" },
  { year: 1999, event: "Lincoln-Douglas", place: "Champion", school: "Valley High School (IA)", competitors: "Tom Zimpleman" },
  { year: 1999, event: "Lincoln-Douglas", place: "Runner-up", school: "Vestavia Hills High School (AL)", competitors: "Ben Davidson" },
  { year: 2000, event: "Lincoln-Douglas", place: "Champion", school: "Edmond North High School (OK)", competitors: "Seamus Donovan" },
  { year: 2000, event: "Lincoln-Douglas", place: "Runner-up", school: "Katy High School (TX)", competitors: "James Scott" },
  { year: 2001, event: "Lincoln-Douglas", place: "Champion", school: "Hopkins High School (MN)", competitors: "Tom Pryor" },
  { year: 2001, event: "Lincoln-Douglas", place: "Runner-up", school: "Westwood High School (TX)", competitors: "Tommy Clancy" },
  { year: 2002, event: "Lincoln-Douglas", place: "Champion", school: "Millard West High School (NE)", competitors: "Jenn Larson" },
  { year: 2002, event: "Lincoln-Douglas", place: "Runner-up", school: "Apple Valley High School (MN)", competitors: "Kelsey Olson" },
  { year: 2003, event: "Lincoln-Douglas", place: "Champion", school: "Mission San Jose High School (CA)", competitors: "Andrew Garvin" },
  { year: 2003, event: "Lincoln-Douglas", place: "Runner-up", school: "Lincoln Southeast High School (NE)", competitors: "Tom Evnen" },
  { year: 2004, event: "Lincoln-Douglas", place: "Champion", school: "Edina High School (MN)", competitors: "John McNeil" },
  { year: 2004, event: "Lincoln-Douglas", place: "Runner-up", school: "Apple Valley High School (MN)", competitors: "Tim Hogan" },
  { year: 2005, event: "Lincoln-Douglas", place: "Champion", school: "Greenhill School (TX)", competitors: "David Wolfish" },
  { year: 2005, event: "Lincoln-Douglas", place: "Runner-up", school: "Mission San Jose High School (CA)", competitors: "Hirsh Jain" },
  { year: 2006, event: "Lincoln-Douglas", place: "Champion", school: "Mountain View High School (CA)", competitors: "Stephen Hess" },
  { year: 2006, event: "Lincoln-Douglas", place: "Runner-up", school: "Highland Park High School (TX)", competitors: "David Weeks" },
  { year: 2007, event: "Lincoln-Douglas", place: "Champion", school: "Lynbrook High School (CA)", competitors: "Patrick Diehl" },
  { year: 2007, event: "Lincoln-Douglas", place: "Runner-up", school: "Greenhill School (TX)", competitors: "David McGough" },
  { year: 2008, event: "Lincoln-Douglas", place: "Champion", school: "Apple Valley High School (MN)", competitors: "Chris Theis" },
  { year: 2008, event: "Lincoln-Douglas", place: "Runner-up", school: "The Kinkaid School (TX)", competitors: "Becca Traber" },
  { year: 2009, event: "Lincoln-Douglas", place: "Champion", school: "Apple Valley High School (MN)", competitors: "Chris Theis" },
  { year: 2009, event: "Lincoln-Douglas", place: "Runner-up", school: "Mountain View High School (CA)", competitors: "Daniel Moerner" },
  { year: 2010, event: "Lincoln-Douglas", place: "Champion", school: "St. Louis Park High School (MN)", competitors: "Catherine Tarsney" },
  { year: 2010, event: "Lincoln-Douglas", place: "Runner-up", school: "Valley High School (IA)", competitors: "Ross Brown" },
  { year: 2011, event: "Lincoln-Douglas", place: "Co-champion", school: "Indian Springs School (AL)", competitors: "Larry Liu" },
  { year: 2011, event: "Lincoln-Douglas", place: "Co-champion", school: "Indian Springs School (AL)", competitors: "Jeffrey Liu" },
  { year: 2012, event: "Lincoln-Douglas", place: "Champion", school: "Lexington High School (MA)", competitors: "Noah Star" },
  { year: 2012, event: "Lincoln-Douglas", place: "Runner-up", school: "Loyola High School (CA)", competitors: "Bob Overing" },
  { year: 2013, event: "Lincoln-Douglas", place: "Champion", school: "Greenhill School (TX)", competitors: "Rebecca Kuang" },
  { year: 2013, event: "Lincoln-Douglas", place: "Runner-up", school: "St. Louis Park High School (MN)", competitors: "Richard Shmikler" },
  { year: 2014, event: "Lincoln-Douglas", place: "Champion", school: "Harrison High School (NY)", competitors: "Danny DeBois" },
  { year: 2014, event: "Lincoln-Douglas", place: "Runner-up", school: "Loyola High School (CA)", competitors: "Chris Kymn" },
  { year: 2015, event: "Lincoln-Douglas", place: "Champion", school: "The Harker School (CA)", competitors: "Pranav Reddy" },
  { year: 2015, event: "Lincoln-Douglas", place: "Runner-up", school: "NSU University School (FL)", competitors: "David Branse" },
  { year: 2016, event: "Lincoln-Douglas", place: "Champion", school: "Harvard-Westlake School (CA)", competitors: "Nick Steele" },
  { year: 2016, event: "Lincoln-Douglas", place: "Runner-up", school: "Clements (CA)", competitors: "Felix Tan" },
  { year: 2017, event: "Lincoln-Douglas", place: "Champion", school: "Phoenix Country Day (AZ)", competitors: "Parker Whitfill" },
  { year: 2017, event: "Lincoln-Douglas", place: "Runner-up", school: "Hunter College High School (NY)", competitors: "Nina Potischman" },
  { year: 2018, event: "Lincoln-Douglas", place: "Champion", school: "Greenhill School (TX)", competitors: "Brian Zhou" },
  { year: 2018, event: "Lincoln-Douglas", place: "Runner-up", school: "Santa Monica (CA)", competitors: "Rex Evans" },
  { year: 2019, event: "Lincoln-Douglas", place: "Champion", school: "St. Andrew's Episcopal (MS)", competitors: "Ishan Bhatt" },
  { year: 2019, event: "Lincoln-Douglas", place: "Runner-up", school: "Harvard-Westlake School (CA)", competitors: "Jaya Nayar" },
  { year: 2020, event: "Lincoln-Douglas", place: "Champion", school: "Lexington High School (MA)", competitors: "Evan Li" },
  { year: 2020, event: "Lincoln-Douglas", place: "Runner-up", school: "Valley High School (IA)", competitors: "Animesh Joshi" },
  { year: 2021, event: "Lincoln-Douglas", place: "Champion", school: "Strake Jesuit College Preparatory (TX)", competitors: "Zion Dixon" },
  { year: 2021, event: "Lincoln-Douglas", place: "Runner-up", school: "Harvard-Westlake School (CA)", competitors: "Andrew Gong" },
  { year: 2022, event: "Lincoln-Douglas", place: "Champion", school: "Sage Hill (CA)", competitors: "Max Perin" },
  { year: 2022, event: "Lincoln-Douglas", place: "Runner-up", school: "The Harker School (CA)", competitors: "Anshul Reddy" },
  { year: 2023, event: "Lincoln-Douglas", place: "Champion", school: "The Harker School (CA)", competitors: "Muzzi Khan" },
  { year: 2023, event: "Lincoln-Douglas", place: "Runner-up", school: "Strake Jesuit College Preparatory (TX)", competitors: "Karan Shah" },
  { year: 2024, event: "Lincoln-Douglas", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Spencer Swickle" },
  { year: 2024, event: "Lincoln-Douglas", place: "Runner-up", school: "Strake Jesuit College Preparatory (TX)", competitors: "Justin Wen" },
  { year: 2025, event: "Lincoln-Douglas", place: "Champion", school: "Orange County School of the Arts (CA)", competitors: "Iva Liu" },
  { year: 2025, event: "Lincoln-Douglas", place: "Runner-up", school: "Lynbrook High School (CA)", competitors: "Om Modi" },
  { year: 2026, event: "Lincoln-Douglas", place: "Champion", school: "Lynbrook High School (CA)", competitors: "Bolang Zhu" },
  { year: 2026, event: "Lincoln-Douglas", place: "Runner-up", school: "Head-Royce School (CA)", competitors: "Alexander Jayaratne" },
  // Public Forum
  { year: 2004, event: "Public Forum", place: "Champion", school: "Jay M. Robinson HS (NC)", competitors: "Erin Lopez/Jordan Myers" },
  { year: 2004, event: "Public Forum", place: "Runner-up", school: "Nova High School (FL)", competitors: "Alexandra Wall/Natalia Rigol" },
  { year: 2005, event: "Public Forum", place: "Champion", school: "Albuquerque Academy (NM)", competitors: "Hollie Putnam/Heather Campbell" },
  { year: 2005, event: "Public Forum", place: "Runner-up", school: "Torrey Pines (CA)", competitors: "Eric Carino/Ian Hampton" },
  { year: 2006, event: "Public Forum", place: "Co-champion", school: "Manchester-Essex (MA)", competitors: "James Pates/Dan Cellucci" },
  { year: 2006, event: "Public Forum", place: "Co-champion", school: "Manchester-Essex (MA)", competitors: "Ross Cowman/Ryan Swanzey" },
  { year: 2007, event: "Public Forum", place: "Champion", school: "Lexington High School (MA)", competitors: "Chrissy Kugel/Garth Goldwater" },
  { year: 2007, event: "Public Forum", place: "Runner-up", school: "Durham Academy (NC)", competitors: "Patrick Toomey/Katherine Buse" },
  { year: 2008, event: "Public Forum", place: "Champion", school: "North Allegheny (PA)", competitors: "Naz El-Khatib/Claire Kairys" },
  { year: 2008, event: "Public Forum", place: "Runner-up", school: "The Collegiate School (NY)", competitors: "Charles Giardina/Jonathan Yip" },
  { year: 2009, event: "Public Forum", place: "Champion", school: "The Harker School (CA)", competitors: "Kelsey Hilbrich/Kaavya Gowda" },
  { year: 2009, event: "Public Forum", place: "Runner-up", school: "Walt Whitman High School (MD)", competitors: "Alex Edelman/Aaron Schifrin" },
  { year: 2010, event: "Public Forum", place: "Champion", school: "George Washington High School (CO)", competitors: "Gabe Rusk/Brendan Patrick" },
  { year: 2010, event: "Public Forum", place: "Runner-up", school: "Ridge High School (NJ)", competitors: "Brian Moore/Tejus Pradeep" },
  { year: 2011, event: "Public Forum", place: "Champion", school: "The Harker School (CA)", competitors: "Aakash Jagadeesh/Frederic Enea" },
  { year: 2011, event: "Public Forum", place: "Runner-up", school: "Lake Highland Preparatory School (FL)", competitors: "Grant Sinnot/Jake Bayer" },
  { year: 2012, event: "Public Forum", place: "Champion", school: "NSU University School (FL)", competitors: "Dalton Feeley/Daniel Rego" },
  { year: 2012, event: "Public Forum", place: "Runner-up", school: "Walt Whitman High School (MD)", competitors: "Fionn Adamian/Ben Zimmermann" },
  { year: 2013, event: "Public Forum", place: "Champion", school: "Pine View School (FL)", competitors: "Arjun Byju/Mark Allseits" },
  { year: 2013, event: "Public Forum", place: "Runner-up", school: "Ransom Everglades School (FL)", competitors: "Jacob Stern/Megan Mers" },
  { year: 2014, event: "Public Forum", place: "Champion", school: "Walt Whitman High School (MD)", competitors: "Fionn Adamian/Ben Zimmermann" },
  { year: 2014, event: "Public Forum", place: "Runner-up", school: "Walt Whitman High School (MD)", competitors: "Samuel Arnesen/William Arnesen" },
  { year: 2015, event: "Public Forum", place: "Champion", school: "Walt Whitman High School (MD)", competitors: "Samuel Arnesen/William Arnesen" },
  { year: 2015, event: "Public Forum", place: "Runner-up", school: "Ridge High School (NJ)", competitors: "Tim O'Shea/Oliver Tang" },
  { year: 2016, event: "Public Forum", place: "Champion", school: "Pine View School (FL)", competitors: "Aravind Byju/Sho Szczepaniuk" },
  { year: 2016, event: "Public Forum", place: "Runner-up", school: "Mission San Jose High School (CA)", competitors: "Max Wu/Keshav Kundassery" },
  { year: 2017, event: "Public Forum", place: "Champion", school: "The Nueva School (CA)", competitors: "Jake Mengarelli/Matthew Salah" },
  { year: 2017, event: "Public Forum", place: "Runner-up", school: "The Blake School (MN)", competitors: "Ellie Grossman/Connor Yu" },
  { year: 2018, event: "Public Forum", place: "Champion", school: "Newton South (MA)", competitors: "Jay Garg/Anika Sridhar" },
  { year: 2018, event: "Public Forum", place: "Runner-up", school: "Walt Whitman High School (MD)", competitors: "Elisa McCartin/Rabhya Mehrotra" },
  { year: 2019, event: "Public Forum", place: "Champion", school: "The Blake School (MN)", competitors: "Thomas Gill/Jack Johnson" },
  { year: 2019, event: "Public Forum", place: "Runner-up", school: "Lincoln-Sudbury (MA)", competitors: "Daniel Cigale/Sandeep Shankar" },
  { year: 2020, event: "Public Forum", place: "Champion", school: "The Blake School (MN)", competitors: "Morgan Swigert/Jack Johnson" },
  { year: 2020, event: "Public Forum", place: "Runner-up", school: "Westlake (TX)", competitors: "Miles Dintzner/Jason Luo" },
  { year: 2021, event: "Public Forum", place: "Champion", school: "The Dalton School (NY)", competitors: "Daniel Yu/Rebecca Solomon" },
  { year: 2021, event: "Public Forum", place: "Runner-up", school: "University School (OH)", competitors: "Ananth Menon/Marcus Novak" },
  { year: 2022, event: "Public Forum", place: "Champion", school: "Brentwood High School (TN)", competitors: "William Hong/Sully Mrkva" },
  { year: 2022, event: "Public Forum", place: "Runner-up", school: "Strake Jesuit College Preparatory (TX)", competitors: "Ishan Dubey/Ben Goldin" },
  { year: 2023, event: "Public Forum", place: "Champion", school: "Durham Academy (NC)", competitors: "Michael Hansen/Alex Huang" },
  { year: 2023, event: "Public Forum", place: "Runner-up", school: "The Blake School (MN)", competitors: "Elizabeth Terveen/Sofia Perri" },
  { year: 2024, event: "Public Forum", place: "Champion", school: "Strake Jesuit College Preparatory (TX)", competitors: "Daniel Guo/Jason Zhao" },
  { year: 2024, event: "Public Forum", place: "Runner-up", school: "St. Luke's School (CT)", competitors: "Samantha Gerber/Dash Gilrain-Lennon" },
  { year: 2025, event: "Public Forum", place: "Champion", school: "Strake Jesuit College Preparatory (TX)", competitors: "Daniel Guo/Jason Zhao" },
  { year: 2025, event: "Public Forum", place: "Runner-up", school: "Plano West Senior High School (TX)", competitors: "Arrman Kapoor/Anuj Lohtia" },
  { year: 2026, event: "Public Forum", place: "Champion", school: "The Nueva School (CA)", competitors: "Oliver Alferness/Anika Gupta" },
  { year: 2026, event: "Public Forum", place: "Runner-up", school: "The Harker School (CA)", competitors: "Leon Le/Alice Luo" },
  // World Schools
  { year: 2024, event: "World Schools", place: "Champion", school: "Greenhill School (TX)", competitors: "Kaden Alibhai, Emily Hu, Sophia Li, and Sherry Zhang" },
  { year: 2024, event: "World Schools", place: "Runner-up", school: "Harvard-Westlake School (CA)", competitors: "Liv Kriger, Nilufer Mistry-Sheasby, and Nathan Verny" },
  { year: 2025, event: "World Schools", place: "Champion", school: "Greenhill School (TX)", competitors: "Sherry Zhang & Varun Mukund & Saida Bidiwala & Aditi Vikram & Jonaki Bose" },
  { year: 2025, event: "World Schools", place: "Runner-up", school: "Alief Kerr (TX)", competitors: "Leah Ghebrelul & Abigail Nguyen & Sarah Abi Saab & Erica Carranza & Preston Nguyen" },
  // Congress
  { year: 2002, event: "Congress", place: "Champion", school: "Cypress Creek (FL)", competitors: "Kristen Soltis" },
  { year: 2003, event: "Congress", place: "Champion", school: "Lake Highland Preparatory School (FL)", competitors: "Josh Swartsel" },
  { year: 2004, event: "Congress", place: "Champion", school: "Nova High School (FL)", competitors: "Matt Turetzky" },
  { year: 2005, event: "Congress", place: "Champion", school: "Nova High School (FL)", competitors: "Matt Cynamon" },
  { year: 2006, event: "Congress", place: "Champion", school: "Brookwood High School (GA)", competitors: "Cameron Secord" },
  { year: 2007, event: "Congress", place: "Champion", school: "Lake Forest High School (IL)", competitors: "Michael Educate" },
  { year: 2008, event: "Congress", place: "Champion", school: "NSU University School (FL)", competitors: "Mitchell Blenden" },
  { year: 2009, event: "Congress", place: "Champion", school: "Christopher Columbus High School (FL)", competitors: "Joseph Perretta" },
  { year: 2010, event: "Congress", place: "Champion", school: "Ridge High School (NJ)", competitors: "Alex Smyk" },
  { year: 2011, event: "Congress", place: "Champion", school: "Mountain View High School (CA)", competitors: "Rylan Schaeffer" },
  { year: 2012, event: "Congress", place: "Champion", school: "Nova High School (FL)", competitors: "Gregory Bernstein" },
  { year: 2013, event: "Congress", place: "Champion", school: "Nova High School (FL)", competitors: "Gregory Bernstein" },
  { year: 2014, event: "Congress", place: "Champion", school: "Hawken School (OH)", competitors: "Will Mascaro" },
  { year: 2015, event: "Congress", place: "Champion", school: "Southlake Carroll (TX)", competitors: "Azhar Hussain" },
  { year: 2016, event: "Congress", place: "Champion", school: "Ridge High School (NJ)", competitors: "Katherine Kleinle" },
  { year: 2017, event: "Congress", place: "Champion", school: "Western High School (FL)", competitors: "Mohammad Naeem" },
  { year: 2018, event: "Congress", place: "Champion", school: "Poly Prep (NY)", competitors: "Nicholas DeVito" },
  { year: 2019, event: "Congress", place: "Champion", school: "Millburn (NJ)", competitors: "Ranen Miao" },
  { year: 2019, event: "Congress", place: "Runner-up", school: "Bronx High School of Science (NY)", competitors: "Nathan Felmus" },
  { year: 2020, event: "Congress", place: "Champion", school: "John F. Kennedy High School (CA)", competitors: "Rohit Jhawar" },
  { year: 2020, event: "Congress", place: "Runner-up", school: "WB Ray High School (TX)", competitors: "Genevieve Cox" },
  { year: 2020, event: "Congress", place: "Presiding officer", school: "Thomas Jefferson HSST (VA)", competitors: "Manu Onteeru" },
  { year: 2021, event: "Congress", place: "Champion", school: "The Harker School (CA)", competitors: "Andrew Sun" },
  { year: 2021, event: "Congress", place: "Runner-up", school: "Naperville North High School (IL)", competitors: "Zachary Wu" },
  { year: 2021, event: "Congress", place: "Presiding officer", school: "Jackson Hole (WY)", competitors: "Joshua Hansen" },
  { year: 2022, event: "Congress", place: "Champion", school: "Saint Mary's Hall (TX)", competitors: "Anish Beeram" },
  { year: 2022, event: "Congress", place: "Runner-up", school: "Bellarmine College Preparatory (CA)", competitors: "Veer Juneja" },
  { year: 2022, event: "Congress", place: "Presiding officer", school: "Naperville North High School (IL)", competitors: "Zachary Wu" },
  { year: 2023, event: "Congress", place: "Champion", school: "James Logan (CA)", competitors: "Tyler Luu" },
  { year: 2023, event: "Congress", place: "Runner-up", school: "Naperville North High School (IL)", competitors: "Zachary Wu" },
  { year: 2023, event: "Congress", place: "Presiding officer", school: "Seven Lakes High School (TX)", competitors: "Iris Cheng" },
  { year: 2024, event: "Congress", place: "Champion", school: "Seven Lakes High School (TX)", competitors: "Fadhil Lawal" },
  { year: 2024, event: "Congress", place: "Runner-up", school: "Redlands High School (CA)", competitors: "Adrian Baek" },
  { year: 2024, event: "Congress", place: "Presiding officer", school: "Bronx High School of Science (NY)", competitors: "Christopher Procaccino" },
  { year: 2025, event: "Congress", place: "Champion", school: "Pennsbury High School (PA)", competitors: "Swathi Bodduluri" },
  { year: 2025, event: "Congress", place: "Runner-up", school: "East Ridge High School (MN)", competitors: "Daniel Song" },
  { year: 2025, event: "Congress", place: "Presiding officer", school: "The Packer Collegiate Institute (NY)", competitors: "Owen Casey" },
  { year: 2026, event: "Congress", place: "Champion", school: "Arcadia High School (CA)", competitors: "Serena Guo" },
  { year: 2026, event: "Congress", place: "Runner-up", school: "Poland Seminary (OH)", competitors: "Arjun Tuli" },
  { year: 2026, event: "Congress", place: "Presiding officer", school: "American Heritage Broward (FL)", competitors: "Elizabeth Xiao" },
  // Extemporaneous Speaking
  { year: 2013, event: "Extemporaneous Speaking", place: "Champion", school: "Des Moines Roosevelt High School (IA)", competitors: "Lillian Nellans" },
  { year: 2014, event: "Extemporaneous Speaking", place: "Champion", school: "Trinity Preparatory School (FL)", competitors: "Miles Saffran" },
  { year: 2015, event: "Extemporaneous Speaking", place: "Champion", school: "LaRue County High School (KY)", competitors: "Brian Anderson" },
  { year: 2016, event: "Extemporaneous Speaking", place: "Champion", school: "Trinity Preparatory School (FL)", competitors: "Justin Graham" },
  { year: 2017, event: "Extemporaneous Speaking", place: "Champion", school: "Des Moines Roosevelt High School (IA)", competitors: "Jacob Thompson" },
  { year: 2018, event: "Extemporaneous Speaking", place: "Champion", school: "Plano West Senior High School (TX)", competitors: "Nikhil Ramaswamy" },
  { year: 2019, event: "Extemporaneous Speaking", place: "Champion", school: "Potomac School (VA)", competitors: "Katherine Rollins" },
  { year: 2020, event: "Extemporaneous Speaking", place: "Champion", school: "Potomac School (VA)", competitors: "Katherine Rollins" },
  { year: 2021, event: "Extemporaneous Speaking", place: "Champion", school: "Potomac School (VA)", competitors: "Katherine Rollins" },
  { year: 2022, event: "Extemporaneous Speaking", place: "Champion", school: "Phoenix Country Day (AZ)", competitors: "McKinley Paltzik" },
  { year: 2023, event: "Extemporaneous Speaking", place: "Champion", school: "University High School (IL)", competitors: "Pierce McDade" },
  { year: 2024, event: "Extemporaneous Speaking", place: "Champion", school: "NSU University School (FL)", competitors: "Charlotte Reitman" },
  { year: 2025, event: "Extemporaneous Speaking", place: "Champion", school: "NSU University School (FL)", competitors: "Charlotte Reitman" },
  { year: 2026, event: "Extemporaneous Speaking", place: "Champion", school: "The College Preparatory School (CA)", competitors: "Daphne Kalir-Starr" },
  // Original Oratory
  { year: 2013, event: "Original Oratory", place: "Champion", school: "Apple Valley High School (MN)", competitors: "Nader Helmy" },
  { year: 2014, event: "Original Oratory", place: "Champion", school: "Nova High School (FL)", competitors: "Stephanie Bernstein" },
  { year: 2015, event: "Original Oratory", place: "Champion", school: "Rowan County (KY)", competitors: "Lane Hedrick" },
  { year: 2016, event: "Original Oratory", place: "Champion", school: "St. Thomas Aquinas High School (FL)", competitors: "Eve Moll" },
  { year: 2017, event: "Original Oratory", place: "Champion", school: "Valley High School (IA)", competitors: "JJ Kapur" },
  { year: 2018, event: "Original Oratory", place: "Champion", school: "Royse City High School (TX)", competitors: "Noemi Rivera" },
  { year: 2019, event: "Original Oratory", place: "Champion", school: "The Harker School (CA)", competitors: "Avi Gulati" },
  { year: 2020, event: "Original Oratory", place: "Champion", school: "Potomac School (VA)", competitors: "Katherine Rollins" },
  { year: 2021, event: "Original Oratory", place: "Champion", school: "Apple Valley High School (MN)", competitors: "Jihan Abdi" },
  { year: 2022, event: "Original Oratory", place: "Champion", school: "New West Charter (CA)", competitors: "Owen Grossman" },
  { year: 2023, event: "Original Oratory", place: "Champion", school: "Village (TX)", competitors: "Solemei Scamaroni" },
  { year: 2024, event: "Original Oratory", place: "Champion", school: "Lynbrook High School (CA)", competitors: "Vansh Mathur" },
  { year: 2025, event: "Original Oratory", place: "Champion", school: "Potomac School (VA)", competitors: "Hannah DeSouza" },
  { year: 2026, event: "Original Oratory", place: "Champion", school: "Syosset High School (NY)", competitors: "Ella D'Auria" },
  // Dramatic Interpretation
  { year: 2015, event: "Dramatic Interpretation", place: "Champion", school: "Oxbridge Academy (CA)", competitors: "Kella Merlain-Moffatt" },
  { year: 2016, event: "Dramatic Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Craig Heyne" },
  { year: 2017, event: "Dramatic Interpretation", place: "Champion", school: "Summit High School (NJ)", competitors: "Kimberly Lee" },
  { year: 2018, event: "Dramatic Interpretation", place: "Champion", school: "NSU University School (FL)", competitors: "Camilla Maionica" },
  { year: 2019, event: "Dramatic Interpretation", place: "Champion", school: "J. Frank Dobie High School (TX)", competitors: "Caitlyn Woitena" },
  { year: 2020, event: "Dramatic Interpretation", place: "Champion", school: "Alief Early College High School (TX)", competitors: "Elizabeth Lopez-Aguilar" },
  { year: 2021, event: "Dramatic Interpretation", place: "Champion", school: "Wayzata High School (MN)", competitors: "Prem Ganesan" },
  { year: 2022, event: "Dramatic Interpretation", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Abigail Canalejo" },
  { year: 2023, event: "Dramatic Interpretation", place: "Champion", school: "Mercer Island High School (WA)", competitors: "Rachel Senn" },
  { year: 2024, event: "Dramatic Interpretation", place: "Champion", school: "Garland (TX)", competitors: "Adaolisa Agbakwu" },
  { year: 2025, event: "Dramatic Interpretation", place: "Champion", school: "Newark Central (NJ)", competitors: "Jamal Kirton" },
  { year: 2026, event: "Dramatic Interpretation", place: "Champion", school: "Summit High School (NJ)", competitors: "Lucille Adams" },
  // Duo Interpretation
  { year: 2015, event: "Duo Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Berger and Heyne" },
  { year: 2016, event: "Duo Interpretation", place: "Champion", school: "Spring Woods High School (TX)", competitors: "Diaz and Ramirez" },
  { year: 2017, event: "Duo Interpretation", place: "Champion", school: "Fullerton Union High School (CA)", competitors: "Fu and Tran" },
  { year: 2018, event: "Duo Interpretation", place: "Champion", school: "Cypress Bay High School (FL)", competitors: "Cosman and Wurtenberger" },
  { year: 2019, event: "Duo Interpretation", place: "Champion", school: "Ridge High School (NJ)", competitors: "Pai and Sasane" },
  { year: 2021, event: "Duo Interpretation", place: "Champion", school: "Apple Valley High School (MN)", competitors: "Michaelson and Walton" },
  { year: 2022, event: "Duo Interpretation", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Canalejo and Canalejo" },
  { year: 2023, event: "Duo Interpretation", place: "Champion", school: "Har-Ber (AR)", competitors: "Taylor and Largaespada" },
  { year: 2024, event: "Duo Interpretation", place: "Champion", school: "La Jolla HS (CA)", competitors: "Lehman & Lehman" },
  { year: 2025, event: "Duo Interpretation", place: "Champion", school: "Summit High School (NJ)", competitors: "Macgill & Walsh" },
  { year: 2026, event: "Duo Interpretation", place: "Champion", school: "Our Lady Of Good Counsel High School (MD)", competitors: "Fisseha & Sotoye" },
  // Humorous Interpretation
  { year: 2015, event: "Humorous Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Craig Heyne" },
  { year: 2016, event: "Humorous Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Craig Heyne" },
  { year: 2017, event: "Humorous Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Jacob Lieberman" },
  { year: 2018, event: "Humorous Interpretation", place: "Champion", school: "Cypress Bay High School (FL)", competitors: "Alexia Cosman" },
  { year: 2019, event: "Humorous Interpretation", place: "Champion", school: "George Washington High School (CO)", competitors: "Tanner Hemmingsen" },
  { year: 2020, event: "Humorous Interpretation", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Abigail Canalejo" },
  { year: 2021, event: "Humorous Interpretation", place: "Champion", school: "Shrewsbury High School (MA)", competitors: "Reeya Kansra" },
  { year: 2022, event: "Humorous Interpretation", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Oliver Laczko" },
  { year: 2023, event: "Humorous Interpretation", place: "Champion", school: "Redlands High School (CA)", competitors: "Cat-Tam Huynh" },
  { year: 2024, event: "Humorous Interpretation", place: "Champion", school: "Redlands High School (CA)", competitors: "Cat-Tam Huynh" },
  { year: 2025, event: "Humorous Interpretation", place: "Champion", school: "Tuscarawas Valley (OH)", competitors: "Kylie Daum" },
  { year: 2026, event: "Humorous Interpretation", place: "Champion", school: "The Quarry Lane School (CA)", competitors: "Ehab Syed" },
  // Oral Interpretation
  { year: 2015, event: "Oral Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Zenita Collie" },
  { year: 2016, event: "Oral Interpretation", place: "Champion", school: "Nova High School (FL)", competitors: "Craig Heyne" },
  { year: 2017, event: "Oral Interpretation", place: "Champion", school: "Cypress Bay High School (FL)", competitors: "Sterling Wertanzl" },
  { year: 2018, event: "Oral Interpretation", place: "Champion", school: "Ridge High School (NJ)", competitors: "Anjini Mathur" },
  { year: 2019, event: "Oral Interpretation", place: "Champion", school: "Bethlehem High School (KY)", competitors: "Jack Neel" },
  { year: 2020, event: "Oral Interpretation", place: "Champion", school: "Livingston High School (NJ)", competitors: "Jaina Jallow" },
  { year: 2021, event: "Oral Interpretation", place: "Champion", school: "Greenhill School (TX)", competitors: "Joshua Timmons" },
  { year: 2022, event: "Oral Interpretation", place: "Champion", school: "Ridge High School (NJ)", competitors: "Jocelyn Tan" },
  { year: 2023, event: "Oral Interpretation", place: "Champion", school: "Scarsdale High School (NY)", competitors: "Carly Gelles" },
  { year: 2024, event: "Oral Interpretation", place: "Champion", school: "Scarsdale High School (NY)", competitors: "Abigail Underweiser" },
  { year: 2025, event: "Oral Interpretation", place: "Champion", school: "Newark Central (NJ)", competitors: "Jahnaiya Simpson" },
  { year: 2026, event: "Oral Interpretation", place: "Champion", school: "Cabot High School (AR)", competitors: "Juliana Bridges" },
  // Program Oral Interpretation
  { year: 2017, event: "Program Oral Interpretation", place: "Champion", school: "Jupiter High School (FL)", competitors: "Haleigh McGirt" },
  { year: 2018, event: "Program Oral Interpretation", place: "Champion", school: "Lift Academy (MI)", competitors: "Steele Schoeberl" },
  { year: 2019, event: "Program Oral Interpretation", place: "Champion", school: "Chaparral Star Academy (TX)", competitors: "Elise Little" },
  { year: 2020, event: "Program Oral Interpretation", place: "Champion", school: "Miramar High School (FL)", competitors: "Sophia Williams" },
  { year: 2021, event: "Program Oral Interpretation", place: "Champion", school: "Greenhill School (TX)", competitors: "Joshua Timmons" },
  { year: 2022, event: "Program Oral Interpretation", place: "Champion", school: "Western High School (FL)", competitors: "Mariam Kolley" },
  { year: 2023, event: "Program Oral Interpretation", place: "Champion", school: "University School (OH)", competitors: "Kaden Jones" },
  { year: 2024, event: "Program Oral Interpretation", place: "Champion", school: "Ridge High School (NJ)", competitors: "Natalie Ramirez Porras" },
  { year: 2025, event: "Program Oral Interpretation", place: "Champion", school: "University (NJ)", competitors: "Michaela White" },
  { year: 2026, event: "Program Oral Interpretation", place: "Champion", school: "Lindale High School (TX)", competitors: "Coby Jones" },
  // Informative Speaking
  { year: 2018, event: "Informative Speaking", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Jordyn Allen" },
  { year: 2019, event: "Informative Speaking", place: "Champion", school: "American Heritage Broward (FL)", competitors: "Yucheng Lou" },
  { year: 2020, event: "Informative Speaking", place: "Champion", school: "Saratoga High School (CA)", competitors: "Selina Chen" },
  { year: 2021, event: "Informative Speaking", place: "Champion", school: "Apple Valley High School (MN)", competitors: "Ceceilia Voss" },
  { year: 2022, event: "Informative Speaking", place: "Champion", school: "Jordan High School (TX)", competitors: "Karen Cui" },
  { year: 2023, event: "Informative Speaking", place: "Champion", school: "J. Frank Dobie High School (TX)", competitors: "Jocelyn Floyd" },
  { year: 2024, event: "Informative Speaking", place: "Champion", school: "Bear Creek (WA)", competitors: "Cici Yang" },
  { year: 2025, event: "Informative Speaking", place: "Champion", school: "Oak Park (CA)", competitors: "Brystian Heine-Van Fossen" },
  { year: 2026, event: "Informative Speaking", place: "Champion", school: "Trinity Preparatory School (FL)", competitors: "Ashwin Anand" },
]

/** One school's TOC record, oldest result first. */
export interface TocSchoolRecord {
  school: string
  results: TocResult[]
  /** Championships, counting a close-out or shared title. */
  titles: number
  runnerUps: number
  topSpeakers: number
  /** Events the school has a result in, in {@link TOC_EVENTS} order. */
  events: TocEvent[]
}

/** Groups {@link TOC_RESULTS} by school and counts each one's finishes. */
export function tocRecordsBySchool(results: TocResult[] = TOC_RESULTS): TocSchoolRecord[] {
  const bySchool = new Map<string, TocResult[]>()
  for (const result of [...results].sort((a, b) => a.year - b.year)) {
    const list = bySchool.get(result.school) ?? []
    list.push(result)
    bySchool.set(result.school, list)
  }
  return [...bySchool].map(([school, list]) => ({
    school,
    results: list,
    titles: list.filter((r) => r.place === "Champion" || r.place === "Co-champion").length,
    runnerUps: list.filter((r) => r.place === "Runner-up").length,
    topSpeakers: list.filter((r) => r.place === "Top speaker").length,
    events: TOC_EVENTS.filter((event) => list.some((r) => r.event === event)),
  }))
}

/**
 * A high school's TOC record, or `null` when it has none or the name is
 * ambiguous. Names must agree exactly after {@link tocSchoolKey} (or match a
 * listed alias), so "Montgomery" never inherits "Montgomery Bell" and
 * "Westlake" never inherits "Harvard-Westlake". A state tag on the query
 * picks between same-named schools ("Highland Park (MN)" vs. "(TX)"); a bare
 * name shared by two states ("University", "Highland Park") matches neither.
 *
 * @param school - School name as the rankings or a school page spell it.
 */
export function findTocSchoolRecord(school: string, records: TocSchoolRecord[] = tocRecordsBySchool()): TocSchoolRecord | null {
  const key = tocSchoolKey(school)
  if (!key) return null
  const state = tocSchoolState(school)
  if (!state && AMBIGUOUS_KEYS.has(key)) return null
  const matches = records.filter(
    (record) =>
      (tocSchoolKey(record.school) === key || ALIASES[record.school]?.includes(key)) &&
      (!state || !tocSchoolState(record.school) || tocSchoolState(record.school) === state),
  )
  return matches.length === 1 ? matches[0] : null
}
