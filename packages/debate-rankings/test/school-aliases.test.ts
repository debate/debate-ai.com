import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  canonicalSchoolHandle,
  rawSchoolHandle,
  schoolAliases,
  schoolHandle,
} from "../src/leaderboard/profile/rankingProfileHelpers"
import { buildCollegeAliases } from "../src/schools/school-aliases"
import { collegeAliasDataSource } from "../src/sync/school-aliases-cli"

describe("buildCollegeAliases", () => {
  it("folds every spelling of a college into one handle, the current rankings' first", () => {
    const table = buildCollegeAliases(
      [
        { name: "UTD", current: true },
        { name: "University of Texas - Dallas" },
        { name: "State University of New York - Binghamton" },
        { name: "Binghamton University" },
        { name: "Dartmouth College (NH)" },
        { name: "Dartmouth College" },
      ],
      rawSchoolHandle,
    )
    expect(table.handles).toEqual({
      "dartmouth-college-nh": "dartmouth-college",
      "state-university-of-new-york-binghamton": "binghamton",
      "texas-dallas": "utd",
    })
    expect(table.names.binghamton).toEqual(["Binghamton University", "State University of New York - Binghamton"])
  })

  it("keeps a College and a University, or two states, apart", () => {
    const table = buildCollegeAliases(
      [
        { name: "Boston College (MA)" },
        { name: "Boston University (MA)" },
        { name: "Augustana College (IL)" },
        { name: "Augustana University (SD)" },
        { name: "Georgetown College (KY)" },
        { name: "Georgetown University (DC)" },
      ],
      rawSchoolHandle,
    )
    expect(table.handles).toEqual({})
  })
})

describe("college handles", () => {
  it("send the old Binghamton link to its page", () => {
    expect(schoolHandle("State University of New York - Binghamton")).toBe("binghamton")
    expect(canonicalSchoolHandle("state-university-of-new-york-binghamton")).toBe("binghamton")
    expect(schoolAliases("binghamton")).toContain("Binghamton University")
  })

  it("keep current rankings handles", () => {
    expect(schoolHandle("University of Texas - Dallas")).toBe("utd")
    expect(schoolHandle("Dartmouth College (NH)")).toBe("dartmouth")
    expect(schoolHandle("Emory University")).toBe("emory")
  })

  it("school-alias-data.ts is up to date (bun src/sync/school-aliases-cli.ts)", () => {
    const file = readFileSync(path.join(import.meta.dirname, "../src/schools/school-alias-data.ts"), "utf8")
    expect(file).toBe(collegeAliasDataSource())
  })
})
