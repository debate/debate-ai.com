import { describe, expect, it } from "vitest"

import debateTopics from "@debate-ai/rankings/data/debate-topics.json"
import { getStyleTopicItems, type DebateTopicYear } from "@debate-ai/rankings/src/topics/debate-topics"
import { withLegacyTopicYears } from "@debate-ai/rankings/src/topics/legacy-topics"

import {
  TOPIC_AREAS,
  TOPIC_FIRST_YEAR,
  TOPIC_LAST_YEAR,
  TOPIC_RESOLUTIONS,
  topicResolutionsFrom,
  countByArea,
  countByYear,
  resolutionsForFormat,
  resolutionsInArea,
} from "../src/lib/topic-areas/topic-areas"

describe("topic-areas data", () => {
  it("files every resolution under a known area, within the charted years", () => {
    const names = new Set(TOPIC_AREAS.map((a) => a.name))
    expect(TOPIC_RESOLUTIONS).toHaveLength(636)
    expect(TOPIC_AREAS).toHaveLength(44)
    for (const r of TOPIC_RESOLUTIONS) {
      expect(names.has(r.area), r.area).toBe(true)
      expect(r.year).toBeGreaterThanOrEqual(TOPIC_FIRST_YEAR)
      expect(r.year).toBeLessThanOrEqual(TOPIC_LAST_YEAR)
    }
  })

  it("splits the resolutions across the four formats with nothing left over", () => {
    const perFormat = (["ndt", "policy", "ld", "pf"] as const).map((f) => resolutionsForFormat(f).length)
    expect(perFormat).toEqual([100, 100, 237, 199])
    expect(resolutionsForFormat("all")).toHaveLength(636)
  })

  it("charts from the 1927-28 season", () => {
    expect(TOPIC_FIRST_YEAR).toBe(1928)
    expect(TOPIC_LAST_YEAR).toBeGreaterThanOrEqual(2026)
  })

  it("skips entries without a category or text", () => {
    expect(
      topicResolutionsFrom([
        { year: 2001, ndt_topic: "N", ndt_topic_category: "Nuclear Policy", policy_topic: "No category" },
        { year: 2000, ld_topics: [{ topic: "L", category: "Education & Youth" }], pf_topics: [{ topic: "P" }] },
      ]),
    ).toEqual([
      { year: 2000, format: "ld", area: "Education & Youth", topic: "L" },
      { year: 2001, format: "ndt", area: "Nuclear Policy", topic: "N" },
    ])
  })
})

describe("topic data", () => {
  it("gives every resolution, in every format and season, a name, an emoji and a known category", () => {
    const names = new Set(TOPIC_AREAS.map((a) => a.name))
    const years = withLegacyTopicYears((debateTopics as { data: DebateTopicYear[] }).data)
    const missing: string[] = []
    let count = 0
    for (const entry of years) {
      const items = [1, 2, 3, 4].flatMap((style) => getStyleTopicItems(entry, style))
      if (entry.bq_topic) {
        items.push({ title: entry.bq_topic_name, emoji: entry.bq_topic_emoji, category: entry.bq_topic_category, text: entry.bq_topic })
      }
      for (const item of items) {
        count++
        if (!item.title || !item.emoji || !item.category || !names.has(item.category)) {
          missing.push(`${entry.year}: ${item.text.slice(0, 60)}`)
        }
      }
    }
    expect(count).toBeGreaterThan(636)
    expect(missing).toEqual([])
  })
})

describe("countByArea", () => {
  it("ranks areas by count, then name, and omits empty areas", () => {
    const counts = countByArea(resolutionsForFormat("ndt"))
    expect(counts.reduce((sum, a) => sum + a.count, 0)).toBe(100)
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
