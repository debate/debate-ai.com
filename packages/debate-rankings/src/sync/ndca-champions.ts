/**
 * @fileoverview National Debate Coaches Association (NDCA) national
 * championship history for policy debate: every champion and top speaker the
 * NDCA lists, 2006 (when the tournament resumed) onward. The 2020 tournament
 * wasn't held. A close-out (two teammates who don't debate the final) is two
 * `"Co-champion"` rows, as in the TOC list ({@link TocPlace}).
 *
 * Results are the NDCA's tournament history page ({@link NDCA_SOURCE_URL}),
 * with school names as it spells them. It lists no runners-up or elim
 * results for most years, so none are recorded here.
 * @module sync/ndca-champions
 */

import type { TocPlace } from "./toc-champions"

/** An NDCA policy place; the NDCA list has no runners-up. */
export type NdcaPlace = Exclude<TocPlace, "Runner-up">

export interface NdcaResult {
  /** The year the championship was held (the season's end year). */
  year: number
  place: NdcaPlace
  /** The school as the NDCA names it. */
  school: string
  /** Competitors, as the source lists them. */
  competitors: string
}

export const NDCA_SOURCE_URL = "https://www.debatecoaches.org/tournament/history"

/** NDCA policy champions and top speakers, oldest first. */
export const NDCA_POLICY_RESULTS: NdcaResult[] = [
  { year: 2006, place: "Co-champion", school: "Georgetown Day School", competitors: "Edmund Zagorin & Shezaad Zainulbhi" },
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
