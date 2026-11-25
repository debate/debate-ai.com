/**
 * @fileoverview National Debate Coaches Association (NDCA) national
 * championship history: every policy champion and top speaker the NDCA
 * lists, 2006 (when the tournament resumed) onward, plus the elimination
 * finishes and speaker places supplied for 2006–2012
 * ({@link NDCA_POLICY_PLACES}), and the Lincoln-Douglas and Public Forum
 * champions and top speakers from 2015 ({@link NDCA_LD_RESULTS},
 * {@link NDCA_PF_RESULTS}). The history page lists nothing for 2020
 * ({@link NDCA_NO_RESULT_YEARS}). A close-out
 * (two teammates who don't debate the final) is two `"Co-champion"` rows, as
 * in the TOC list ({@link TocPlace}).
 *
 * Champions and top speakers are the NDCA's tournament history page
 * ({@link NDCA_SOURCE_URL}), with school names as it spells them. The
 * finishes and speaker places come from tournament records supplied to the
 * project: 2006 has the full elimination bracket (a Georgetown Day close-out,
 * then semifinalists, quarterfinalists and octafinalists); 2009 has its full
 * bracket too (17 teams broke, so one double-octafinal: Greenhill lost it);
 * 2011 and 2012 name only the finalist besides the champion; 2015–2018 the
 * finalist and semifinalists (some only by team code, {@link NdcaResult.partialNames}); 2021 and 2025 one
 * Woodward Academy semifinalist each; 2007 and 2008 list elim seeds
 * only, which aren't finishes, so those years have speakers but no team
 * finishes; 2010 has nothing. Name spellings that differ between a year's team
 * and speaker lists (Zainulbhi/Zainulbhai, Azahar/Azhar Unwala, Shakoo/Shakoor,
 * Unvala/Unwala) are written once, the way the debater spells it.
 * @module sync/ndca-champions
 */

import { matchTocSchool, tocSchoolKey, tocSchoolState, type TocPlace } from "./toc-champions"

/** How far an NDCA team got in the elimination rounds, below the title. */
export type NdcaElimFinish = "Finalist" | "Semifinalist" | "Quarterfinalist" | "Octafinalist" | "Double-octafinalist"

/**
 * An NDCA policy place: a title or top speaker award, an elimination finish
 * below the title, or a speaker award below first.
 */
export type NdcaPlace = Exclude<TocPlace, "Runner-up"> | NdcaElimFinish | "Speaker"

/** The NDCA events on record, in the order a school page lists them. */
export type NdcaEvent = "Policy" | "Lincoln-Douglas" | "Public Forum"

export const NDCA_EVENTS: readonly NdcaEvent[] = ["Policy", "Lincoln-Douglas", "Public Forum"]

/** Seasons the NDCA's history page lists no result for, in any event. */
export const NDCA_NO_RESULT_YEARS: readonly number[] = [2020]

/** Elimination finishes, deepest first. */
export const NDCA_ELIM_FINISHES: readonly NdcaElimFinish[] = [
  "Finalist",
  "Semifinalist",
  "Quarterfinalist",
  "Octafinalist",
  "Double-octafinalist",
]

export interface NdcaResult {
  /** The year the championship was held (the season's end year). */
  year: number
  /** The event; policy when absent (every policy row predates the other events). */
  event?: NdcaEvent
  place: NdcaPlace
  /** The speaker place, for `"Speaker"`. */
  rank?: number
  /** The school as the NDCA names it (or canonically, with a state tag, for {@link NDCA_POLICY_PLACES}). */
  school: string
  /** Competitors, as the source lists them. */
  competitors: string
  /**
   * The source gives only a team code or surnames (`"GH"`, `"Shaikh & Wang"`),
   * so the row shows on the school page but credits no debater.
   */
  partialNames?: boolean
}

export const NDCA_SOURCE_URL = "https://www.debatecoaches.org/tournament/history"

/** NDCA policy champions and top speakers, oldest first. */
export const NDCA_POLICY_RESULTS: NdcaResult[] = [
  { year: 2006, place: "Co-champion", school: "Georgetown Day School", competitors: "Edmund Zagorin & Shezaad Zainulbhai" },
  { year: 2006, place: "Co-champion", school: "Georgetown Day School", competitors: "Zack Beauchamp & James Brockway" },
  { year: 2006, place: "Top speaker", school: "Georgetown Day School", competitors: "Zack Beauchamp" },
  { year: 2007, place: "Champion", school: "Westminster Schools", competitors: "Anshu Sathian & Stephen Weil" },
  { year: 2007, place: "Top speaker", school: "Westminster Schools", competitors: "Stephen Weil" },
  { year: 2008, place: "Champion", school: "St. Mark's School of Texas", competitors: "Jordan Blumenthal & Alex Katz" },
  { year: 2008, place: "Top speaker", school: "Stratford Academy", competitors: "William Karlson" },
  { year: 2009, place: "Champion", school: "Damien High School", competitors: "Reid Ehrlich-Quinn & Sean Hernandez" },
  { year: 2009, place: "Top speaker", school: "Bishop Guertin High School", competitors: "Katryna Cadle" },
  { year: 2010, place: "Champion", school: "The Bronx High School of Science", competitors: "Zack Elias & Andrew Markoff" },
  { year: 2010, place: "Top speaker", school: "The Kinkaid School", competitors: "Layne Kirshon" },
  { year: 2011, place: "Champion", school: "Damien High School", competitors: "Nadeem Farooqi & Pablo Gannon" },
  { year: 2011, place: "Top speaker", school: "Damien High School", competitors: "Pablo Gannon" },
  { year: 2012, place: "Champion", school: "Woodward Academy", competitors: "Rahim Shakoor & Jason Sigalos" },
  { year: 2012, place: "Top speaker", school: "Woodward Academy", competitors: "Jason Sigalos" },
  { year: 2013, place: "Champion", school: "Pace Academy", competitors: "Anshuman Parikh & Victor Skenderi" },
  { year: 2013, place: "Top speaker", school: "C.K. McClatchy High School", competitors: "John Spurlock" },
  { year: 2014, place: "Champion", school: "Westminster", competitors: "Colin Basco & Naman Gupta" },
  { year: 2014, place: "Top speaker", school: "Stratford Academy", competitors: "Hemanth Sanjeev" },
  { year: 2015, place: "Champion", school: "Pace Academy", competitors: "Tanner Lewis & Clyde Shepherd" },
  { year: 2015, place: "Top speaker", school: "Notre Dame High School", competitors: "Ryan Powell" },
  { year: 2016, place: "Champion", school: "St. Mark's School of Texas", competitors: "Ansh Khullar & Ammar Plumber" },
  { year: 2016, place: "Top speaker", school: "Rowland Hall-St. Mark's", competitors: "Emily Gordon" },
  { year: 2017, place: "Champion", school: "Westminster", competitors: "Harrison Hall & MaryBryce Brannen" },
  { year: 2017, place: "Top speaker", school: "Peninsula High School", competitors: "Raam Tambe" },
  { year: 2018, place: "Champion", school: "North Broward Prep", competitors: "Nicholas Mancini & Giorgio Rabbini" },
  { year: 2018, place: "Top speaker", school: "Greenhill School", competitors: "Christopher Eckert" },
  { year: 2019, place: "Champion", school: "Montgomery Bell Academy", competitors: "Aden Barton & Julian Habermann" },
  { year: 2019, place: "Top speaker", school: "North Broward Prep", competitors: "Giorgio Rabbini" },
  { year: 2021, place: "Champion", school: "Bellarmine College Preparatory", competitors: "Adarsh Hiremath & Surya Midha" },
  { year: 2021, place: "Top speaker", school: "Bellarmine College Preparatory", competitors: "Surya Midha" },
  { year: 2022, place: "Champion", school: "Washburn Rural High School", competitors: "Jiyoon Park & Zach Willingham" },
  { year: 2022, place: "Top speaker", school: "Lawrence Free State High School", competitors: "John Marshall" },
  { year: 2023, place: "Co-champion", school: "Montgomery Bell Academy", competitors: "Chanden Climaco & Raleigh Maxwell" },
  { year: 2023, place: "Co-champion", school: "Montgomery Bell Academy", competitors: "Jack Young & Cy Turner" },
  { year: 2023, place: "Top speaker", school: "Montgomery Bell Academy", competitors: "Chanden Climaco" },
  { year: 2024, place: "Champion", school: "Peninsula High School", competitors: "Kevin Lai & Devin Lai" },
  { year: 2024, place: "Top speaker", school: "Peninsula High School", competitors: "Kevin Lai" },
  { year: 2025, place: "Champion", school: "Montgomery Bell Academy", competitors: "Russell Howard & Kavneer Majhail" },
  { year: 2025, place: "Top speaker", school: "Berkeley Prep", competitors: "Michael Ross" },
  { year: 2026, place: "Champion", school: "Montgomery Bell Academy", competitors: "Enno Brandes & Jimmy Li" },
  { year: 2026, place: "Top speaker", school: "Newark Science", competitors: "Mofoluwa Olagadeyo" },
]

/**
 * NDCA Lincoln-Douglas champions and top speakers, 2015 onward, as the NDCA's
 * history page lists them, plus the 2015 finalist and semifinalists from the
 * Victory Briefs recap of that final four (Pranav Reddy beat Bennett Eckert and
 * then Varad Agarwala, each 2–1). Other years have no runners-up, elimination
 * finishes or lower speaker places on record. A close-out is a
 * `"Co-champion"` row per debater.
 */
export const NDCA_LD_RESULTS: NdcaResult[] = [
  { year: 2015, event: "Lincoln-Douglas", place: "Champion", school: "The Harker School", competitors: "Pranav Reddy" },
  { year: 2015, event: "Lincoln-Douglas", place: "Finalist", school: "The Greenhill School", competitors: "Varad Agarwala" },
  { year: 2015, event: "Lincoln-Douglas", place: "Semifinalist", school: "The Greenhill School", competitors: "Bennett Eckert" },
  { year: 2015, event: "Lincoln-Douglas", place: "Semifinalist", school: "Peninsula High School", competitors: "Akhil Jalan" },
  { year: 2015, event: "Lincoln-Douglas", place: "Top speaker", school: "Palos Verdes Peninsula High School", competitors: "Arjun Tambe" },
  { year: 2016, event: "Lincoln-Douglas", place: "Champion", school: "The Greenhill School", competitors: "Bennett Eckert" },
  { year: 2016, event: "Lincoln-Douglas", place: "Top speaker", school: "Newark Science", competitors: "Amit Kukreja" },
  { year: 2017, event: "Lincoln-Douglas", place: "Champion", school: "The Greenhill School", competitors: "Shruthi Krishnan" },
  { year: 2017, event: "Lincoln-Douglas", place: "Top speaker", school: "The Greenhill School", competitors: "Shruthi Krishnan" },
  { year: 2018, event: "Lincoln-Douglas", place: "Champion", school: "The Greenhill School", competitors: "Shruthi Krishnan" },
  { year: 2018, event: "Lincoln-Douglas", place: "Top speaker", school: "The Greenhill School", competitors: "Shruthi Krishnan" },
  { year: 2019, event: "Lincoln-Douglas", place: "Co-champion", school: "Harvard-Westlake School", competitors: "Jaya Nayar" },
  { year: 2019, event: "Lincoln-Douglas", place: "Co-champion", school: "Harvard-Westlake School", competitors: "Vishan Chaudhary" },
  { year: 2019, event: "Lincoln-Douglas", place: "Top speaker", school: "Harvard-Westlake School", competitors: "Vishan Chaudhary" },
  { year: 2021, event: "Lincoln-Douglas", place: "Co-champion", school: "The Harker School", competitors: "Andy Lee" },
  { year: 2021, event: "Lincoln-Douglas", place: "Co-champion", school: "The Harker School", competitors: "Akshay Manglik" },
  { year: 2021, event: "Lincoln-Douglas", place: "Top speaker", school: "Harvard-Westlake School", competitors: "Andrew Gong" },
  { year: 2022, event: "Lincoln-Douglas", place: "Champion", school: "The Harker School", competitors: "Anshul Reddy" },
  { year: 2022, event: "Lincoln-Douglas", place: "Top speaker", school: "Strake Jesuit College Preparatory", competitors: "Zion Dixon" },
  { year: 2023, event: "Lincoln-Douglas", place: "Co-champion", school: "The Harker School", competitors: "Ansh Sheth" },
  { year: 2023, event: "Lincoln-Douglas", place: "Co-champion", school: "The Harker School", competitors: "Panav Gogte" },
  { year: 2023, event: "Lincoln-Douglas", place: "Top speaker", school: "Strake Jesuit College Preparatory", competitors: "Justin Wen" },
  { year: 2024, event: "Lincoln-Douglas", place: "Champion", school: "The Harker School", competitors: "Ansh Sheth" },
  { year: 2024, event: "Lincoln-Douglas", place: "Top speaker", school: "The Harker School", competitors: "Ansh Sheth" },
  { year: 2025, event: "Lincoln-Douglas", place: "Champion", school: "Marlborough School", competitors: "Abby Merges" },
  { year: 2025, event: "Lincoln-Douglas", place: "Top speaker", school: "Orange County School of the Arts", competitors: "Iva Liu" },
  { year: 2026, event: "Lincoln-Douglas", place: "Champion", school: "Lynbrook High School", competitors: "Om Modi" },
  { year: 2026, event: "Lincoln-Douglas", place: "Top speaker", school: "Lynbrook High School", competitors: "Om Modi" },
]

/**
 * NDCA Public Forum champions and top speakers, 2015 onward, as the NDCA's
 * history page lists them, plus Durham Academy's 2021 final and 2022
 * semifinal from the school's own debate history. A close-out is a
 * `"Co-champion"` row per team.
 */
export const NDCA_PF_RESULTS: NdcaResult[] = [
  { year: 2015, event: "Public Forum", place: "Champion", school: "Poly Prep Country Day", competitors: "Eitan Ezra & Harrison Hurt" },
  { year: 2015, event: "Public Forum", place: "Top speaker", school: "Byram Hills High School", competitors: "Brandon Jones" },
  { year: 2016, event: "Public Forum", place: "Champion", school: "Ft. Lauderdale", competitors: "Kevin Hautigan & Danny Siegel" },
  { year: 2016, event: "Public Forum", place: "Top speaker", school: "Blake School", competitors: "Ellie Grossman" },
  { year: 2017, event: "Public Forum", place: "Champion", school: "Blake School", competitors: "Elisa Lopez & Eva Motolinia" },
  { year: 2017, event: "Public Forum", place: "Top speaker", school: "Lexington High School", competitors: "Peter Lawrence" },
  { year: 2018, event: "Public Forum", place: "Champion", school: "Altamont School", competitors: "David Zell & Isabel Coleman" },
  { year: 2018, event: "Public Forum", place: "Top speaker", school: "Altamont School", competitors: "David Zell" },
  { year: 2019, event: "Public Forum", place: "Co-champion", school: "Blake School", competitors: "Morgan Swigert & Isabella Wu" },
  { year: 2019, event: "Public Forum", place: "Co-champion", school: "Blake School", competitors: "Thomas Gill & Jack Johnson" },
  { year: 2019, event: "Public Forum", place: "Top speaker", school: "Cranbrook School", competitors: "Aashray Khanna" },
  { year: 2021, event: "Public Forum", place: "Champion", school: "Bethesda Chevy Chase High School", competitors: "Eli Glickman & Roy Tiefer" },
  { year: 2021, event: "Public Forum", place: "Finalist", school: "Durham Academy", competitors: "Teddy Wallen & Ani Sukhija" },
  { year: 2021, event: "Public Forum", place: "Top speaker", school: "Riverdale Country School", competitors: "Jessica Gold" },
  { year: 2022, event: "Public Forum", place: "Co-champion", school: "Blake School", competitors: "Elizabeth Terveen & Skylar Wang" },
  { year: 2022, event: "Public Forum", place: "Co-champion", school: "Blake School", competitors: "Davin Khan & Sofia Perri" },
  { year: 2022, event: "Public Forum", place: "Semifinalist", school: "Durham Academy", competitors: "Michael Hansen & Alexander Huang" },
  { year: 2022, event: "Public Forum", place: "Top speaker", school: "Blake School", competitors: "Skylar Wang" },
  { year: 2023, event: "Public Forum", place: "Champion", school: "Fairmont Preparatory Academy", competitors: "Stavan Shah & Aumrita Savdharia" },
  { year: 2023, event: "Public Forum", place: "Top speaker", school: "Fairmont Preparatory Academy", competitors: "Roy Kapoor" },
  { year: 2024, event: "Public Forum", place: "Co-champion", school: "Fairmont Preparatory Academy", competitors: "Stavan Shah & Aumrita Savdharia" },
  { year: 2024, event: "Public Forum", place: "Co-champion", school: "Fairmont Preparatory Academy", competitors: "Ara Mehran & Roy Kapoor" },
  { year: 2024, event: "Public Forum", place: "Top speaker", school: "Fairmont Preparatory Academy", competitors: "Roy Kapoor" },
  { year: 2025, event: "Public Forum", place: "Champion", school: "Fairmont Preparatory Academy", competitors: "Alexis Kang & Willie Tsai" },
  { year: 2025, event: "Public Forum", place: "Top speaker", school: "Fairmont Preparatory Academy", competitors: "Eli Lunde" },
  { year: 2026, event: "Public Forum", place: "Co-champion", school: "Fairmont Preparatory Academy", competitors: "Kingston Harrison & Oliver Ji" },
  { year: 2026, event: "Public Forum", place: "Co-champion", school: "Fairmont Preparatory Academy", competitors: "Isabel Chang & Arya Seth" },
  { year: 2026, event: "Public Forum", place: "Top speaker", school: "Fairmont Preparatory Academy", competitors: "Alexis Kang" },
]

/** Years {@link NDCA_POLICY_PLACES} lists speaker places 2–15 for: 2006–2012 but 2010. */
export const NDCA_PLACES_YEARS: readonly number[] = [2006, 2007, 2008, 2009, 2011, 2012]

/**
 * Years {@link NDCA_POLICY_PLACES} has elimination finishes for (2007 and 2008
 * have only seeds, not recorded; 2015–2018 the finalist and semifinalists).
 */
export const NDCA_FINISH_YEARS: readonly number[] = [2006, 2009, 2011, 2012, 2015, 2016, 2017, 2018, 2021, 2025]

/**
 * NDCA policy elimination finishes below the title and speaker places 2–15,
 * oldest first. Champions and top speakers are in {@link NDCA_POLICY_RESULTS},
 * so they aren't repeated.
 */
export const NDCA_POLICY_PLACES: NdcaResult[] = [
  // 2006 elimination finishes (Georgetown Day closed out the final)
  { year: 2006, place: "Semifinalist", school: "Bishop Guertin High School (NH)", competitors: "Bill Gerath & A.J. O'Donnell" },
  { year: 2006, place: "Semifinalist", school: "Woodward Academy (GA)", competitors: "Aliya Bhatia & Lina Skandalakis" },
  { year: 2006, place: "Quarterfinalist", school: "St. Mark's School of Texas (TX)", competitors: "Jordan Blumenthal & Swayze Smartt" },
  { year: 2006, place: "Quarterfinalist", school: "Glenbrook North High School (IL)", competitors: "Matt Fisher & Stephanie Spies" },
  { year: 2006, place: "Quarterfinalist", school: "Glenbrook South High School (IL)", competitors: "Winston Luo & Grant Peretz" },
  { year: 2006, place: "Quarterfinalist", school: "Henry W. Grady High School (GA)", competitors: "JerMeen Sherman & Jeffrey Thomas" },
  { year: 2006, place: "Octafinalist", school: "Edgemont High School (NY)", competitors: "Nathan Baum & Jeremy Kriesberg" },
  { year: 2006, place: "Octafinalist", school: "Rowland Hall-St. Mark's School (UT)", competitors: "Chase Burton & Guz Eyzaguirre" },
  { year: 2006, place: "Octafinalist", school: "Kansas City Central High School (MO)", competitors: "Leodis McCray & Geoffrey Stone" },
  { year: 2006, place: "Octafinalist", school: "Lexington High School (MA)", competitors: "John Mei & Kelsey Savage" },
  // 2006 speakers
  { year: 2006, place: "Speaker", rank: 2, school: "Georgetown Day School (DC)", competitors: "Edmund Zagorin" },
  { year: 2006, place: "Speaker", rank: 3, school: "Georgetown Day School (DC)", competitors: "James Brockway" },
  { year: 2006, place: "Speaker", rank: 4, school: "Woodward Academy (GA)", competitors: "Aliya Bhatia" },
  { year: 2006, place: "Speaker", rank: 5, school: "Glenbrook North High School (IL)", competitors: "Matt Fisher" },
  { year: 2006, place: "Speaker", rank: 6, school: "Georgetown Day School (DC)", competitors: "Shezaad Zainulbhai" },
  { year: 2006, place: "Speaker", rank: 7, school: "Kansas City Central High School (MO)", competitors: "Geoffrey Stone" },
  { year: 2006, place: "Speaker", rank: 8, school: "Henry W. Grady High School (GA)", competitors: "Jeffrey Thomas" },
  { year: 2006, place: "Speaker", rank: 9, school: "Edgemont High School (NY)", competitors: "Jeremy Kriesberg" },
  { year: 2006, place: "Speaker", rank: 10, school: "Bishop Guertin High School (NH)", competitors: "Bill Gerath" },
  { year: 2006, place: "Speaker", rank: 11, school: "St. Mark's School of Texas (TX)", competitors: "Jordan Blumenthal" },
  { year: 2006, place: "Speaker", rank: 12, school: "Henry W. Grady High School (GA)", competitors: "JerMeen Sherman" },
  { year: 2006, place: "Speaker", rank: 13, school: "Bishop Guertin High School (NH)", competitors: "A.J. O'Donnell" },
  { year: 2006, place: "Speaker", rank: 14, school: "St. Mark's School of Texas (TX)", competitors: "Swayze Smartt" },
  { year: 2006, place: "Speaker", rank: 15, school: "Edgemont High School (NY)", competitors: "Zach Baum" },
  // 2007 speakers
  { year: 2007, place: "Speaker", rank: 2, school: "Gulliver Preparatory School (FL)", competitors: "Kathy Bowen" },
  { year: 2007, place: "Speaker", rank: 3, school: "Pine Crest School (FL)", competitors: "Seth Bour" },
  { year: 2007, place: "Speaker", rank: 4, school: "Jesuit College Preparatory School of Dallas (TX)", competitors: "Sean O'Brien" },
  { year: 2007, place: "Speaker", rank: 5, school: "Glenbrook North High School (IL)", competitors: "Matt Fisher" },
  { year: 2007, place: "Speaker", rank: 6, school: "Kansas City Central High School (MO)", competitors: "Deshawna Brunson" },
  { year: 2007, place: "Speaker", rank: 7, school: "Rowland Hall-St. Mark's School (UT)", competitors: "Chase Burton" },
  { year: 2007, place: "Speaker", rank: 8, school: "Montgomery Bell Academy (TN)", competitors: "Jamie Berk" },
  { year: 2007, place: "Speaker", rank: 9, school: "Woodward Academy (GA)", competitors: "Bobby Rosenbleeth" },
  { year: 2007, place: "Speaker", rank: 10, school: "Woodward Academy (GA)", competitors: "Evan Matthews" },
  { year: 2007, place: "Speaker", rank: 11, school: "Jesuit College Preparatory School of Dallas (TX)", competitors: "Ryan Stevens" },
  { year: 2007, place: "Speaker", rank: 12, school: "The College Preparatory School (CA)", competitors: "Sandy Yuan" },
  { year: 2007, place: "Speaker", rank: 13, school: "Bishop Guertin High School (NH)", competitors: "A.J. O'Donnell" },
  { year: 2007, place: "Speaker", rank: 14, school: "Glenbrook North High School (IL)", competitors: "Stephanie Spies" },
  { year: 2007, place: "Speaker", rank: 15, school: "Marquette University High School (WI)", competitors: "Gaurav Bhatnagar" },
  // 2008 speakers
  { year: 2008, place: "Speaker", rank: 2, school: "Woodward Academy (GA)", competitors: "Evan Matthews" },
  { year: 2008, place: "Speaker", rank: 3, school: "St. Mark's School of Texas (TX)", competitors: "Jordan Blumenthal" },
  { year: 2008, place: "Speaker", rank: 4, school: "Colleyville Heritage High School (TX)", competitors: "James Hamraie" },
  { year: 2008, place: "Speaker", rank: 5, school: "Glenbrook North High School (IL)", competitors: "Lucy Zhu" },
  { year: 2008, place: "Speaker", rank: 6, school: "Groves High School (MI)", competitors: "Sophia Goren" },
  { year: 2008, place: "Speaker", rank: 7, school: "Damien High School (CA)", competitors: "Reid Ehrlich-Quinn" },
  { year: 2008, place: "Speaker", rank: 8, school: "Colleyville Heritage High School (TX)", competitors: "Evan DeFilippis" },
  { year: 2008, place: "Speaker", rank: 9, school: "Glenbrook South High School (IL)", competitors: "Grant Peretz" },
  { year: 2008, place: "Speaker", rank: 10, school: "Lakeland High School", competitors: "Jason Wright" },
  { year: 2008, place: "Speaker", rank: 11, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Catalina Santos" },
  { year: 2008, place: "Speaker", rank: 12, school: "St. Mark's School of Texas (TX)", competitors: "Alex Katz" },
  { year: 2008, place: "Speaker", rank: 13, school: "Fullerton Union High School (CA)", competitors: "Robin Gray" },
  { year: 2008, place: "Speaker", rank: 14, school: "Cathedral Preparatory School (PA)", competitors: "Mike Carlotti" },
  { year: 2008, place: "Speaker", rank: 15, school: "Stratford Academy (GA)", competitors: "Brian Cole" },
  // 2009 elimination finishes (17 teams broke: one double-octafinal, then octas)
  { year: 2009, place: "Finalist", school: "Bishop Guertin High School (NH)", competitors: "Katryna Cadle & Chris Power" },
  { year: 2009, place: "Semifinalist", school: "The Westminster Schools (GA)", competitors: "Rajesh Jegadeesh & Anshu Sathian" },
  { year: 2009, place: "Semifinalist", school: "St. Mark's School of Texas (TX)", competitors: "Alex Gulakov & Alex Miles" },
  { year: 2009, place: "Quarterfinalist", school: "Glenbrook South High School (IL)", competitors: "Colin Quinn & Alec Zimmer" },
  { year: 2009, place: "Quarterfinalist", school: "Glenbrook South High School (IL)", competitors: "Richard Day & Will Thibeau" },
  { year: 2009, place: "Quarterfinalist", school: "Glenbrook North High School (IL)", competitors: "Flynn Makuch & Victor Shao" },
  { year: 2009, place: "Quarterfinalist", school: "Bishop Guertin High School (NH)", competitors: "Mitch Hagney & Christian Steckler" },
  { year: 2009, place: "Octafinalist", school: "Damien High School (CA)", competitors: "Eric Berggren & Pablo Gannon" },
  { year: 2009, place: "Octafinalist", school: "Glenbrook South High School (IL)", competitors: "Stacy Kapustina & Phil Sailer" },
  { year: 2009, place: "Octafinalist", school: "Woodward Academy (GA)", competitors: "Brittany Nehman & Matthew Pesce" },
  { year: 2009, place: "Octafinalist", school: "College Preparatory School (CA)", competitors: "Eunice Kim & Emma Vance" },
  { year: 2009, place: "Octafinalist", school: "Marquette University High School (WI)", competitors: "Joe Balistreri & Ben Benson" },
  { year: 2009, place: "Octafinalist", school: "Carrollton School of the Sacred Heart (FL)", competitors: "Anna Dimitrijevic & Helen Gomez" },
  { year: 2009, place: "Octafinalist", school: "Notre Dame High School (CA)", competitors: "Chris Duran & Quinn Powell" },
  { year: 2009, place: "Octafinalist", school: "Fullerton Union High School (CA)", competitors: "Robin Gray & Sasha Sabherwal" },
  { year: 2009, place: "Double-octafinalist", school: "Greenhill School (TX)", competitors: "Kush Patel & Chris Patterson" },
  // 2009 speakers
  { year: 2009, place: "Speaker", rank: 2, school: "The Westminster Schools (GA)", competitors: "Rajesh Jegadeesh" },
  { year: 2009, place: "Speaker", rank: 3, school: "The Westminster Schools (GA)", competitors: "Anshu Sathian" },
  { year: 2009, place: "Speaker", rank: 4, school: "Bishop Guertin High School (NH)", competitors: "Chris Power" },
  { year: 2009, place: "Speaker", rank: 5, school: "St. Mark's School of Texas (TX)", competitors: "Alex Miles" },
  { year: 2009, place: "Speaker", rank: 6, school: "Damien High School (CA)", competitors: "Reid Ehrlich-Quinn" },
  { year: 2009, place: "Speaker", rank: 7, school: "Fullerton Union High School (CA)", competitors: "Robin Gray" },
  { year: 2009, place: "Speaker", rank: 8, school: "Marquette University High School (WI)", competitors: "Joe Balistreri" },
  { year: 2009, place: "Speaker", rank: 9, school: "Woodward Academy (GA)", competitors: "Matthew Pesce" },
  { year: 2009, place: "Speaker", rank: 10, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Anna Dimitrijevic" },
  { year: 2009, place: "Speaker", rank: 11, school: "Damien High School (CA)", competitors: "Sean Hernandez" },
  { year: 2009, place: "Speaker", rank: 12, school: "Chattahoochee High School (GA)", competitors: "Kaavya Ramesh" },
  { year: 2009, place: "Speaker", rank: 13, school: "Glenbrook North High School (IL)", competitors: "Victor Shao" },
  { year: 2009, place: "Speaker", rank: 14, school: "Glenbrook South High School (IL)", competitors: "Will Thibeau" },
  { year: 2009, place: "Speaker", rank: 15, school: "Fort Lauderdale High School (FL)", competitors: "Tyler Boykin" },
  // 2011 elimination finishes (only the final is recorded)
  { year: 2011, place: "Finalist", school: "The Westminster Schools (GA)", competitors: "Ellis Allen & Daniel Taylor" },
  // 2011 speakers
  { year: 2011, place: "Speaker", rank: 2, school: "The Westminster Schools (GA)", competitors: "Ellis Allen" },
  { year: 2011, place: "Speaker", rank: 3, school: "The Westminster Schools (GA)", competitors: "Daniel Taylor" },
  { year: 2011, place: "Speaker", rank: 4, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Anna Dimitrijevic" },
  { year: 2011, place: "Speaker", rank: 5, school: "St. Mark's School of Texas (TX)", competitors: "Alex Miles" },
  { year: 2011, place: "Speaker", rank: 6, school: "Lexington High School (MA)", competitors: "Arjun Vellayappan" },
  { year: 2011, place: "Speaker", rank: 7, school: "Edina High School (MN)", competitors: "Mimi Sergent-Leventhal" },
  { year: 2011, place: "Speaker", rank: 8, school: "St. Mark's School of Texas (TX)", competitors: "Rishee Batra" },
  { year: 2011, place: "Speaker", rank: 9, school: "Lexington High School (MA)", competitors: "Tyler Engler" },
  { year: 2011, place: "Speaker", rank: 10, school: "Edina High School (MN)", competitors: "Erin Sielaff" },
  { year: 2011, place: "Speaker", rank: 11, school: "Georgetown Day School (DC)", competitors: "Joe Krakoff" },
  { year: 2011, place: "Speaker", rank: 12, school: "Lexington High School (MA)", competitors: "Michael Suo" },
  { year: 2011, place: "Speaker", rank: 13, school: "Centennial High School", competitors: "Srinidhi Muppalla" },
  { year: 2011, place: "Speaker", rank: 14, school: "The Westminster Schools (GA)", competitors: "Will Morgan" },
  { year: 2011, place: "Speaker", rank: 15, school: "Homewood-Flossmoor High School (IL)", competitors: "Donald Grasse" },
  // 2012 elimination finishes (only the final is recorded)
  { year: 2012, place: "Finalist", school: "Greenhill School (TX)", competitors: "Azhar Unwala & Lyall Stuart" },
  // 2012 speakers
  { year: 2012, place: "Speaker", rank: 2, school: "Greenhill School (TX)", competitors: "Lyall Stuart" },
  { year: 2012, place: "Speaker", rank: 3, school: "Montgomery Bell Academy (TN)", competitors: "Kelly Haselton" },
  { year: 2012, place: "Speaker", rank: 4, school: "Homewood-Flossmoor High School (IL)", competitors: "Donald Grasse" },
  { year: 2012, place: "Speaker", rank: 5, school: "Homewood-Flossmoor High School (IL)", competitors: "Margaret Strong" },
  { year: 2012, place: "Speaker", rank: 6, school: "Woodward Academy (GA)", competitors: "Rahim Shakoor" },
  { year: 2012, place: "Speaker", rank: 7, school: "Georgetown Day School (DC)", competitors: "David Herman" },
  { year: 2012, place: "Speaker", rank: 8, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Mary Darmody" },
  { year: 2012, place: "Speaker", rank: 9, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Fabiola Urdaneta" },
  { year: 2012, place: "Speaker", rank: 10, school: "Bronx High School of Science (NY)", competitors: "Anastasia Kazteridis" },
  { year: 2012, place: "Speaker", rank: 11, school: "Highland Park High School (TX)", competitors: "Robert Wyde" },
  { year: 2012, place: "Speaker", rank: 12, school: "Lexington High School (MA)", competitors: "Bennett Clifford" },
  { year: 2012, place: "Speaker", rank: 13, school: "Greenhill School (TX)", competitors: "Azhar Unwala" },
  { year: 2012, place: "Speaker", rank: 14, school: "Glenbrook South High School (IL)", competitors: "Connor O'Brien" },
  { year: 2012, place: "Speaker", rank: 15, school: "St. Mark's School of Texas (TX)", competitors: "Rishee Batra" },
  // 2015–2018 finalists and semifinalists, from the HS Impact tournament recaps
  // (team codes kept where the recap doesn't name both debaters)
  { year: 2015, place: "Finalist", school: "The Blake School (MN)", competitors: "Shaikh & Wang", partialNames: true },
  { year: 2015, place: "Semifinalist", school: "La Salle College High School (PA)", competitors: "Jack Grogan & Conor Hogan" },
  { year: 2015, place: "Semifinalist", school: "Rowland Hall-St. Mark's (UT)", competitors: "KL", partialNames: true },
  { year: 2016, place: "Finalist", school: "Rowland Hall-St. Mark's (UT)", competitors: "Jaden Lessnick & Emily Gordon" },
  { year: 2016, place: "Semifinalist", school: "The Westminster Schools (GA)", competitors: "CK", partialNames: true },
  { year: 2016, place: "Semifinalist", school: "Montgomery Bell Academy (TN)", competitors: "KR", partialNames: true },
  { year: 2017, place: "Finalist", school: "Montgomery Bell Academy (TN)", competitors: "Andrew Kaplan & Ben Rosenthal" },
  // St. Mark's news (goals.smtexas.org, Apr 2019): Max Wang reached NDCA semis
  // as a sophomore with Harris Wilson — the "WW" team code was Wilson & Wang,
  // both St. Mark's (not a "WW" school). Class year for Wilson is listed as
  // '17 in one school item and '18 in another; we keep the tournament year.
  { year: 2017, place: "Semifinalist", school: "St. Mark's School of Texas (TX)", competitors: "Harris Wilson & Max Wang" },
  { year: 2017, place: "Semifinalist", school: "New Trier High School (IL)", competitors: "Celia Buckman & Connor Warshauer" },
  { year: 2018, place: "Finalist", school: "Carrollton School of the Sacred Heart (FL)", competitors: "Jasmine Agred & Cecilia De la Guardia" },
  { year: 2018, place: "Semifinalist", school: "Greenhill School (TX)", competitors: "Christopher Eckert & Samuel Grimsley" },
  { year: 2018, place: "Semifinalist", school: "Blue Valley Southwest High School (KS)", competitors: "Stephen Lowe & Danish Khan" },
  // 2021 and 2025 semifinalists, from Woodward Academy's own NDCA history and news post
  { year: 2021, place: "Semifinalist", school: "Woodward Academy (GA)", competitors: "Ashna Ghanate & Sachi Reddy" },
  { year: 2025, place: "Semifinalist", school: "Woodward Academy (GA)", competitors: "Aaly Nanji & Lasya Paladugu" },
]

/** Every NDCA policy result on record: titles, top speakers, elim finishes and speaker places. */
export const NDCA_POLICY_HISTORY: NdcaResult[] = [...NDCA_POLICY_RESULTS, ...NDCA_POLICY_PLACES].sort(
  (a, b) => a.year - b.year,
)

/**
 * Every NDCA result on record in every event: the policy history plus the
 * Lincoln-Douglas and Public Forum titles and top speakers. School pages list
 * these; only {@link NDCA_POLICY_HISTORY} scores toward the all-seasons NDT
 * points.
 */
export const NDCA_HISTORY: NdcaResult[] = [...NDCA_POLICY_HISTORY, ...NDCA_LD_RESULTS, ...NDCA_PF_RESULTS].sort(
  (a, b) => a.year - b.year,
)

/**
 * High school names that the NDT spells differently for the same debater
 * (`"Guz Eyzaguirre"` debated at Michigan State as `"Gustavo Eyzaguirre"`),
 * so their NDCA and TOC results reach their college team (and they aren't
 * ranked a second time as a high school-only debater).
 */
export const NDCA_NAME_ALIASES: Record<string, string> = {
  "Guz Eyzaguirre": "Gustavo Eyzaguirre",
  "Margaret Strong": "Marge Strong",
  "Armands Revelins": "Armonds Revelins",
  "Christopher Eckert": "Chris Eckert",
  "Dave Ottoson": "David Ottoson",
  "Jake Foster": "Jacob Foster",
  "Jon Brody": "Jonathan Brody",
  "Lenny Gail": "Leonard Gail",
  "Les Asimow": "Lev Asimow",
  "Michael Burshteyn": "Mike Burshteyn",
  "Mike Green": "Michael Green",
}

/** A result's event: `"Policy"` unless the row says otherwise. */
export function ndcaEvent(result: Pick<NdcaResult, "event">): NdcaEvent {
  return result.event ?? "Policy"
}

/** `"4th"`, `"12th"`, `"22nd"`. */
export function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"
  return `${n}${suffix}`
}

/** How a result reads: `"Champion"`, `"Quarterfinalist"`, `"Top speaker"`, `"5th speaker"`. */
export function ndcaPlaceLabel(result: Pick<NdcaResult, "place" | "rank">): string {
  if (result.place === "Speaker") return `${ordinal(result.rank ?? 0)} speaker`
  return result.place
}

/** One school's NDCA record (every event unless built from one event's rows), oldest result first. */
export interface NdcaSchoolRecord {
  /** The school's name, with its state tag when any of its rows has one. */
  school: string
  results: NdcaResult[]
  /** Championships, counting a close-out. */
  titles: number
  topSpeakers: number
  /** Elimination finishes below the title (policy 2006, 2009, 2011, 2012, 2015–2018; a few Public Forum). */
  elimFinishes: number
  /** Speaker places 2–15 (2006–2012 but 2010). */
  speakerPlaces: number
}

/** Groups NDCA results by school (by {@link tocSchoolKey}, so the history page's "Westminster Schools" and "The Westminster Schools (GA)" are one). */
export function ndcaRecordsBySchool(results: readonly NdcaResult[] = NDCA_HISTORY): NdcaSchoolRecord[] {
  const bySchool = new Map<string, NdcaResult[]>()
  for (const result of [...results].sort((a, b) => a.year - b.year)) {
    const key = tocSchoolKey(result.school)
    const list = bySchool.get(key) ?? []
    list.push(result)
    bySchool.set(key, list)
  }
  return [...bySchool.values()].map((list) => ({
    school: (list.find((r) => tocSchoolState(r.school)) ?? list[0]).school,
    results: list,
    titles: list.filter((r) => r.place === "Champion" || r.place === "Co-champion").length,
    topSpeakers: list.filter((r) => r.place === "Top speaker").length,
    elimFinishes: list.filter((r) => (NDCA_ELIM_FINISHES as readonly string[]).includes(r.place)).length,
    speakerPlaces: list.filter((r) => r.place === "Speaker").length,
  }))
}

/**
 * A high school's NDCA record in every event, or `null` when it has none or the name
 * is ambiguous; schools match the way the TOC record's do ({@link matchTocSchool}).
 *
 * @param school - School name as the rankings or a school page spell it.
 */
export function findNdcaSchoolRecord(
  school: string,
  records: readonly NdcaSchoolRecord[] = ndcaRecordsBySchool(),
): NdcaSchoolRecord | null {
  return matchTocSchool(school, records)
}
