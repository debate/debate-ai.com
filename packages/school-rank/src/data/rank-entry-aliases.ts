/**
 * @fileoverview Other spellings of a compiled rank list entry that this
 * package's school data uses (the `@debate-ai/rankings` Niche lists and the
 * college rows). The compiled lists keep the source's own spelling; these
 * pairs let {@link findRankEntry} tie the two together where the difference
 * is more than "HS" / "High School" or a hyphen. Every pair was checked
 * against both spellings; nothing is guessed.
 * @module data/rank-entry-aliases
 */

import type { RankListId } from "../types"

/** `entry name in the compiled list → other names the school data uses for it`. */
export const RANK_ENTRY_ALIASES: Readonly<Record<RankListId, Readonly<Record<string, readonly string[]>>>> = {
  "us-news-2027-national-universities": {
    "Ohio State University-Columbus": ["The Ohio State University"],
    "Virginia Polytechnic Institute and State University": ["Virginia Tech"],
    "College of William and Mary": ["William & Mary"],
    "Purdue University": ["Purdue University–Main Campus"],
    "Stony Brook University": ["Stony Brook University–SUNY"],
    "Texas A&M University-College Station": ["Texas A&M University"],
    "Tulane University": ["Tulane University of Louisiana"],
    "University of Minnesota": ["University of Minnesota–Twin Cities"],
    "Binghamton University": ["Binghamton University–SUNY"],
    "University at Buffalo": ["University at Buffalo–SUNY"],
  },
  "niche-2027-public-high-schools": {
    "NC School of Science and Mathematics": ["North Carolina School of Science and Mathematics"],
    "SC Governor's School for Science and Mathematics": ["South Carolina Governor's School for Science and Mathematics"],
    "DeBakey HS for Health Professions": ["Debakey H.S. for Health Prof"],
    "Bergen County Technical HS-Teterboro": ["Bergen County Technical High School"],
    "Great Hearts-Chandler Prep": ["Great Hearts Academies - Chandler Prep"],
    "MAST@FIU-Biscayne Bay": ["MAST@FIU - Biscayne Bay Campus"],
    "Archimedean Upper Conservatory": ["Archimedean Upper Conservatory (AUC)"],
    "Tesla STEM HS": ["Nikola Tesla STEM High School"],
    "Haas Hall Academy Jones Center": ["Haas Hall Academy Jones Center (Springdale)"],
  },
  "niche-2027-private-high-schools": {},
}
