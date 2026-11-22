import { readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  COLLEGE_ROWS,
  SCHOOLS,
  US_NEWS_HIGH_SCHOOL_ROWS,
  WORDMARK_ROWS,
  getSchool,
  topSchools,
  wordmarkCoverage,
} from "../src/index"

const iconsDir = path.resolve(import.meta.dirname, "../../debate-icons")

describe("school data", () => {
  it("gives every school a unique id", () => {
    expect(new Set(SCHOOLS.map((s) => s.id)).size).toBe(SCHOOLS.length)
  })

  it("bundles the U.S. News 2027 top 100 national universities, best first", () => {
    expect(COLLEGE_ROWS).toHaveLength(108)
    const ranks = COLLEGE_ROWS.map(([rank]) => rank as number)
    expect(ranks[0]).toBe(1)
    expect(ranks.at(-1)).toBe(100)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    expect(topSchools("college", 3).map((s) => s.name)).toEqual([
      "Massachusetts Institute of Technology",
      "Princeton University",
      "Harvard University",
    ])
  })

  it("never gives a private high school a U.S. News rank", () => {
    const privates = SCHOOLS.filter((s) => s.division === "private-high-school")
    expect(privates.length).toBe(800)
    expect(privates.every((s) => s.usNewsRank === null && s.nicheRank !== null)).toBe(true)
  })

  it("merges every sourced U.S. News high school rank onto one public school", () => {
    for (const [rank, name] of US_NEWS_HIGH_SCHOOL_ROWS) {
      const hits = SCHOOLS.filter((s) => s.level === "high-school" && s.usNewsRank === rank)
      expect(hits.map((s) => s.name)).toEqual([name])
      expect(hits[0].type).toBe("public")
    }
    expect(topSchools("public-high-school", 20).map((s) => s.usNewsRank)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it("keeps the Niche rank of a school that also has a U.S. News rank", () => {
    const tj = SCHOOLS.find((s) => s.usNewsRank === 6 && s.level === "high-school")
    expect(tj?.nicheRank).toBe(23)
    expect(tj?.aliases).toContain("TJ")
  })

  it("looks schools up by id", () => {
    expect(getSchool("yale-university-ct")?.usNewsRank).toBe(4)
    expect(getSchool("nope")).toBeUndefined()
  })
})

describe("wordmarks", () => {
  it("attaches every wordmark row to exactly one school", () => {
    for (const [file] of WORDMARK_ROWS) {
      expect(SCHOOLS.filter((s) => s.wordmark === file), file).toHaveLength(1)
    }
  })

  it("maps every college and high school png in @debate-ai/icons", () => {
    const files = ["colleges", "high-schools"].flatMap((dir) =>
      readdirSync(path.join(iconsDir, dir))
        .filter((f) => f.endsWith(".png"))
        .map((f) => `${dir}/${f}`),
    )
    expect(WORDMARK_ROWS.map(([file]) => file).sort()).toEqual(files.sort())
  })

  it("counts wordmark coverage of each division's top 100", () => {
    const college = wordmarkCoverage("college")
    expect(college.ranking).toBe("U.S. News")
    expect(college.schools).toBe(108)
    expect(college.names).toContain("Harvard University")
    expect(college.withWordmark).toBe(15)
    expect(college.share).toBeCloseTo(15 / 108)

    const pub = wordmarkCoverage("public-high-school")
    expect(pub.ranking).toBe("Niche")
    expect(pub.schools).toBe(100)
    expect(pub.withWordmark).toBe(8)
    expect(pub.names).toContain("Bronx High School of Science")

    const priv = wordmarkCoverage("private-high-school")
    expect(priv.schools).toBe(100)
    expect(priv.withWordmark).toBe(5)
    expect(priv.names).toContain("Harvard-Westlake School")
  })
})
