/**
 * @fileoverview National Debate Coaches Association (NDCA) national
 * championship history for policy debate: every champion and top speaker the
 * NDCA lists, 2006 (when the tournament resumed) onward, plus the elimination
 * seeds and speaker places of 2006–2009, 2011 and 2012
 * ({@link NDCA_POLICY_PLACES}). The 2020 tournament wasn't held. A close-out
 * (two teammates who don't debate the final) is two `"Co-champion"` rows, as
 * in the TOC list ({@link TocPlace}).
 *
 * Champions and top speakers are the NDCA's tournament history page
 * ({@link NDCA_SOURCE_URL}), with school names as it spells them. The seeds
 * and speaker places come from tournament records supplied to the project; they
 * list 10–18 elim teams a year, not full top-32 brackets, and nothing for
 * 2010. Seeds are where a team entered the elimination bracket, not where it
 * finished. Name spellings that differ between a year's team and speaker
 * lists (Zainulbhi/Zainulbhai, Azahar/Azhar Unwala, Shakoo/Shakoor) are
 * written once, the way the debater spells it.
 * @module sync/ndca-champions
 */

import { matchTocSchool, tocSchoolKey, tocSchoolState, type TocPlace } from "./toc-champions"

/**
 * An NDCA policy place: a title or top speaker award (the NDCA list has no
 * runners-up), an elimination seed, or a speaker award below first.
 */
export type NdcaPlace = Exclude<TocPlace, "Runner-up"> | "Elim seed" | "Speaker"

export interface NdcaResult {
  /** The year the championship was held (the season's end year). */
  year: number
  place: NdcaPlace
  /** The elim seed or speaker place, for `"Elim seed"` and `"Speaker"`. */
  rank?: number
  /** The school as the NDCA names it (or canonically, with a state tag, for {@link NDCA_POLICY_PLACES}). */
  school: string
  /** Competitors, as the source lists them. */
  competitors: string
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
 * Years {@link NDCA_POLICY_PLACES} covers: every NDCA from 2006 to 2012 but
 * 2010, which no record was supplied for.
 */
export const NDCA_PLACES_YEARS: readonly number[] = [2006, 2007, 2008, 2009, 2011, 2012]

/**
 * NDCA policy elimination seeds and speaker places 2–15, oldest first. A
 * year's top speaker is in {@link NDCA_POLICY_RESULTS}, so it isn't repeated.
 */
export const NDCA_POLICY_PLACES: NdcaResult[] = [
  // 2006 elimination seeds
  { year: 2006, place: "Elim seed", rank: 1, school: "Georgetown Day School (DC)", competitors: "Edmund Zagorin & Shezaad Zainulbhai" },
  { year: 2006, place: "Elim seed", rank: 2, school: "Georgetown Day School (DC)", competitors: "Zack Beauchamp & James Brockway" },
  { year: 2006, place: "Elim seed", rank: 3, school: "Woodward Academy (GA)", competitors: "Aliya Bhatia & Lina Skandalakis" },
  { year: 2006, place: "Elim seed", rank: 4, school: "Glenbrook North High School (IL)", competitors: "Matt Fisher & Stephanie Spies" },
  { year: 2006, place: "Elim seed", rank: 5, school: "Bishop Guertin High School (NH)", competitors: "Bill Gerath & A.J. O'Donnell" },
  { year: 2006, place: "Elim seed", rank: 6, school: "Henry W. Grady High School (GA)", competitors: "JerMeen Sherman & Jeffrey Thomas" },
  { year: 2006, place: "Elim seed", rank: 7, school: "Glenbrook South High School (IL)", competitors: "Winston Luo & Grant Peretz" },
  { year: 2006, place: "Elim seed", rank: 8, school: "St. Mark's School of Texas (TX)", competitors: "Jordan Blumenthal & Swayze Smartt" },
  { year: 2006, place: "Elim seed", rank: 9, school: "Edgemont High School (NY)", competitors: "Nathan Baum & Jeremy Kriesberg" },
  { year: 2006, place: "Elim seed", rank: 10, school: "Kansas City Central High School (MO)", competitors: "Leodis McCray & Geoffrey Stone" },
  { year: 2006, place: "Elim seed", rank: 11, school: "Lexington High School (MA)", competitors: "John Mei & Kelsey Savage" },
  { year: 2006, place: "Elim seed", rank: 12, school: "Rowland Hall-St. Mark's School (UT)", competitors: "Chase Burton & Guz Eyzaguirre" },
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
  // 2007 elimination seeds
  { year: 2007, place: "Elim seed", rank: 1, school: "Glenbrook North High School (IL)", competitors: "Matt Fisher & Stephanie Spies" },
  { year: 2007, place: "Elim seed", rank: 2, school: "The Westminster Schools (GA)", competitors: "Anshu Sathian & Stephen Weil" },
  { year: 2007, place: "Elim seed", rank: 3, school: "Gulliver Preparatory School (FL)", competitors: "Kathy Bowen & Jordan Molliver" },
  { year: 2007, place: "Elim seed", rank: 4, school: "Rowland Hall-St. Mark's School (UT)", competitors: "Cyrus Akrami & Chase Burton" },
  { year: 2007, place: "Elim seed", rank: 5, school: "Jesuit College Preparatory School of Dallas (TX)", competitors: "Sean O'Brien & Ryan Stevens" },
  { year: 2007, place: "Elim seed", rank: 6, school: "Woodward Academy (GA)", competitors: "Evan Matthews & Bobby Rosenbleeth" },
  { year: 2007, place: "Elim seed", rank: 7, school: "Pine Crest School (FL)", competitors: "Seth Bour & David Mainiero" },
  { year: 2007, place: "Elim seed", rank: 8, school: "Edgemont High School (NY)", competitors: "Spencer Nelson & Josh Waizer" },
  { year: 2007, place: "Elim seed", rank: 9, school: "The College Preparatory School (CA)", competitors: "Bon Koo & Karina Piser" },
  { year: 2007, place: "Elim seed", rank: 10, school: "The Westminster Schools (GA)", competitors: "Elizabeth Allan & Priyanka Anand" },
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
  // 2008 elimination seeds
  { year: 2008, place: "Elim seed", rank: 1, school: "Stratford Academy (GA)", competitors: "Brian Cole & William Karlson" },
  { year: 2008, place: "Elim seed", rank: 2, school: "Woodward Academy (GA)", competitors: "Evan Matthews & Brittany Nehman" },
  { year: 2008, place: "Elim seed", rank: 3, school: "Cathedral Preparatory School (PA)", competitors: "Mike Carlotti & Leo Hayes" },
  { year: 2008, place: "Elim seed", rank: 4, school: "Glenbrook North High School (IL)", competitors: "Debbie Oh & Lucy Zhu" },
  { year: 2008, place: "Elim seed", rank: 5, school: "Colleyville Heritage High School (TX)", competitors: "Evan DeFilippis & James Hamraie" },
  { year: 2008, place: "Elim seed", rank: 6, school: "St. Mark's School of Texas (TX)", competitors: "Jordan Blumenthal & Alex Katz" },
  { year: 2008, place: "Elim seed", rank: 7, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Dorothy Hector & Catalina Santos" },
  { year: 2008, place: "Elim seed", rank: 8, school: "Damien High School (CA)", competitors: "Reid Ehrlich-Quinn & Ian Nelson" },
  { year: 2008, place: "Elim seed", rank: 9, school: "Groves High School (MI)", competitors: "Maya Bhardwaj & Sophia Goren" },
  { year: 2008, place: "Elim seed", rank: 10, school: "Lakeland High School", competitors: "Taylor Roth & Jason Wright" },
  { year: 2008, place: "Elim seed", rank: 11, school: "The Meadows School (NV)", competitors: "Bobby Kim & Jeremy Selesner" },
  { year: 2008, place: "Elim seed", rank: 12, school: "Glenbrook South High School (IL)", competitors: "Richard Day & Will Thibeau" },
  { year: 2008, place: "Elim seed", rank: 13, school: "Tampa Preparatory School (FL)", competitors: "Nick Honegger & William Rains" },
  { year: 2008, place: "Elim seed", rank: 14, school: "Woodward Academy (GA)", competitors: "Matthew Pesce & Max Plithides" },
  { year: 2008, place: "Elim seed", rank: 15, school: "Glenbrook South High School (IL)", competitors: "Stacy Kapustina & Grant Peretz" },
  { year: 2008, place: "Elim seed", rank: 16, school: "Edgemont High School (NY)", competitors: "Ben Chang & Harsh Jhaveri" },
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
  // 2009 elimination seeds
  { year: 2009, place: "Elim seed", rank: 1, school: "The Westminster Schools (GA)", competitors: "Rajesh Jegadeesh & Anshu Sathian" },
  { year: 2009, place: "Elim seed", rank: 2, school: "Bishop Guertin High School (NH)", competitors: "Katryna Cadle & Chris Power" },
  { year: 2009, place: "Elim seed", rank: 3, school: "Woodward Academy (GA)", competitors: "Brittany Nehman & Matthew Pesce" },
  { year: 2009, place: "Elim seed", rank: 4, school: "Damien High School (CA)", competitors: "Reid Ehrlich-Quinn & Sean Hernandez" },
  { year: 2009, place: "Elim seed", rank: 5, school: "Bishop Guertin High School (NH)", competitors: "Mitch Hagney & Christian Steckler" },
  { year: 2009, place: "Elim seed", rank: 6, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Anna Dimitrijevic & Helen Gomez" },
  { year: 2009, place: "Elim seed", rank: 7, school: "Glenbrook South High School (IL)", competitors: "Richard Day & Will Thibeau" },
  { year: 2009, place: "Elim seed", rank: 8, school: "Fullerton Union High School (CA)", competitors: "Robin Gray & Sasha Sabherwal" },
  { year: 2009, place: "Elim seed", rank: 9, school: "Glenbrook South High School (IL)", competitors: "Colin Quinn & Alec Zimmer" },
  { year: 2009, place: "Elim seed", rank: 10, school: "Notre Dame High School (CA)", competitors: "Chris Duran & Quinn Powell" },
  { year: 2009, place: "Elim seed", rank: 11, school: "Glenbrook North High School (IL)", competitors: "Flynn Makuch & Victor Shao" },
  { year: 2009, place: "Elim seed", rank: 12, school: "Marquette University High School (WI)", competitors: "Joe Balistreri & Ben Benson" },
  { year: 2009, place: "Elim seed", rank: 13, school: "The College Preparatory School (CA)", competitors: "Eunice Kim & Emma Vance" },
  { year: 2009, place: "Elim seed", rank: 14, school: "St. Mark's School of Texas (TX)", competitors: "Alex Gulakov & Alex Miles" },
  { year: 2009, place: "Elim seed", rank: 15, school: "Glenbrook South High School (IL)", competitors: "Stacy Kapustina & Phil Sailer" },
  { year: 2009, place: "Elim seed", rank: 16, school: "Greenhill School (TX)", competitors: "Kush Patel & Chris Patterson" },
  { year: 2009, place: "Elim seed", rank: 17, school: "Damien High School (CA)", competitors: "Eric Berggren & Pablo Gannon" },
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
  // 2011 elimination seeds
  { year: 2011, place: "Elim seed", rank: 1, school: "The Westminster Schools (GA)", competitors: "Ellis Allen & Daniel Taylor" },
  { year: 2011, place: "Elim seed", rank: 2, school: "Lexington High School (MA)", competitors: "Tyler Engler & Arjun Vellayappan" },
  { year: 2011, place: "Elim seed", rank: 3, school: "Damien High School (CA)", competitors: "Nadeem Farooqi & Pablo Gannon" },
  { year: 2011, place: "Elim seed", rank: 4, school: "St. Mark's School of Texas (TX)", competitors: "Rishee Batra & Alex Miles" },
  { year: 2011, place: "Elim seed", rank: 5, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Anna Dimitrijevic & Fabiola Urdaneta" },
  { year: 2011, place: "Elim seed", rank: 6, school: "Stratford Academy (GA)", competitors: "Andrew Jones & Hemanth Sanjeev" },
  { year: 2011, place: "Elim seed", rank: 7, school: "Georgetown Day School (DC)", competitors: "Joe Krakoff & Ben Levy" },
  { year: 2011, place: "Elim seed", rank: 8, school: "Jesuit College Preparatory School of Dallas (TX)", competitors: "Ryan Gorman & Sullivan McCormick" },
  { year: 2011, place: "Elim seed", rank: 9, school: "Lexington High School (MA)", competitors: "Jack Caporal & Michael Suo" },
  { year: 2011, place: "Elim seed", rank: 10, school: "Chattahoochee High School (GA)", competitors: "Will Caplan & Viveth Karthikeyan" },
  { year: 2011, place: "Elim seed", rank: 11, school: "Greenhill School (TX)", competitors: "Akshay Bhushan & Lyall Stuart" },
  { year: 2011, place: "Elim seed", rank: 12, school: "Montgomery Bell Academy (TN)", competitors: "Kelly Haselton & Jesse Suh" },
  { year: 2011, place: "Elim seed", rank: 13, school: "Greenhill School (TX)", competitors: "Kush Patel & Chris Patterson" },
  { year: 2011, place: "Elim seed", rank: 14, school: "The Westminster Schools (GA)", competitors: "Will Morgan & Robel Worku" },
  { year: 2011, place: "Elim seed", rank: 15, school: "Georgetown Day School (DC)", competitors: "Michael Barclay & David Herman" },
  { year: 2011, place: "Elim seed", rank: 16, school: "Greenhill School (TX)", competitors: "Sankalp Banerjee & Azhar Unwala" },
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
  // 2012 elimination seeds
  { year: 2012, place: "Elim seed", rank: 1, school: "Woodward Academy (GA)", competitors: "Jason Sigalos & Rahim Shakoor" },
  { year: 2012, place: "Elim seed", rank: 2, school: "Greenhill School (TX)", competitors: "Azhar Unwala & Lyall Stuart" },
  { year: 2012, place: "Elim seed", rank: 3, school: "St. Mark's School of Texas (TX)", competitors: "Rishee Batra & Zach Burdette" },
  { year: 2012, place: "Elim seed", rank: 4, school: "Georgetown Day School (DC)", competitors: "Michael Barclay & David Herman" },
  { year: 2012, place: "Elim seed", rank: 5, school: "St. Mark's School of Texas (TX)", competitors: "Nikhil Jain & Charlie Marshall" },
  { year: 2012, place: "Elim seed", rank: 6, school: "Homewood-Flossmoor High School (IL)", competitors: "Donald Grasse & Margaret Strong" },
  { year: 2012, place: "Elim seed", rank: 7, school: "Glenbrook South High School (IL)", competitors: "Jacob Hurwitz & Marc Jacome" },
  { year: 2012, place: "Elim seed", rank: 8, school: "Lexington High School (MA)", competitors: "Bennett Clifford & Alex Yared" },
  { year: 2012, place: "Elim seed", rank: 9, school: "Carrollton School of the Sacred Heart (FL)", competitors: "Mary Darmody & Francis Swanson" },
  { year: 2012, place: "Elim seed", rank: 10, school: "St. Vincent de Paul High School (CA)", competitors: "Laynie Stephens & James Fidler" },
  { year: 2012, place: "Elim seed", rank: 11, school: "Glenbrook South High School (IL)", competitors: "Connor O'Brien & Donald Thibeau" },
  { year: 2012, place: "Elim seed", rank: 12, school: "Greenhill School (TX)", competitors: "Sankalp Banerjee & Meg Ranganathan" },
  { year: 2012, place: "Elim seed", rank: 13, school: "Sioux Falls Lincoln High School (SD)", competitors: "Jackson Erpenbach & CJ Point" },
  { year: 2012, place: "Elim seed", rank: 14, school: "Montgomery Bell Academy (TN)", competitors: "Galen Bullington & Kelly Haselton" },
  { year: 2012, place: "Elim seed", rank: 15, school: "Little Rock Central High School (AR)", competitors: "Ian Wren & Daniel Schexnayder" },
  { year: 2012, place: "Elim seed", rank: 16, school: "Glenbrook South High School (IL)", competitors: "Robert Shaw & Ben Wolch" },
  { year: 2012, place: "Elim seed", rank: 17, school: "Notre Dame High School (CA)", competitors: "Ken DeJohn & Aron Berger" },
  { year: 2012, place: "Elim seed", rank: 18, school: "C. K. McClatchy High School (CA)", competitors: "John Spurlock & Liam King" },
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
]

/** Every NDCA policy result on record: titles, top speakers, seeds and speaker places. */
export const NDCA_POLICY_HISTORY: NdcaResult[] = [...NDCA_POLICY_RESULTS, ...NDCA_POLICY_PLACES].sort(
  (a, b) => a.year - b.year,
)

/**
 * High school names that the NDT spells differently for the same debater
 * (`"Guz Eyzaguirre"` debated at Michigan State as `"Gustavo Eyzaguirre"`),
 * so their NDCA results reach their college team.
 */
export const NDCA_NAME_ALIASES: Record<string, string> = {
  "Guz Eyzaguirre": "Gustavo Eyzaguirre",
  "Margaret Strong": "Marge Strong",
}

/** `"4th"`, `"12th"`, `"22nd"`. */
export function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"
  return `${n}${suffix}`
}

/** How a result reads: `"Champion"`, `"Top speaker"`, `"4th seed"`, `"5th speaker"`. */
export function ndcaPlaceLabel(result: Pick<NdcaResult, "place" | "rank">): string {
  if (result.place === "Elim seed") return `${ordinal(result.rank ?? 0)} seed`
  if (result.place === "Speaker") return `${ordinal(result.rank ?? 0)} speaker`
  return result.place
}

/** One school's NDCA policy record, oldest result first. */
export interface NdcaSchoolRecord {
  /** The school's name, with its state tag when any of its rows has one. */
  school: string
  results: NdcaResult[]
  /** Championships, counting a close-out. */
  titles: number
  topSpeakers: number
  /** Elimination seeds (2006–2012 but 2010). */
  elimSeeds: number
  /** Speaker places 2–15 (2006–2012 but 2010). */
  speakerPlaces: number
}

/** Groups NDCA results by school (by {@link tocSchoolKey}, so the history page's "Westminster Schools" and "The Westminster Schools (GA)" are one). */
export function ndcaRecordsBySchool(results: readonly NdcaResult[] = NDCA_POLICY_HISTORY): NdcaSchoolRecord[] {
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
    elimSeeds: list.filter((r) => r.place === "Elim seed").length,
    speakerPlaces: list.filter((r) => r.place === "Speaker").length,
  }))
}

/**
 * A high school's NDCA policy record, or `null` when it has none or the name
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
