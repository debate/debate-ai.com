import { describe, expect, it } from "vitest"
import { parseSchoolSearchParams, searchSchools, searchSchoolsFromParams } from "../src/index"

describe("searchSchools", () => {
  it("finds a college and its wordmark", () => {
    const [hit] = searchSchools("harvard", { level: "college" })
    expect(hit.school.name).toBe("Harvard University")
    expect(hit.school.usNewsRank).toBe(3)
    expect(hit.wordmark).toBe("colleges/harvard.png")
  })

  it("filters by level", () => {
    const [hit] = searchSchools("harvard", { level: "high-school" })
    expect(hit.school.name).toBe("Harvard-Westlake School")
    expect(searchSchools("harvard", { level: "high-school" }).every((r) => r.school.level === "high-school")).toBe(true)
  })

  it("puts an exact alias first", () => {
    expect(searchSchools("MIT")[0].school.name).toBe("Massachusetts Institute of Technology")
    expect(searchSchools("bronx science")[0].wordmark).toBe("high-schools/bronx.png")
    expect(searchSchools("michigan", { level: "college" })[0].school.name).toBe("University of Michigan–Ann Arbor")
  })

  it("tolerates typos", () => {
    expect(searchSchools("stanfrod")[0].school.name).toBe("Stanford University")
  })

  it("filters by type, state and wordmark", () => {
    const results = searchSchools("westwood", { level: "high-school", state: "tx", type: "public" })
    expect(results[0].school.name).toBe("Westwood High IB World School")
    expect(results.every((r) => r.school.state === "TX" && r.school.type === "public")).toBe(true)
    expect(searchSchools("university", { hasWordmark: true, limit: 50 }).every((r) => r.wordmark)).toBe(true)
  })

  it("returns nothing for a blank query and honours limit", () => {
    expect(searchSchools("  ")).toEqual([])
    expect(searchSchools("school", { limit: 3 })).toHaveLength(3)
  })
})

describe("search params", () => {
  it("reads q, level, type, state, wordmark and limit", () => {
    expect(parseSchoolSearchParams("q=yale&level=high%20school&type=private&state=ct&wordmark=1&limit=5")).toEqual({
      query: "yale",
      options: { level: "high-school", type: "private", state: "CT", hasWordmark: true, limit: 5 },
    })
    expect(parseSchoolSearchParams({ query: "x", level: "university" }).options.level).toBe("college")
    expect(parseSchoolSearchParams("q=x&level=hs&wordmark=false").options).toEqual({ level: "high-school", hasWordmark: false })
  })

  it("searches straight from params", () => {
    expect(searchSchoolsFromParams("q=yale&level=college")[0].school.name).toBe("Yale University")
  })
})
