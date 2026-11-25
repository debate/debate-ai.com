/**
 * @fileoverview The Glenbrooks Speech and Debate Tournament (Glenbrook North
 * and Glenbrook South, Northbrook, Illinois), a November high school national
 * in Varsity Policy, Lincoln-Douglas and Public Forum: champions, finalists
 * (the entry that lost the final), the semifinalists a source names, and the
 * top speaker. School pages count a Glenbrooks title as a championship
 * alongside the TOC, NDCA, Barkley Forum and Cal Invitational.
 *
 * Years on record: Policy 1980–2016, 2018, 2019, 2023–2025; LD 1991, 1992,
 * 1996–1999, 2002–2025; PF 2009, 2016–2018, 2023, 2024. Most early years come
 * from the "Parade of Champions" in the tournament's own 2017 program
 * ({@link GLENBROOKS_PROGRAM_URL}; the LD list there calls itself "a work in
 * progress" and its places are read from row order), later ones from Victory
 * Briefs and HS Impact write-ups and school news pages. Years with no
 * published source (Policy 2017, 2020–2022; PF 2010–2015, 2019–2022, 2025)
 * and the 2026 tournament (results not yet posted) are left out rather than
 * guessed. Speech events and the round robins aren't recorded.
 *
 * `year` is the calendar year the tournament was held (late November, so the
 * first half of that season). School names use the TOC record's canonical
 * spelling where it has the school, so school pages match them the same way.
 * @module sync/glenbrooks-champions
 */

import { matchTocSchool, tocSchoolKey } from "./toc-champions"

/** The tournament's 2017 program, with its Policy and LD "Parade of Champions". */
export const GLENBROOKS_PROGRAM_URL =
  "https://s3.amazonaws.com/tabroom-files/tourns/7581/postings/10995/GlenbrooksTournamentProgram--2017.pdf"

/** Where each year's results come from, when it isn't {@link GLENBROOKS_PROGRAM_URL}. */
export const GLENBROOKS_SOURCE_URLS: Readonly<Record<string, string>> = {
  "2025 Policy": "https://www.cmestrategy.org/coaches",
  "2025 LD": "https://coppelldebate.com/2025-26",
  "2024 Policy": "https://hsimpact.wordpress.com/2024/12/31/coaches-poll-2-berkeley-prep-rv-1/",
  "2024 LD": "https://www.cmestrategy.org/",
  "2024 PF": "https://sjmagis.com/2025/02/26/s-j-debaters-take-home-the-gold-in-a-record-breaking-semester/",
  "2023 Policy": "https://hsimpact.wordpress.com/2024/01/05/december-coaches-poll-lasa-bd-1/",
  "2023": "https://victorybriefs.substack.com/p/1115-1122-ld-and-pf-tournament-results",
  "2022 LD": "https://victorybriefs.substack.com/p/yesh-rao-wins-glenbrooks",
  "2021 LD": "https://victorybriefs.substack.com/p/zion-dixon-and-leah-yeshitila-co-champion-glenbrooks",
  "2020 LD": "https://victorybriefs.substack.com/p/giovanni-cutri-wins-glenbrooks",
  "2019 Policy": "https://hsimpact.wordpress.com/2019/12/03/congrats-to-coppell-dr-for-winning-the-glenbrooks/",
  "2019 LD": "https://victorybriefs.substack.com/p/rex-evans-wins-the-glenbrooks",
  "2018 Policy": "https://hsimpact.wordpress.com/2018/11/25/greenhill-ae-wins-2018-glenbrooks-invitational/",
  "2018 LD": "https://victorybriefs.substack.com/p/ishan-bhatt-wins-glenbrooks",
  "2018 PF": "https://victorybriefs.substack.com/p/bronx-science-wins-the-glenbrooks",
  "2017 LD": "https://victorybriefs.substack.com/p/brianna-aaron-wins-the-glenbrooks",
  "2017 PF": "https://victorybriefs.substack.com/p/strake-jesuit-wins-the-glenbrooks",
  "2016 Policy": "https://www.montgomerybell.edu/news-detail?pk=1072928",
  "2016 LD": "https://victorybriefs.substack.com/p/evan-engel-wins-glenbrooks",
  "2016 PF": "https://victorybriefs.substack.com/p/blake-takes-glenbrooks",
  "2015 LD": "https://victorybriefs.substack.com/p/bennett-eckert-wins-glenbrooks",
  "2014 Policy": "https://hsimpact.wordpress.com/2014/11/24/pace-academy-ga-wins-the-2014-glenbrooks-tournament/",
  "2014 LD": "https://victorybriefs.substack.com/p/pranav-reddy-wins-glenbrooks",
  "2013 Policy": "https://hsimpact.wordpress.com/2013/11/25/whitney-young-ds-wins-the-2013-glenbrooks-tournament/",
  "2013 LD": "https://medium.com/vbriefly/danny-debois-wins-the-2013-glenbrooks-invitational-25153c976b1e",
  "2009 PF": "https://www.da.org/student-experience/speechanddebate/history",
}

export interface GlenbrooksResult {
  /** The calendar year the tournament was held (late November). */
  year: number
  event: "Policy" | "Lincoln-Douglas" | "Public Forum"
  /** A close-out (two teammates who don't debate the final) or a shared title is `"Co-champion"`. */
  place: "Champion" | "Co-champion" | "Finalist" | "Semifinalist" | "Top speaker"
  school: string
  competitors: string
  /** The source gives only surnames or a team code, so the row credits no debater. */
  partialNames?: boolean
  /**
   * The source doesn't settle the result: the year or place is inferred
   * ("PROBABLE", or marked "?" in the source). It's counted like any other
   * row and shown on school pages with a "probable" note.
   */
  probable?: boolean
}

const P = "Policy" as const
const LD = "Lincoln-Douglas" as const
const PF = "Public Forum" as const

const BLAKE = "The Blake School (MN)"
const CADDO = "Caddo Magnet (LA)"
const GEORGETOWN_DAY = "Georgetown Day School (DC)"
const GREENHILL = "Greenhill School (TX)"
const HARKER = "The Harker School (CA)"
const HARRISON = "Harrison High School (NY)"
const HARVARD_WESTLAKE = "Harvard-Westlake School (CA)"
const KINKAID = "The Kinkaid School (TX)"
const LEXINGTON = "Lexington High School (MA)"
const MBA = "Montgomery Bell Academy (TN)"
const PACE = "Pace Academy (GA)"
const PENINSULA = "Peninsula High School (CA)"
const SCARSDALE = "Scarsdale High School (NY)"
const ST_MARKS = "St. Mark's School of Texas (TX)"
const STRAKE = "Strake Jesuit College Preparatory (TX)"
const VALLEY = "Valley High School (IA)"
const WESTMINSTER = "The Westminster Schools (GA)"

/** Glenbrooks finals, named semifinalists and top speakers on record, oldest first. */
export const GLENBROOKS_RESULTS: GlenbrooksResult[] = [
  // Policy, from the tournament's Parade of Champions (spelling as printed)
  { year: 1980, event: P, place: "Champion", school: "Lakeland High School (NY)", competitors: "Neil Abramson & Curt Buser" },
  { year: 1980, event: P, place: "Finalist", school: "Lake Braddock (VA)", competitors: "Jonathan Massey & Michael Leiss" },
  { year: 1980, event: P, place: "Top speaker", school: "Lakeland High School (NY)", competitors: "Neil Abramson" },
  { year: 1981, event: P, place: "Champion", school: "Oak Park & River Forest (IL)", competitors: "Eric Brackett & Sean Martin" },
  { year: 1981, event: P, place: "Finalist", school: "Glenbrook North High School (IL)", competitors: "Peter Braverman & Ken Karas" },
  { year: 1981, event: P, place: "Top speaker", school: "Oak Park & River Forest (IL)", competitors: "Eric Brackett" },
  { year: 1982, event: P, place: "Champion", school: "Coral Gables High School (FL)", competitors: "Lars Noah & Neil McAlily" },
  { year: 1982, event: P, place: "Finalist", school: "Spring Valley High School (SC)", competitors: "Charlie Synn & Randy Riker" },
  { year: 1982, event: P, place: "Top speaker", school: "Coral Gables High School (FL)", competitors: "Lars Noah" },
  { year: 1983, event: P, place: "Champion", school: "New Trier High School (IL)", competitors: "Moira McDermott & Laura Michaelis" },
  { year: 1983, event: P, place: "Finalist", school: LEXINGTON, competitors: "Aaron Pressman & Mark Friedman" },
  { year: 1983, event: P, place: "Top speaker", school: "Dowling (IA)", competitors: "David Brownell" },
  { year: 1984, event: P, place: "Champion", school: "New Trier High School (IL)", competitors: "Henry Vogel & Seth Slavin" },
  { year: 1984, event: P, place: "Finalist", school: "Lake Braddock (VA)", competitors: "Mike Green & Joe Pettit" },
  { year: 1984, event: P, place: "Top speaker", school: ST_MARKS, competitors: "Cullum Clark" },
  { year: 1985, event: P, place: "Champion", school: KINKAID, competitors: "Joe Thompson & Andy Edison" },
  { year: 1985, event: P, place: "Finalist", school: WESTMINSTER, competitors: "Gus Puryear & Chris Landgraft" },
  { year: 1985, event: P, place: "Top speaker", school: MBA, competitors: "Madison Laird" },
  { year: 1986, event: P, place: "Champion", school: WESTMINSTER, competitors: "Mark Malaspina & Chris Landgraft" },
  { year: 1986, event: P, place: "Finalist", school: KINKAID, competitors: "Joe Thompson & Andy Edison" },
  { year: 1986, event: P, place: "Top speaker", school: KINKAID, competitors: "Joe Thompson" },
  { year: 1987, event: P, place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Debbie Loevy & Adam Goodman" },
  { year: 1987, event: P, place: "Finalist", school: "Damien High School (CA)", competitors: "Kevin Tessier & Paul Derby" },
  { year: 1987, event: P, place: "Top speaker", school: "Hendrick Hudson High School (NY)", competitors: "Chris Newman" },
  { year: 1988, event: P, place: "Champion", school: KINKAID, competitors: "Justin Shrader & Jon Brody" },
  { year: 1988, event: P, place: "Finalist", school: ST_MARKS, competitors: "Craig Ackerman & Jack Stroube" },
  { year: 1988, event: P, place: "Top speaker", school: "Dowling (IA)", competitors: "Jean Chleborad" },
  { year: 1989, event: P, place: "Champion", school: ST_MARKS, competitors: "Steven Sklaver & Craig Ackerman" },
  { year: 1989, event: P, place: "Finalist", school: KINKAID, competitors: "Justin Shrader & Jon Brody" },
  { year: 1989, event: P, place: "Top speaker", school: "Lexington-Clay (KY)", competitors: "Fred Karem" },
  { year: 1990, event: P, place: "Champion", school: "Upper Arlington High School (OH)", competitors: "Chris Barth & Abe Newman" },
  { year: 1990, event: P, place: "Finalist", school: KINKAID, competitors: "Stapp Beeton & Bret Larson-Hendricks" },
  { year: 1990, event: P, place: "Top speaker", school: "Washington High School (IA)", competitors: "Amanda Merriman" },
  { year: 1991, event: P, place: "Champion", school: MBA, competitors: "Behdad Shahsavari & Robert Howell" },
  { year: 1991, event: P, place: "Finalist", school: "Edgemont High School (NY)", competitors: "Avi Weitzman & Gil Weitzman" },
  { year: 1991, event: P, place: "Top speaker", school: "Evanston Township (IL)", competitors: "Chris Newman" },
  { year: 1992, event: P, place: "Champion", school: "New Orleans Jesuit High School (LA)", competitors: "Kris Bonilla & Todd Brown" },
  { year: 1992, event: P, place: "Finalist", school: LEXINGTON, competitors: "Matthew Stephen & Li Cheng Wang" },
  { year: 1992, event: P, place: "Top speaker", school: LEXINGTON, competitors: "Dan Marx" },
  { year: 1993, event: P, place: "Champion", school: LEXINGTON, competitors: "Steve Lehotsky & Li Cheng Wang" },
  { year: 1993, event: P, place: "Finalist", school: "Charlotte Latin School (NC)", competitors: "Nita Farahany & Marshall Brenizer" },
  { year: 1993, event: P, place: "Top speaker", school: WESTMINSTER, competitors: "Anjan Sahni" },
  { year: 1994, event: P, place: "Champion", school: "Edison High School (VA)", competitors: "Natalie Horowitz & Ryan Sparacino" },
  { year: 1994, event: P, place: "Finalist", school: LEXINGTON, competitors: "Matt Nichols & Steve Lehotsky" },
  { year: 1994, event: P, place: "Top speaker", school: "Niles West (IL)", competitors: "George Kouros" },
  { year: 1995, event: P, place: "Champion", school: "Edison High School (VA)", competitors: "Emma Filstrup & Ryan Sparacino" },
  { year: 1995, event: P, place: "Finalist", school: CADDO, competitors: "Jarrod Atchison & Andrew Ryan" },
  { year: 1995, event: P, place: "Top speaker", school: "Damien High School (CA)", competitors: "John Miller" },
  { year: 1996, event: P, place: "Champion", school: CADDO, competitors: "Kamal Ghali & Andrew Ryan" },
  { year: 1996, event: P, place: "Finalist", school: GREENHILL, competitors: "Josh Goldberg & Rashad Hussain" },
  { year: 1996, event: P, place: "Top speaker", school: GEORGETOWN_DAY, competitors: "Alex Berger" },
  { year: 1997, event: P, place: "Champion", school: "Head-Royce School (CA)", competitors: "Jake Foster & Sebastian Kaplan-Sears" },
  { year: 1997, event: P, place: "Finalist", school: GEORGETOWN_DAY, competitors: "Alex Berger & Matt Ornstein" },
  { year: 1997, event: P, place: "Top speaker", school: "East Grand Rapids High School (MI)", competitors: "Geoff Lundeen" },
  { year: 1998, event: P, place: "Champion", school: MBA, competitors: "Raja Gaddipati & Robbie Quinn" },
  { year: 1998, event: P, place: "Finalist", school: "East Lansing High School (MI)", competitors: "Calum Matheson & Joe Siegmann" },
  { year: 1998, event: P, place: "Top speaker", school: "East Lansing High School (MI)", competitors: "Calum Matheson" },
  { year: 1999, event: P, place: "Champion", school: "El Cerrito High School (CA)", competitors: "Rebecca Heller & Dan McKenzie" },
  { year: 1999, event: P, place: "Finalist", school: PACE, competitors: "Michael Harbour & Ben Thorpe" },
  { year: 1999, event: P, place: "Top speaker", school: "Brother Rice High School (MI)", competitors: "Dan Grimm" },
  { year: 2000, event: P, place: "Champion", school: GREENHILL, competitors: "Racquel Bracken & Jordan Pietzsch" },
  { year: 2000, event: P, place: "Finalist", school: CADDO, competitors: "Sameer Asher & Nermin Ghali" },
  { year: 2000, event: P, place: "Top speaker", school: "St. Thomas Academy (MN)", competitors: "Scott Phillips" },
  { year: 2001, event: P, place: "Champion", school: ST_MARKS, competitors: "Josh Branson & Michael Martin" },
  { year: 2001, event: P, place: "Finalist", school: "Marquette University High School (WI)", competitors: "Ankur Aggarwal & Manav Bhatnagar" },
  { year: 2001, event: P, place: "Top speaker", school: "Marquette University High School (WI)", competitors: "Manav Bhatnagar" },
  { year: 2002, event: P, place: "Champion", school: "Colleyville Heritage High School (TX)", competitors: "Aimi Hamraie & Justin Murray" },
  { year: 2002, event: P, place: "Finalist", school: WESTMINSTER, competitors: "Arif Lakhani & Aleem Ramji" },
  { year: 2002, event: P, place: "Top speaker", school: VALLEY, competitors: "Srinivas Akella" },
  { year: 2003, event: P, place: "Champion", school: "College Preparatory School (CA)", competitors: "Michael Burshteyn & Eli Anders" },
  { year: 2003, event: P, place: "Finalist", school: GREENHILL, competitors: "Rachel Haig & Jessica Stolbach" },
  { year: 2003, event: P, place: "Top speaker", school: LEXINGTON, competitors: "Katrina Keverian" },
  { year: 2004, event: P, place: "Champion", school: WESTMINSTER, competitors: "Anusha Deshpande & Stephen Weil" },
  { year: 2004, event: P, place: "Finalist", school: "Chattahoochee High School (GA)", competitors: "Garrett Abelkopf & John Warden" },
  { year: 2004, event: P, place: "Top speaker", school: WESTMINSTER, competitors: "Anusha Deshpande" },
  { year: 2005, event: P, place: "Champion", school: WESTMINSTER, competitors: "Stephen Weil & Josh McLaurin" },
  { year: 2005, event: P, place: "Finalist", school: "Centerville (OH)", competitors: "Alec Wright & Eli Jacobs" },
  { year: 2005, event: P, place: "Top speaker", school: WESTMINSTER, competitors: "Stephen Weil" },
  { year: 2006, event: P, place: "Champion", school: GREENHILL, competitors: "Matt Andrews & Bryant Huang" },
  { year: 2006, event: P, place: "Finalist", school: WESTMINSTER, competitors: "Stephen Weil & Anshu Sathian" },
  { year: 2006, event: P, place: "Top speaker", school: GREENHILL, competitors: "Matt Andrews" },
  { year: 2007, event: P, place: "Champion", school: "Chattahoochee High School (GA)", competitors: "Matthew Fortich & Michael Lacy" },
  { year: 2007, event: P, place: "Finalist", school: KINKAID, competitors: "Ryan Beiermeister & Daniel Sharp" },
  { year: 2007, event: P, place: "Top speaker", school: KINKAID, competitors: "Ryan Beiermeister" },
  { year: 2008, event: P, place: "Champion", school: WESTMINSTER, competitors: "Rajesh Jegadeesh & Anshu Sathian" },
  { year: 2008, event: P, place: "Finalist", school: ST_MARKS, competitors: "Alex Gulakov & Alex Miles" },
  { year: 2008, event: P, place: "Top speaker", school: PACE, competitors: "Peyton Lee" },
  { year: 2009, event: P, place: "Champion", school: "Westlake (TX)", competitors: "John Baker & David Mullins" },
  { year: 2009, event: P, place: "Finalist", school: "Damien High School (CA)", competitors: "Reid Ehrlich-Quinn & Pablo Gannon" },
  { year: 2009, event: P, place: "Top speaker", school: GEORGETOWN_DAY, competitors: "Rebecca Rothfeld" },
  { year: 2010, event: P, place: "Champion", school: ST_MARKS, competitors: "Rishi Batra & Alex Miles" },
  { year: 2010, event: P, place: "Finalist", school: "Gulliver Preparatory School (FL)", competitors: "Greg Adler & Jorge Toledo" },
  { year: 2010, event: P, place: "Top speaker", school: WESTMINSTER, competitors: "Ellis Allen" },
  { year: 2011, event: P, place: "Champion", school: GREENHILL, competitors: "Lyall Stuart & Azhar Unwala" },
  { year: 2011, event: P, place: "Finalist", school: "Homewood-Flossmoor High School (IL)", competitors: "Donald Grasse & Margaret Strong" },
  { year: 2011, event: P, place: "Top speaker", school: "Iowa City West High School (IA)", competitors: "Jeffrey Ding" },
  { year: 2012, event: P, place: "Champion", school: GREENHILL, competitors: "Ben Packer & Andrew Spomer" },
  { year: 2012, event: P, place: "Finalist", school: PACE, competitors: "Jordan Epstein & Victor Skendri" },
  { year: 2012, event: P, place: "Top speaker", school: "Stratford Academy (GA)", competitors: "Hemanth Sanjeev" },
  // 2013 on, from HS Impact write-ups where it has them
  { year: 2013, event: P, place: "Champion", school: "Whitney M. Young Magnet High School (IL)", competitors: "Jeron Dastrup & Kat Sears" },
  { year: 2013, event: P, place: "Finalist", school: "Brophy College Preparatory (AZ)", competitors: "Ryan McCoy & Gavin Singer" },
  { year: 2013, event: P, place: "Top speaker", school: "Pine Crest School (FL)", competitors: "Julian Gruber" },
  { year: 2014, event: P, place: "Champion", school: PACE, competitors: "Tanner Lewis & Clyde Shepherd" },
  { year: 2014, event: P, place: "Finalist", school: CADDO, competitors: "Alden Connor & Calen Martin" },
  { year: 2014, event: P, place: "Top speaker", school: "Atholton High School (MD)", competitors: "Isabel Slavinsky" },
  // The program's 2015–16 rows are jumbled; 2015's year and places are inferred from row order.
  { year: 2015, event: P, place: "Champion", school: "The Blake School (MN)", competitors: "Allen Wang & Zahir Shaikh", probable: true },
  { year: 2015, event: P, place: "Finalist", school: "Little Rock Central High School (AR)", competitors: "Peyton Woods & DJ Williams", probable: true },
  { year: 2015, event: P, place: "Top speaker", school: "Homewood-Flossmoor High School (IL)", competitors: "Carter Levinson", probable: true },
  { year: 2016, event: P, place: "Champion", school: MBA, competitors: "Andrew Kaplan & Ben Rosenthal" },
  { year: 2016, event: P, place: "Finalist", school: PENINSULA, competitors: "Rahm Tambe & Jerry Wang" },
  { year: 2016, event: P, place: "Top speaker", school: PENINSULA, competitors: "Jerry Wang" },
  { year: 2018, event: P, place: "Champion", school: GREENHILL, competitors: "Samar Ahmad & Christopher Eckert" },
  { year: 2018, event: P, place: "Finalist", school: "North Broward Preparatory School (FL)", competitors: "Mancini & Rabbini", partialNames: true },
  { year: 2018, event: P, place: "Semifinalist", school: "Northside", competitors: "Pinheiro & Ortiz", partialNames: true },
  { year: 2018, event: P, place: "Semifinalist", school: MBA, competitors: "Barton & Habermann", partialNames: true },
  { year: 2019, event: P, place: "Champion", school: "Coppell High School (TX)", competitors: "Het Desai & Shreyas Rajagopal" },
  { year: 2019, event: P, place: "Finalist", school: MBA, competitors: "BM", partialNames: true },
  { year: 2019, event: P, place: "Semifinalist", school: "North Broward Preparatory School (FL)", competitors: "DF", partialNames: true },
  { year: 2019, event: P, place: "Semifinalist", school: "Whitney M. Young Magnet High School (IL)", competitors: "MM", partialNames: true },
  { year: 2019, event: P, place: "Top speaker", school: MBA, competitors: "Aden Barton" },
  { year: 2023, event: P, place: "Champion", school: "Liberal Arts and Science Academy (TX)", competitors: "Eleanor Barrett & Jack Dollinger" },
  { year: 2023, event: P, place: "Finalist", school: PENINSULA, competitors: "Kevin Lai & Devin Lai" },
  { year: 2023, event: P, place: "Semifinalist", school: "Westwood High School (TX)", competitors: "ST", partialNames: true },
  { year: 2024, event: P, place: "Champion", school: "Westwood High School (TX)", competitors: "Andrew & Balakrishnan", partialNames: true },
  { year: 2024, event: P, place: "Finalist", school: "Berkeley Preparatory School (FL)", competitors: "RV", partialNames: true },
  { year: 2024, event: P, place: "Semifinalist", school: MBA, competitors: "SJ", partialNames: true },
  // Ethan Camp's coaching bio says "Glenbrooks champion" with no year; 2025 is the only year that fits.
  { year: 2025, event: P, place: "Champion", school: "Glenbrook North High School (IL)", competitors: "Ethan Camp & Joe Rozenblat", probable: true },

  // Lincoln-Douglas, from the tournament's LD Parade of Champions through 2012
  { year: 1991, event: LD, place: "Champion", school: "Vestavia Hills High School (AL)", competitors: "Jason Baldwin" },
  { year: 1992, event: LD, place: "Champion", school: "Vestavia Hills High School (AL)", competitors: "Jason Baldwin" },
  { year: 1992, event: LD, place: "Finalist", school: "Shenendehowa High School (NY)", competitors: "Liz Rogers", probable: true },
  // The program marks this year "1996?".
  { year: 1996, event: LD, place: "Champion", school: VALLEY, competitors: "Brian Fletcher", probable: true },
  { year: 1996, event: LD, place: "Finalist", school: "Bergenfield High School (NJ)", competitors: "Abdul Beretay", probable: true },
  { year: 1997, event: LD, place: "Champion", school: "Walt Whitman High School (MD)", competitors: "Sarah Richardson" },
  { year: 1998, event: LD, place: "Champion", school: "Des Moines Roosevelt High School (IA)", competitors: "Stephen Davis" },
  { year: 1998, event: LD, place: "Finalist", school: "Grapevine High School (TX)", competitors: "Paul Gravley" },
  { year: 1998, event: LD, place: "Top speaker", school: "Edmond North High School (OK)", competitors: "Nathan Foell", probable: true },
  { year: 1999, event: LD, place: "Champion", school: "Hopkins High School (MN)", competitors: "Tom Pryor" },
  { year: 2002, event: LD, place: "Co-champion", school: "Edina High School (MN)", competitors: "Nick Green" },
  { year: 2002, event: LD, place: "Co-champion", school: "Edina High School (MN)", competitors: "John McNeil" },
  { year: 2003, event: LD, place: "Co-champion", school: "Edina High School (MN)", competitors: "Jed Glickstein" },
  { year: 2003, event: LD, place: "Co-champion", school: "Edina High School (MN)", competitors: "John McNeil" },
  { year: 2004, event: LD, place: "Champion", school: GREENHILL, competitors: "David Wolfish" },
  { year: 2005, event: LD, place: "Champion", school: "St. James School (AL)", competitors: "Michael Mangus" },
  { year: 2005, event: LD, place: "Finalist", school: "Berkeley Carroll School (NY)", competitors: "Jacob Levi" },
  { year: 2005, event: LD, place: "Top speaker", school: SCARSDALE, competitors: "Matt Shields" },
  { year: 2006, event: LD, place: "Champion", school: "Sacred Heart (MA)", competitors: "Shadman Zaman" },
  { year: 2006, event: LD, place: "Finalist", school: SCARSDALE, competitors: "Matt Aks" },
  { year: 2006, event: LD, place: "Top speaker", school: SCARSDALE, competitors: "Matt Aks" },
  { year: 2007, event: LD, place: "Champion", school: "Trinity Preparatory School (FL)", competitors: "Jake Nebel" },
  { year: 2007, event: LD, place: "Finalist", school: SCARSDALE, competitors: "Ken Hershey" },
  { year: 2007, event: LD, place: "Top speaker", school: KINKAID, competitors: "Becca Traber" },
  { year: 2008, event: LD, place: "Champion", school: "Trinity Preparatory School (FL)", competitors: "Jake Nebel" },
  { year: 2008, event: LD, place: "Finalist", school: "Upper St. Clair High School (PA)", competitors: "J.P. Gooderman" },
  { year: 2008, event: LD, place: "Top speaker", school: "Edina High School (MN)", competitors: "Ben Holguin" },
  { year: 2009, event: LD, place: "Champion", school: "Walt Whitman High School (MD)", competitors: "Ben Lewis" },
  { year: 2009, event: LD, place: "Finalist", school: VALLEY, competitors: "Matt Kawahara" },
  { year: 2009, event: LD, place: "Top speaker", school: "St. Louis Park High School (MN)", competitors: "Catherine Tarsney" },
  { year: 2010, event: LD, place: "Champion", school: "Northland Christian (TX)", competitors: "Josh Roberts" },
  { year: 2010, event: LD, place: "Finalist", school: "Indian Springs School (AL)", competitors: "Larry Liu" },
  { year: 2011, event: LD, place: "Champion", school: SCARSDALE, competitors: "Geoffrey Kristof" },
  { year: 2011, event: LD, place: "Finalist", school: PENINSULA, competitors: "Daniel Tartakovsky" },
  { year: 2012, event: LD, place: "Champion", school: GREENHILL, competitors: "Rebecca Kuang" },
  { year: 2012, event: LD, place: "Finalist", school: PENINSULA, competitors: "Henry Zhang" },
  { year: 2012, event: LD, place: "Top speaker", school: "Carpe Diem (NJ)", competitors: "Joseph Millman" },
  // 2013 on, from Victory Briefs
  { year: 2013, event: LD, place: "Champion", school: HARRISON, competitors: "Danny DeBois" },
  { year: 2013, event: LD, place: "Finalist", school: "La Jolla HS (CA)", competitors: "Ram Prasad" },
  { year: 2013, event: LD, place: "Semifinalist", school: "Newark Science (NJ)", competitors: "Christian Quiroz" },
  { year: 2013, event: LD, place: "Semifinalist", school: "Loyola High School (CA)", competitors: "Chris Kymn" },
  { year: 2013, event: LD, place: "Top speaker", school: "La Jolla HS (CA)", competitors: "Ram Prasad" },
  { year: 2014, event: LD, place: "Champion", school: HARKER, competitors: "Pranav Reddy" },
  { year: 2014, event: LD, place: "Finalist", school: "Brentwood (CA)", competitors: "Jackson Lallas" },
  { year: 2014, event: LD, place: "Semifinalist", school: PENINSULA, competitors: "Arjun Tambe" },
  { year: 2014, event: LD, place: "Semifinalist", school: "Clements (CA)", competitors: "Felix Tan" },
  { year: 2014, event: LD, place: "Top speaker", school: HARKER, competitors: "Pranav Reddy" },
  { year: 2015, event: LD, place: "Champion", school: GREENHILL, competitors: "Bennett Eckert" },
  { year: 2015, event: LD, place: "Finalist", school: HARRISON, competitors: "Sarah Ryan" },
  { year: 2015, event: LD, place: "Top speaker", school: GREENHILL, competitors: "Varad Agarwala", probable: true },
  { year: 2016, event: LD, place: "Champion", school: HARVARD_WESTLAKE, competitors: "Evan Engel" },
  { year: 2016, event: LD, place: "Finalist", school: "Cambridge Rindge and Latin School (MA)", competitors: "Oliver Sussman" },
  { year: 2016, event: LD, place: "Semifinalist", school: HARVARD_WESTLAKE, competitors: "Connor Engel" },
  { year: 2016, event: LD, place: "Top speaker", school: "Success Academy (NY)", competitors: "Sekou Cisse" },
  { year: 2017, event: LD, place: "Champion", school: "Newark Science (NJ)", competitors: "Brianna Aaron" },
  { year: 2017, event: LD, place: "Finalist", school: GREENHILL, competitors: "Shruthi Krishnan" },
  { year: 2017, event: LD, place: "Top speaker", school: "Lake Highland Preparatory School (FL)", competitors: "Ariel Azbel" },
  { year: 2018, event: LD, place: "Champion", school: "St. Andrew's Episcopal (MS)", competitors: "Ishan Bhatt" },
  { year: 2018, event: LD, place: "Finalist", school: HARVARD_WESTLAKE, competitors: "Jaya Nayar" },
  { year: 2018, event: LD, place: "Top speaker", school: "St. Andrew's Episcopal (MS)", competitors: "Ishan Bhatt" },
  { year: 2019, event: LD, place: "Champion", school: "Santa Monica (CA)", competitors: "Rex Evans" },
  { year: 2019, event: LD, place: "Finalist", school: VALLEY, competitors: "Animesh Joshi" },
  { year: 2020, event: LD, place: "Champion", school: HARRISON, competitors: "Giovanni Cutri" },
  { year: 2020, event: LD, place: "Finalist", school: HARVARD_WESTLAKE, competitors: "Andrew Gong" },
  { year: 2020, event: LD, place: "Top speaker", school: STRAKE, competitors: "Joey Georges" },
  // Two co-champions from different schools.
  { year: 2021, event: LD, place: "Co-champion", school: STRAKE, competitors: "Zion Dixon" },
  { year: 2021, event: LD, place: "Co-champion", school: "Garland (TX)", competitors: "Leah Yeshitila" },
  { year: 2021, event: LD, place: "Semifinalist", school: "BASIS Peoria (AZ)", competitors: "Philimon Yosafat" },
  { year: 2021, event: LD, place: "Semifinalist", school: LEXINGTON, competitors: "Vikrant Maan" },
  { year: 2021, event: LD, place: "Top speaker", school: STRAKE, competitors: "Zion Dixon" },
  { year: 2022, event: LD, place: "Champion", school: "San Mateo High School (CA)", competitors: "Yesh Rao" },
  { year: 2022, event: LD, place: "Finalist", school: HARRISON, competitors: "Jessie Pein" },
  { year: 2022, event: LD, place: "Top speaker", school: "St. Agnes Academy (TX)", competitors: "Ella Huang" },
  { year: 2023, event: LD, place: "Champion", school: HARKER, competitors: "Ansh Sheth" },
  { year: 2023, event: LD, place: "Finalist", school: STRAKE, competitors: "Justin Wen" },
  { year: 2023, event: LD, place: "Top speaker", school: STRAKE, competitors: "Nathan Wei" },
  // Om Modi's coaching firm lists "Glenbrooks 2024 - 1st"; Strake's paper confirms Wen took second.
  { year: 2024, event: LD, place: "Champion", school: "Lynbrook High School (CA)", competitors: "Om Modi", probable: true },
  { year: 2024, event: LD, place: "Finalist", school: STRAKE, competitors: "Justin Wen" },
  // Coppell lists Yerram as the 2025 LD finalist; the champion isn't published yet.
  { year: 2025, event: LD, place: "Finalist", school: "Coppell High School (TX)", competitors: "Srihan Yerram" },

  // Public Forum
  { year: 2009, event: PF, place: "Champion", school: "Durham Academy (NC)", competitors: "Robert Kindman & Josh Zoffer" },
  { year: 2016, event: PF, place: "Champion", school: BLAKE, competitors: "Ellie Grossman & Connor Yu" },
  { year: 2016, event: PF, place: "Finalist", school: "Stuyvesant (NY)", competitors: "Inbar Pe'er & Daniel Ju" },
  { year: 2016, event: PF, place: "Top speaker", school: "Nova High School (FL)", competitors: "Kyleb Bello" },
  { year: 2017, event: PF, place: "Champion", school: STRAKE, competitors: "Pierce Hollier & Daniel Wang" },
  { year: 2017, event: PF, place: "Finalist", school: "Millburn (NJ)", competitors: "James Chen & Brian Zhu" },
  { year: 2017, event: PF, place: "Top speaker", school: "Stuyvesant (NY)", competitors: "Abie Rohrig" },
  { year: 2018, event: PF, place: "Champion", school: "Bronx High School of Science (NY)", competitors: "Benjamin Oestericher & Elias Silver" },
  { year: 2018, event: PF, place: "Finalist", school: "Lake Highland Preparatory School (FL)", competitors: "Anoosh Kumar & Jasper Ou" },
  { year: 2018, event: PF, place: "Top speaker", school: "Ardrey Kell High School (NC)", competitors: "Callan Hazeldine" },
  { year: 2023, event: PF, place: "Champion", school: "Durham Academy (NC)", competitors: "Michael Hansen & Alex Huang" },
  { year: 2023, event: PF, place: "Finalist", school: "Seven Lakes High School (TX)", competitors: "Arnav Mehta & David Lu" },
  { year: 2023, event: PF, place: "Top speaker", school: STRAKE, competitors: "Jason Zhao" },
  { year: 2024, event: PF, place: "Champion", school: STRAKE, competitors: "Mac Stratton & Jason Zhao" },
]

/** Whether a Glenbrooks place is a title (a close-out or shared title counts). */
export function isGlenbrooksTitle(result: Pick<GlenbrooksResult, "place">): boolean {
  return result.place === "Champion" || result.place === "Co-champion"
}

/** Every Glenbrooks result of one school, by {@link tocSchoolKey} and {@link matchTocSchool} like the TOC record. */
export function findGlenbrooksSchoolResults(
  school: string,
  results: readonly GlenbrooksResult[] = GLENBROOKS_RESULTS,
): GlenbrooksResult[] {
  const bySchool = new Map<string, { school: string; results: GlenbrooksResult[] }>()
  for (const result of results) {
    const key = tocSchoolKey(result.school)
    const entry = bySchool.get(key) ?? { school: result.school, results: [] }
    entry.results.push(result)
    bySchool.set(key, entry)
  }
  return matchTocSchool(school, [...bySchool.values()])?.results ?? []
}
