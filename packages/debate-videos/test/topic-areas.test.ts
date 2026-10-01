import { describe, expect, it } from "vitest"

import {
  TOPIC_AREAS,
  TOPIC_FIRST_YEAR,
  TOPIC_LAST_YEAR,
  TOPIC_RESOLUTIONS,
  countByArea,
  countByYear,
  resolutionsForFormat,
  resolutionsInArea,
} from "../../src/lib/topic-areas/topic-areas"

describe("topic-areas data", () => {
  it("files every resolution under a known area, within the charted years", () => {
    const names = new Set(TOPIC_AREAS.map((a) => a.name))
    expect(TOPIC_RESOLUTIONS).toHaveLength(328)
    expect(TOPIC_AREAS).toHaveLength(44)
    for (const r of TOPIC_RESOLUTIONS) {
      expect(names.has(r.area), r.area).toBe(true)
      expect(r.year).toBeGreaterThanOrEqual(TOPIC_FIRST_YEAR)
      expect(r.year).toBeLessThanOrEqual(TOPIC_LAST_YEAR)
    }
  })

  it("splits the resolutions across the four formats with nothing left over", () => {
    const perFormat = (["ndt", "policy", "ld", "pf"] as const).map((f) => resolutionsForFormat(f).length)
    expect(perFormat).toEqual([27, 27, 138, 136])
    expect(resolutionsForFormat("all")).toHaveLength(328)
  })
})

describe("countByArea", () => {
  it("ranks areas by count, then name, and omits empty areas", () => {
    const counts = countByArea(resolutionsForFormat("ndt"))
    expect(counts.reduce((sum, a) => sum + a.count, 0)).toBe(27)
    expect(counts.every((a) => a.count > 0)).toBe(true)
    for (let i = 1; i < counts.length; i++) {
      const [prev, cur] = [counts[i - 1], counts[i]]
      expect(prev.count > cur.count || (prev.count === cur.count && prev.name.localeCompare(cur.name) < 0)).toBe(true)
    }
  })
})

describe("resolutionsInArea", () => {
  it("returns only that area, newest first", () => {
    const area = countByArea(TOPIC_RESOLUTIONS)[0].name
    const list = resolutionsInArea(TOPIC_RESOLUTIONS, area)
    expect(list.every((r) => r.area === area)).toBe(true)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].year).toBeGreaterThanOrEqual(list[i].year)
  })
})

describe("countByYear", () => {
  it("has one entry per season, zeros included, summing to the input", () => {
    const list = resolutionsForFormat("policy")
    const years = countByYear(list)
    expect(years).toHaveLength(TOPIC_LAST_YEAR - TOPIC_FIRST_YEAR + 1)
    expect(years[0].year).toBe(TOPIC_FIRST_YEAR)
    expect(years.reduce((sum, y) => sum + y.count, 0)).toBe(list.length)
  })
})
