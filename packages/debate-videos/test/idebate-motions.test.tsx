/**
 * @fileoverview Covers the iDebate motions data, its search / grouping helpers
 * and the explorer section on the Topics & Statistics page.
 */

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
  IDEBATE_MOTIONS,
  IDEBATE_THEMES,
  countIdebateMotionsByTheme,
  groupIdebateMotionsByTheme,
  searchIdebateMotions,
} from "../src/lib/idebate-motions/idebate-motions"
import { IdebateMotionsExplorer, PAGE_SIZE } from "../src/components/topic-explorer/IdebateMotionsExplorer"

describe("iDebate motions data", () => {
  it("has all 700 motions with unique ids, a theme, a topic and pro arguments", () => {
    expect(IDEBATE_MOTIONS).toHaveLength(700)
    expect(new Set(IDEBATE_MOTIONS.map((m) => m.id)).size).toBe(700)
    for (const m of IDEBATE_MOTIONS) {
      expect(m.theme).toBeTruthy()
      expect(m.topic).toBeTruthy()
      expect(m.pro.length).toBeGreaterThan(0)
      if (m.url) expect(m.url).toMatch(/^https:\/\/idebate\.net\//)
    }
  })

  it("lists the ten themes in source order", () => {
    expect(IDEBATE_THEMES[0]).toBe("Education")
    expect(IDEBATE_THEMES).toHaveLength(10)
    const counts = countIdebateMotionsByTheme()
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(700)
  })
})

describe("searchIdebateMotions", () => {
  it("needs every word to match the topic, theme or arguments", () => {
    const hits = searchIdebateMotions("single-sex schools")
    expect(hits.map((m) => m.id)).toContain(1)
    expect(searchIdebateMotions("single-sex zzzz")).toHaveLength(0)
  })

  it("searches the pro arguments too", () => {
    expect(searchIdebateMotions("physics sport").map((m) => m.id)).toContain(1)
  })

  it("filters by theme", () => {
    const hits = searchIdebateMotions("", "Culture")
    expect(hits).toHaveLength(countIdebateMotionsByTheme().Culture)
    expect(hits.every((m) => m.theme === "Culture")).toBe(true)
  })

  it("returns everything for an empty query", () => {
    expect(searchIdebateMotions("   ")).toHaveLength(700)
  })
})

describe("groupIdebateMotionsByTheme", () => {
  it("keeps first-seen theme order", () => {
    const groups = groupIdebateMotionsByTheme(IDEBATE_MOTIONS)
    expect(groups.map((g) => g.theme)).toEqual([...IDEBATE_THEMES])
  })
})

describe("IdebateMotionsExplorer", () => {
  it("renders the first page of cards with their arguments and source links", () => {
    const html = renderToStaticMarkup(createElement(IdebateMotionsExplorer))
    expect(html).toContain("Single-sex schools are good for education")
    expect(html).toContain("No opposite-sex distraction")
    expect(html).toContain("idebate.net/this-house-believes-single-sex-schools")
    expect(html).toContain(`Show more (${700 - PAGE_SIZE} left)`)
    expect(html).not.toContain("tax credit for public interest journalism")
  })
})
