import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  NICHE_2027_PRIVATE_HIGH_SCHOOLS,
  NICHE_2027_PUBLIC_HIGH_SCHOOLS,
  RANK_LISTS,
  RANK_LIST_IDS,
  SCHOOLS,
  US_NEWS_2027_NATIONAL_UNIVERSITIES,
  entriesAtRank,
  entriesInRankRange,
  findRankEntry,
  getRankList,
  matchSchoolToRankList,
  nameKey,
  rankListCoverage,
  rankListIdForSchool,
  rankStatus,
  reconcileSchool,
  schoolMatchKey,
  wordmarkRankCoverage,
  type RankList,
  type RankListId,
  type RankRange,
} from "../src/index"

const dataDir = path.resolve(import.meta.dirname, "../data")
const fileFor: Record<RankListId, string> = {
  "us-news-2027-national-universities": "us-news-2027-national-universities.json",
  "niche-2027-public-high-schools": "niche-2027-public-high-schools.json",
  "niche-2027-private-high-schools": "niche-2027-private-high-schools.json",
}

const isRange = (r: RankRange, list: RankList): boolean =>
  Number.isInteger(r.from) && Number.isInteger(r.to) && r.from <= r.to && r.from >= list.metadata.firstRank && r.to <= list.metadata.lastRank
const covers = (ranges: readonly RankRange[], rank: number): boolean => ranges.some((r) => rank >= r.from && rank <= r.to)
const countIn = (ranges: readonly RankRange[]): number => ranges.reduce((n, r) => n + (r.to - r.from + 1), 0)

describe.each(RANK_LIST_IDS)("rank list file %s", (id) => {
  const list = RANK_LISTS[id]
  const raw = JSON.parse(readFileSync(path.join(dataDir, fileFor[id]), "utf8")) as RankList

  it("is the file under data/", () => {
    expect(list).toEqual(raw)
    expect(readdirSync(dataDir).sort()).toEqual(Object.values(fileFor).sort())
  })

  it("has the documented schema", () => {
    expect(Object.keys(raw).sort()).toEqual(
      ["entries", "level", "listType", "metadata", "source", "year", ...(raw.schoolType ? ["schoolType"] : []), "schemaVersion"].sort(),
    )
    expect(raw.schemaVersion).toBe(1)
    expect(raw.year).toBe(2027)
    expect(raw.source.publisher).toBeTruthy()
    expect(raw.source.list).toContain("2027")
    expect(raw.source.url).toMatch(/^https:\/\//)
    expect(["college", "high-school"]).toContain(raw.level)
    expect(raw.metadata.notes.length).toBeGreaterThan(0)
    for (const entry of raw.entries) {
      expect(Object.keys(entry).every((k) => ["rank", "tie", "name", "city", "state", "locationRaw"].includes(k))).toBe(true)
      expect(Number.isInteger(entry.rank) && entry.rank >= 1).toBe(true)
      expect(typeof entry.tie).toBe("boolean")
      expect(entry.name.trim()).toBe(entry.name)
      expect(entry.name.length).toBeGreaterThan(2)
      if (entry.state !== undefined) expect(entry.state).toMatch(/^[A-Z]{2}$/)
      if (entry.city !== undefined) expect(entry.city.length).toBeGreaterThan(0)
    }
  })

  it("lists entries best first with no duplicate school at one rank", () => {
    const ranks = raw.entries.map((e) => e.rank)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
    const seen = new Set(raw.entries.map((e) => `${e.rank}|${nameKey(e.name)}|${e.state ?? ""}`))
    expect(seen.size).toBe(raw.entries.length)
  })

  it("flags a tie exactly when a rank is shared, and the next rank skips the tied schools", () => {
    const groups = new Map<number, number>()
    for (const e of raw.entries) groups.set(e.rank, (groups.get(e.rank) ?? 0) + 1)
    for (const e of raw.entries) expect(e.tie).toBe((groups.get(e.rank) as number) > 1)
    const present = [...groups.keys()].sort((a, b) => a - b)
    for (let i = 1; i < present.length; i++) {
      const previous = present[i - 1]
      const adjacentRanks = raw.metadata.rankRangesPresent.some((r) => previous >= r.from && present[i] <= r.to)
      if (adjacentRanks) expect(present[i]).toBe(previous + (groups.get(previous) as number))
    }
  })

  it("describes its coverage honestly in metadata", () => {
    const m = raw.metadata
    expect(m.entryCount).toBe(raw.entries.length)
    expect(m.firstRank).toBe(1)
    for (const r of [...m.rankRangesPresent, ...m.knownGaps]) expect(isRange(r, raw)).toBe(true)
    for (const g of m.knownGaps) expect(g.reason).toBeTruthy()
    expect(m.rankRangesPresent.length).toBeGreaterThan(0)

    // Present and gap ranges never overlap, and together they cover firstRank-lastRank exactly.
    expect(countIn(m.rankRangesPresent) + countIn(m.knownGaps)).toBe(m.lastRank - m.firstRank + 1)
    for (let rank = m.firstRank; rank <= m.lastRank; rank++) {
      expect(covers(m.rankRangesPresent, rank) !== covers(m.knownGaps, rank)).toBe(true)
    }

    // Every entry sits in a present range; no entry sits in a gap.
    for (const e of raw.entries) {
      expect(covers(m.rankRangesPresent, e.rank)).toBe(true)
      expect(covers(m.knownGaps, e.rank)).toBe(false)
    }
    expect(m.complete).toBe(m.knownGaps.length === 0)
  })

  it("has an entry for every rank in a present range unless a tie skips it", () => {
    const ranks = new Set(raw.entries.map((e) => e.rank))
    const tied = raw.entries.filter((e) => e.tie)
    const skipped = new Set<number>()
    for (const rank of new Set(tied.map((e) => e.rank))) {
      const size = tied.filter((e) => e.rank === rank).length
      for (let k = 1; k < size; k++) skipped.add(rank + k)
    }
    for (const r of raw.metadata.rankRangesPresent) {
      for (let rank = r.from; rank <= r.to; rank++) expect(ranks.has(rank) || skipped.has(rank)).toBe(true)
    }
  })

  it("answers rankStatus from the metadata", () => {
    expect(rankStatus(id, 0)).toBe("outside")
    expect(rankStatus(id, raw.metadata.lastRank + 1)).toBe("outside")
    for (const e of raw.entries) expect(rankStatus(id, e.rank)).toBe("present")
    for (const g of raw.metadata.knownGaps) {
      expect(rankStatus(id, g.from)).toBe("gap")
      expect(rankStatus(id, g.to)).toBe("gap")
      expect(entriesAtRank(id, g.from)).toEqual([])
    }
    expect(getRankList(id)).toBe(list)
  })
})

describe("U.S. News 2027 national universities", () => {
  const list = US_NEWS_2027_NATIONAL_UNIVERSITIES

  it("is the complete top 100 with 108 schools, ties included", () => {
    expect(list.metadata).toMatchObject({ complete: true, lastRank: 100, entryCount: 108, knownGaps: [] })
    expect(list.metadata.rankRangesPresent).toEqual([{ from: 1, to: 100 }])
    expect(list.entries).toHaveLength(108)
    expect(new Set(list.entries.map((e) => nameKey(e.name))).size).toBe(108)
  })

  it("keeps the published ties", () => {
    expect(entriesAtRank("us-news-2027-national-universities", 5).map((e) => e.name)).toEqual([
      "California Institute of Technology",
      "Stanford University",
    ])
    expect(entriesAtRank("us-news-2027-national-universities", 6)).toEqual([])
    expect(entriesAtRank("us-news-2027-national-universities", 7).map((e) => e.name)).toEqual(["University of Pennsylvania"])
    const hundred = entriesAtRank("us-news-2027-national-universities", 100)
    expect(hundred).toHaveLength(9)
    expect(hundred.every((e) => e.tie)).toBe(true)
    expect(list.entries.filter((e) => !e.tie).map((e) => e.rank)).toEqual([1, 2, 3, 4, 7, 8, 25, 26, 72])
  })

  it("states no city or state, because the source gives none", () => {
    expect(list.entries.every((e) => e.city === undefined && e.state === undefined)).toBe(true)
  })
})

describe("Niche 2027 high school lists", () => {
  it("public: 200 schools in the compiled ranges, with the gaps named", () => {
    const list = NICHE_2027_PUBLIC_HIGH_SCHOOLS
    expect(list.entries).toHaveLength(200)
    expect(list.metadata.complete).toBe(false)
    expect(list.metadata.rankRangesPresent).toEqual(
      [[1, 50], [76, 100], [126, 150], [176, 250], [601, 625]].map(([from, to]) => ({ from, to })),
    )
    expect(list.metadata.knownGaps.map(({ from, to }) => [from, to])).toEqual([[51, 75], [101, 125], [151, 175], [251, 600], [626, 1001]])
    expect(list.entries.every((e) => !e.tie)).toBe(true)
    expect(entriesInRankRange("niche-2027-public-high-schools", 1, 3).map((e) => e.name)).toEqual([
      "NC School of Science and Mathematics",
      "The Davidson Academy",
      "SC Governor's School for Science and Mathematics",
    ])
    expect(entriesAtRank("niche-2027-public-high-schools", 100)[0].name).toBe("Bergen County Technical HS-Teterboro")
    expect(entriesAtRank("niche-2027-public-high-schools", 625)[0].name).toBe("Riverside HS")
  })

  it("public: reads city and state only where the source gives them", () => {
    const byRank = (rank: number) => entriesAtRank("niche-2027-public-high-schools", rank)[0]
    expect(byRank(1)).toMatchObject({ city: "Durham", state: "NC" })
    expect(byRank(5)).toMatchObject({ state: "NY" })
    expect(byRank(5).city).toBeUndefined()
    expect(byRank(7)).toMatchObject({ city: "Chicago" })
    expect(byRank(7).state).toBeUndefined()
    expect(byRank(77)).toEqual({ rank: 77, tie: false, name: "Neuqua Valley HS" })
  })

  it('does not read "(LA)" for Girls Academic Leadership Academy as Louisiana', () => {
    const gala = NICHE_2027_PUBLIC_HIGH_SCHOOLS.entries.find((e) => e.name === "Girls Academic Leadership Academy")
    expect(gala).toMatchObject({ rank: 34, locationRaw: "LA" })
    expect(gala?.state).toBeUndefined()
  })

  it("private: 50 schools in 1-25 and 775-799, with 26-774 and 800 named as gaps", () => {
    const list = NICHE_2027_PRIVATE_HIGH_SCHOOLS
    expect(list.entries).toHaveLength(50)
    expect(list.metadata.rankRangesPresent.map(({ from, to }) => [from, to])).toEqual([[1, 25], [775, 799]])
    expect(list.metadata.knownGaps.map(({ from, to }) => [from, to])).toEqual([[26, 774], [800, 800]])
    expect(list.metadata.lastRank).toBe(800)
    expect(rankStatus("niche-2027-private-high-schools", 400)).toBe("gap")
    expect(entriesAtRank("niche-2027-private-high-schools", 1)[0]).toMatchObject({ name: "Phillips Academy Andover", state: "MA" })
    expect(entriesAtRank("niche-2027-private-high-schools", 799)[0].name).toBe("Falmouth Academy")
  })
})

describe("name matching", () => {
  it("reuses nameKey for colleges spelled with hyphens, commas or dashes", () => {
    const berkeley = findRankEntry("us-news-2027-national-universities", "University of California, Berkeley")
    expect(berkeley).toMatchObject({ matchedBy: "name", entry: { rank: 20, tie: true } })
    expect(findRankEntry("us-news-2027-national-universities", "University of Michigan–Ann Arbor")?.entry.rank).toBe(25)
    expect(findRankEntry("us-news-2027-national-universities", "The Johns Hopkins University")?.entry.rank).toBe(9)
    expect(findRankEntry("us-news-2027-national-universities", "University of Kansas")).toBeUndefined()
  })

  it("ties alternate college spellings by the pairs in RANK_ENTRY_ALIASES", () => {
    expect(findRankEntry("us-news-2027-national-universities", "Virginia Tech")).toMatchObject({ matchedBy: "alias", entry: { rank: 52 } })
    expect(findRankEntry("us-news-2027-national-universities", "Stony Brook University–SUNY")?.entry.rank).toBe(59)
    expect(
      findRankEntry("us-news-2027-national-universities", "Some Name", { aliases: ["William & Mary"] })?.entry.name,
    ).toBe("College of William and Mary")
  })

  it("builds a looser key for HS / Prep / Senior spellings", () => {
    expect(schoolMatchKey("Payton College Prep")).toBe(schoolMatchKey("Payton College Preparatory High School"))
    expect(schoolMatchKey("Westwood HS IB World School")).toBe(schoolMatchKey("Westwood High IB World School"))
    expect(schoolMatchKey("Speedway Senior HS")).toBe(schoolMatchKey("Speedway Senior High School"))
    expect(schoolMatchKey("The Blake School")).toBe(schoolMatchKey("Blake"))
    expect(schoolMatchKey("Bronx High School of Science")).not.toBe(schoolMatchKey("Brooklyn Latin School"))
  })

  it("finds high schools by name, loose spelling and state", () => {
    expect(findRankEntry("niche-2027-public-high-schools", "Stuyvesant High School", { state: "NY" })?.entry.rank).toBe(5)
    expect(findRankEntry("niche-2027-public-high-schools", "Whitney M. Young Magnet High School")).toMatchObject({
      matchedBy: "loose",
      entry: { rank: 14 },
    })
    expect(findRankEntry("niche-2027-public-high-schools", "Stuyvesant High School", { state: "CA" })).toBeUndefined()
    expect(findRankEntry("niche-2027-private-high-schools", "Harvard-Westlake School", { state: "CA" })?.entry.rank).toBe(7)
    expect(findRankEntry("niche-2027-private-high-schools", "St. Paul's School", { state: "NH" })?.entry.rank).toBe(12)
  })

  it("returns nothing for an ambiguous or unknown name", () => {
    expect(findRankEntry("niche-2027-public-high-schools", "Not A Real School")).toBeUndefined()
    expect(findRankEntry("niche-2027-public-high-schools", "")).toBeUndefined()
    // "Lincoln HS" is one entry (605) with no state, shared by several bundled schools.
    const lincolns = SCHOOLS.filter((s) => s.division === "public-high-school" && nameKey(s.name) === "lincoln-high-school")
    expect(lincolns.length).toBeGreaterThan(1)
    for (const school of lincolns) expect(matchSchoolToRankList(school)).toBeUndefined()
  })

  it("uses the school's own rank to tell state-less entries apart", () => {
    const universityHs = NICHE_2027_PUBLIC_HIGH_SCHOOLS.entries.find((e) => e.name === "University HS")
    expect(universityHs?.rank).toBe(196)
    expect(findRankEntry("niche-2027-public-high-schools", "University High School")?.entry.rank).toBe(196)
    expect(findRankEntry("niche-2027-public-high-schools", "University High School", { state: "AZ", rank: 62 })).toBeUndefined()
    expect(findRankEntry("niche-2027-public-high-schools", "University High School", { state: "FL", rank: 196 })?.entry.rank).toBe(196)
  })
})

describe("reconciling the bundled schools with the compiled lists", () => {
  it("picks the list a school belongs on", () => {
    const byId = (id: string) => SCHOOLS.find((s) => s.id === id)!
    expect(rankListIdForSchool(byId("harvard-university-ma"))).toBe("us-news-2027-national-universities")
    expect(rankListIdForSchool(SCHOOLS.find((s) => s.division === "public-high-school")!)).toBe("niche-2027-public-high-schools")
    expect(rankListIdForSchool(SCHOOLS.find((s) => s.division === "private-high-school")!)).toBe("niche-2027-private-high-schools")
  })

  it("matches all 108 compiled colleges to a bundled college with the same rank", () => {
    const coverage = rankListCoverage("us-news-2027-national-universities")
    expect(coverage.byStatus).toMatchObject({ matched: 108, "rank-conflict": 0, "name-mismatch": 0, "in-gap": 0 })
    expect(coverage.unmatched.every((r) => r.status === "not-compiled")).toBe(true)
    const matched = new Set(
      SCHOOLS.filter((s) => s.level === "college").flatMap((s) => matchSchoolToRankList(s)?.entry ?? []),
    )
    expect(matched.size).toBe(108)
  })

  it("matches all 50 compiled private high schools to a bundled school with the same rank", () => {
    const coverage = rankListCoverage("niche-2027-private-high-schools")
    expect(coverage.byStatus).toMatchObject({ matched: 50, "rank-conflict": 0, "name-mismatch": 0, "not-compiled": 0 })
    expect(coverage.byStatus["in-gap"]).toBe(750)
  })

  it("matches 199 of 200 compiled public high schools; Lincoln HS (605) is ambiguous", () => {
    const coverage = rankListCoverage("niche-2027-public-high-schools")
    expect(coverage.matched).toBe(199)
    const used = new Set(SCHOOLS.flatMap((s) => (s.division === "public-high-school" ? (matchSchoolToRankList(s)?.entry ?? []) : [])))
    const unused = NICHE_2027_PUBLIC_HIGH_SCHOOLS.entries.filter((e) => !used.has(e))
    expect(unused.map((e) => `${e.rank} ${e.name}`)).toEqual(["605 Lincoln HS"])
  })

  it("flags the public ranks where the older Niche list is one place lower (602-626 vs 601-625)", () => {
    const conflicts = SCHOOLS.filter((s) => s.division === "public-high-school")
      .map(reconcileSchool)
      .filter((r) => r.status === "rank-conflict")
    expect(conflicts).toHaveLength(24)
    for (const { school, match } of conflicts) {
      expect(school.nicheRank).toBe((match?.entry.rank as number) + 1)
      expect(match?.entry.rank).toBeGreaterThanOrEqual(601)
    }
  })

  it("reports which wordmark schools match the new data", () => {
    const all = wordmarkRankCoverage()
    expect(all.total).toBe(63)
    expect(all.matched).toBe(26)
    expect(all.byStatus).toEqual({ matched: 26, "rank-conflict": 0, "in-gap": 22, "name-mismatch": 0, "not-compiled": 15 })

    const colleges = wordmarkRankCoverage("college")
    expect(colleges).toMatchObject({ total: 30, matched: 15 })
    expect(colleges.unmatched.map((r) => r.school.name).sort()).toEqual([
      "California State University, Long Beach",
      "George Mason University",
      "Liberty University",
      "Loyola University Chicago",
      "Macalester College",
      "Towson University",
      "University of Houston",
      "University of Kansas",
      "University of Kentucky",
      "University of Louisville",
      "University of North Texas",
      "University of Oklahoma",
      "University of Redlands",
      "University of Texas at Dallas",
      "Western Kentucky University",
    ])
    expect(colleges.unmatched.every((r) => r.status === "not-compiled")).toBe(true)

    const highSchools = wordmarkRankCoverage("high-school")
    expect(highSchools).toMatchObject({ total: 33, matched: 11 })
    expect(highSchools.unmatched.every((r) => r.status === "in-gap")).toBe(true)
    for (const { school, list } of highSchools.unmatched) {
      expect(rankStatus(list, school.nicheRank as number)).toBe("gap")
    }
    const matchedNames = SCHOOLS.filter((s) => s.wordmark && s.level === "high-school" && reconcileSchool(s).status === "matched").map((s) => s.name)
    expect(matchedNames.sort()).toEqual([
      "Bronx High School of Science",
      "Caddo Parish Magnet High School",
      "Coppell High School",
      "Harvard-Westlake School",
      "Lexington High School",
      "Liberal Arts & Science Academy",
      "Palos Verdes Peninsula High School",
      "Payton College Preparatory High School",
      "The College Preparatory School",
      "Westwood High IB World School",
      "Whitney M. Young Magnet High School",
    ].sort())
  })

  it("never reports a name mismatch for a wordmark school", () => {
    for (const school of SCHOOLS.filter((s) => s.wordmark)) expect(reconcileSchool(school).status).not.toBe("name-mismatch")
  })
})
