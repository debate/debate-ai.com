import { describe, expect, it } from "vitest"
import { schoolHandle } from "../src/leaderboard/profile/rankingProfileHelpers"
import { USNEWS_COLLEGE_ACADEMICS, findUsNewsCollegeRank } from "../src/schools/usnews-college-academics"

const rankOf = (name: string) => findUsNewsCollegeRank(schoolHandle(name))?.rank ?? null

describe("U.S. News college academics rank", () => {
  it("holds the 16 supplied colleges, best first", () => {
    expect(USNEWS_COLLEGE_ACADEMICS).toHaveLength(16)
    const ranks = USNEWS_COLLEGE_ACADEMICS.map((row) => row.rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it("matches every spelling the college tables use", () => {
    expect(rankOf("Kansas")).toBe(148)
    expect(rankOf("University of Kansas")).toBe(148)
    expect(rankOf("Kentucky")).toBe(148)
    expect(rankOf("Michigan")).toBe(25)
    expect(rankOf("University of Michigan")).toBe(25)
    expect(rankOf("Wake Forest")).toBe(34)
    expect(rankOf("Emory University (GA)")).toBe(23)
    expect(rankOf("Harvard")).toBe(3)
    expect(rankOf("Dartmouth College (NH)")).toBe(12)
    expect(rankOf("Northwestern")).toBe(9)
    expect(rankOf("University of California - Berkeley")).toBe(20)
    expect(rankOf("UC Berkeley")).toBe(20)
    expect(rankOf("Georgetown")).toBe(23)
    expect(rankOf("State University of New York - Binghamton")).toBe(73)
    expect(rankOf("Southern California")).toBe(27)
    expect(rankOf("Texas")).toBe(34)
    expect(rankOf("Michigan State")).toBe(69)
    expect(rankOf("Iowa")).toBe(100)
    expect(rankOf("University of Georgia")).toBe(52)
  })

  it("never lends a rank to a look-alike school", () => {
    expect(rankOf("Kansas State")).toBeNull()
    expect(rankOf("Iowa State")).toBeNull()
    expect(rankOf("Georgia State")).toBeNull()
    expect(rankOf("Western Kentucky")).toBeNull()
    expect(rankOf("University of Texas - Dallas")).toBeNull()
    expect(rankOf("Harvard-Westlake")).toBeNull()
    expect(rankOf("Missouri - Kansas City")).toBeNull()
  })

  it("leaves unlisted colleges blank", () => {
    expect(rankOf("Liberty")).toBeNull()
    expect(findUsNewsCollegeRank("")).toBeNull()
    expect(findUsNewsCollegeRank(undefined)).toBeNull()
  })
})
