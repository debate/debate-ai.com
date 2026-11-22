import { describe, expect, it } from "vitest"
import { ACADEMIC_CATEGORY_RANKS, findAcademicCategoryRank } from "../src/schools/academic-category-ranks"

describe("academic category ranks", () => {
  it("holds the public and private lists with state ranks", () => {
    expect(ACADEMIC_CATEGORY_RANKS.filter((s) => s.category === "Public")).toHaveLength(999)
    expect(ACADEMIC_CATEGORY_RANKS.filter((s) => s.category === "Private")).toHaveLength(800)
    expect(findAcademicCategoryRank("Stuyvesant")).toMatchObject({ category: "Public", nationalRank: 5, state: "NY", stateRank: 1 })
    expect(findAcademicCategoryRank("Harvard-Westlake School (CA)")).toMatchObject({ category: "Private", nationalRank: 7, stateRank: 1 })
  })

  it("matches debate spellings and aliases", () => {
    expect(findAcademicCategoryRank("Whitney Young")?.nationalRank).toBe(14)
    expect(findAcademicCategoryRank("Thomas Jefferson")).toMatchObject({ state: "VA", nationalRank: 23 })
    expect(findAcademicCategoryRank("Westlake")).toMatchObject({ state: "TX" })
    expect(findAcademicCategoryRank("Westlake (CA)")).toMatchObject({ state: "CA", nationalRank: 408 })
    expect(findAcademicCategoryRank("Harker")).toMatchObject({ category: "Private", state: "CA" })
  })

  it("gives nothing for an ambiguous or unlisted name", () => {
    expect(findAcademicCategoryRank("Westwood")).toBeNull()
    expect(findAcademicCategoryRank("Nowhere Prep")).toBeNull()
    expect(findAcademicCategoryRank("")).toBeNull()
  })

  it("gives private schools the full national count and known school details", () => {
    expect(findAcademicCategoryRank("Montgomery Bell Academy")).toMatchObject({
      category: "Private",
      state: "TN",
      nationalRank: 542,
      nationalOf: 4672,
      listedOf: 800,
      stateRank: 6,
      stateOf: 119,
      grade: "A+",
    })
    expect(findAcademicCategoryRank("Montgomery Bell Academy")?.otherRanks).toContainEqual({
      label: "All-boys high schools in the US",
      rank: 37,
      of: 191,
    })
    expect(findAcademicCategoryRank("Stuyvesant")).toMatchObject({ nationalOf: null, listedOf: 999, stateOf: null })
  })
})
