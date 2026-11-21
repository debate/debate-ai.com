import { describe, expect, it } from "vitest"
import {
  SHIRLEY_LISTED_FROM_YEAR,
  findListedShirleyResults,
  findShirleySchoolResults,
  shirleyResultsBySchool,
  type ShirleyResult,
} from "../src/sync/shirley-results"

const results: ShirleyResult[] = [
  { year: 1985, place: "Champion", school: "Northwestern University" },
  { year: 1999, place: "Second place", school: "Northwestern University" },
  { year: 2004, place: "Champion", school: "Northwestern University" },
  { year: 1990, place: "Champion", school: "Old Only College" },
]

describe("Shirley results on university pages", () => {
  const schools = shirleyResultsBySchool(results)

  it("lists and counts only finals from 2000 on", () => {
    expect(SHIRLEY_LISTED_FROM_YEAR).toBe(2000)
    const listed = findListedShirleyResults("Northwestern", schools)
    expect(listed?.results.map((r) => r.year)).toEqual([2004])
    expect(listed).toMatchObject({ championships: 1, secondPlaces: 0 })
  })

  it("keeps every year for points", () => {
    expect(findShirleySchoolResults("Northwestern", schools)).toMatchObject({ championships: 2, secondPlaces: 1 })
  })

  it("shows nothing for a school whose finals all predate 2000", () => {
    expect(findListedShirleyResults("Old Only", schools)).toBeNull()
  })
})
