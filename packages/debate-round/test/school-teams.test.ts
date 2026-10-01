/**
 * @fileoverview Unit tests for `round/school-teams.ts`, the rankings lookup
 * behind the Round Editor dialog's "Teams at <school>" picker.
 */

import { describe, expect, it } from "vitest"
import type { RankingEntry } from "debate-rankings-adapter"
import {
  findSchoolTeams,
  rankingDatasetForStyle,
  splitEntryDebaters,
  stripSchoolState,
} from "../src/round/school-teams"

function entry(rank: number, school: string, name: string): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: 0,
    deviation: 0,
    matches: 0,
    rating: 0,
    hash: `${school}-${name}`,
    affWinRate: null,
    negWinRate: null,
    affElimWinRate: null,
    negElimWinRate: null,
  }
}

const ENTRIES = [
  entry(1, "College Prep", "Falk & Sabnani"),
  entry(4, "Harker", "Le & Luo"),
  entry(2, "Harker", "Ahuja & Miduthuri"),
  entry(3, "Strake Jesuit College Prep", "Magon & Murthy"),
  entry(5, "William Fremd", "Iyer & Bose"),
]

describe("rankingDatasetForStyle", () => {
  it("maps ranked styles to their dataset and the rest to null", () => {
    expect(rankingDatasetForStyle("publicForum")).toBe("hspf")
    expect(rankingDatasetForStyle("lincolnDouglas")).toBe("hsld")
    expect(rankingDatasetForStyle("policy")).toBe("hscx")
    expect(rankingDatasetForStyle("collegePolicy")).toBe("cpd")
    expect(rankingDatasetForStyle("congress")).toBeNull()
  })
})

describe("stripSchoolState", () => {
  it("drops the trailing state the school list adds", () => {
    expect(stripSchoolState("Acton-Boxborough (MA)")).toBe("Acton-Boxborough")
    expect(stripSchoolState("Harker")).toBe("Harker")
  })
})

describe("findSchoolTeams", () => {
  it("lists a school's teams best rank first", () => {
    expect(findSchoolTeams(ENTRIES, "Harker (CA)").map((e) => e.name)).toEqual([
      "Ahuja & Miduthuri",
      "Le & Luo",
    ])
  })

  it("keeps only the closest school match", () => {
    expect(findSchoolTeams(ENTRIES, "Strake Jesuit College Preparatory").map((e) => e.school)).toEqual([
      "Strake Jesuit College Prep",
    ])
  })

  it("matches a partial school name", () => {
    expect(findSchoolTeams(ENTRIES, "Fremd").map((e) => e.name)).toEqual(["Iyer & Bose"])
  })

  it("ignores queries too short to mean one school", () => {
    expect(findSchoolTeams(ENTRIES, "Ha")).toEqual([])
    expect(findSchoolTeams(ENTRIES, "Nowhere Academy")).toEqual([])
  })
})

describe("splitEntryDebaters", () => {
  it("splits a team into its debaters and keeps an LD name whole", () => {
    expect(splitEntryDebaters("Falk & Sabnani")).toEqual(["Falk", "Sabnani"])
    expect(splitEntryDebaters("Siddhartha Daswani")).toEqual(["Siddhartha Daswani"])
  })
})
