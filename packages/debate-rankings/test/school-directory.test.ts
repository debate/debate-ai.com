import { describe, expect, it } from "vitest"
import { buildSchoolDirectory, schoolSimilarityKey, similarSchoolGroups } from "../src/schools/school-directory"

describe("buildSchoolDirectory", () => {
  it("puts every spelling of a college on one row, named as the rankings name it", () => {
    const entries = buildSchoolDirectory([
      { name: "State University of New York - Binghamton", level: "college", year: 2018 },
      { name: "Binghamton University", level: "college", year: 2024 },
      { name: "Binghamton", level: "college", year: 2026, current: true },
    ])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      handle: "binghamton",
      name: "Binghamton",
      level: "college",
      firstYear: 2018,
      lastYear: 2026,
      ranked: true,
      missing: [],
    })
    expect(entries[0].aliases).toContain("State University of New York - Binghamton")
  })

  it("flags a high school known only by its handle, and missing logos", () => {
    const entries = buildSchoolDirectory(
      [
        { name: null, handle: "harker-school-ca", level: "highSchool", year: 2019 },
        { name: "Walter Payton", level: "highSchool", year: 2026, current: true },
      ],
      { hasLogo: (name) => name === "Walter Payton" },
    )
    expect(entries.map((e) => [e.handle, e.name, e.missing])).toEqual([
      ["harker-school-ca", "Harker School Ca", ["name", "logo"]],
      ["walter-payton", "Walter Payton", []],
    ])
  })
})

describe("similarSchoolGroups", () => {
  it("finds one high school under two names", () => {
    expect(schoolSimilarityKey("The Harker School (CA)", "highSchool")).toBe("hs:harker")
    const entries = buildSchoolDirectory([
      { name: "Harker", level: "highSchool", year: 2026 },
      { name: "The Harker School (CA)", level: "highSchool", year: 2020 },
      { name: "Walter Payton", level: "highSchool", year: 2026 },
    ])
    expect(similarSchoolGroups(entries)).toEqual([
      {
        key: "hs:harker",
        schools: [
          { handle: "harker", name: "Harker", lastYear: 2026 },
          { handle: "the-harker-school-ca", name: "The Harker School (CA)", lastYear: 2020 },
        ],
      },
    ])
  })
})
