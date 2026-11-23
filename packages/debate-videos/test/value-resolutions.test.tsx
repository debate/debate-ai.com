/**
 * @fileoverview Covers the 700 philosophical resolutions data, its search /
 * grouping helpers and the explorer section on the Topics & Statistics page.
 */

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
  VALUE_CATEGORIES,
  VALUE_RESOLUTIONS,
  countValueResolutions,
  groupValueResolutions,
  resolutionPrefix,
  searchValueResolutions,
} from "../src/lib/value-resolutions/value-resolutions"
import {
  PAGE_SIZE,
  ValueResolutionsExplorer,
  valueResolutionSignupHref,
} from "../src/components/topic-explorer/ValueResolutionsExplorer"

describe("value resolutions data", () => {
  it("has all 700 resolutions with unique ids and source numbers, a Pro and a Con", () => {
    expect(VALUE_RESOLUTIONS).toHaveLength(700)
    expect(new Set(VALUE_RESOLUTIONS.map((r) => r.id)).size).toBe(700)
    expect(new Set(VALUE_RESOLUTIONS.map((r) => r.source)).size).toBe(700)
    for (const r of VALUE_RESOLUTIONS) {
      expect(r.id).toMatch(/^[A-Za-z]+\.\d+$/)
      expect(r.title).toBeTruthy()
      expect(r.resolution).toMatch(/\.$/)
      expect(r.resolution).not.toMatch(/should to /)
      expect(r.pro).toBeTruthy()
      expect(r.con).toBeTruthy()
    }
  })

  it("numbers each category from 1 under one prefix", () => {
    for (const { resolutions } of groupValueResolutions(VALUE_RESOLUTIONS)) {
      const prefixes = new Set(resolutions.map(resolutionPrefix))
      expect(prefixes.size).toBe(1)
      expect(resolutions.map((r) => Number(r.id.split(".")[1]))).toEqual(resolutions.map((_, i) => i + 1))
    }
  })

  it("lists the 28 categories, Nuclear first", () => {
    expect(VALUE_CATEGORIES).toHaveLength(28)
    expect(VALUE_CATEGORIES[0]).toBe("Nuclear Ethics, Energy, and Security")
    const counts = countValueResolutions()
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(700)
    expect(counts["Knowledge, Truth, and the Purposes of Education"]).toBe(69)
  })
})

describe("searchValueResolutions", () => {
  it("needs every word to match", () => {
    expect(searchValueResolutions("nuclear waste").map((r) => r.id)).toContain("Nuke.2")
    expect(searchValueResolutions("nuclear zzzz")).toHaveLength(0)
  })

  it("finds a resolution by its id", () => {
    expect(searchValueResolutions("nuke.3").map((r) => r.id)).toContain("Nuke.3")
  })

  it("searches the Con text too", () => {
    expect(searchValueResolutions("duties to future generations").length).toBeGreaterThan(0)
  })

  it("filters by category", () => {
    const category = VALUE_CATEGORIES[1]
    const hits = searchValueResolutions("", category)
    expect(hits).toHaveLength(countValueResolutions()[category])
    expect(hits.every((r) => r.category === category)).toBe(true)
  })

  it("returns everything for an empty query", () => {
    expect(searchValueResolutions("   ")).toHaveLength(700)
  })
})

describe("ValueResolutionsExplorer", () => {
  it("renders the first page with ids, Pro / Con and sign-up links, and no iDebate name", () => {
    const html = renderToStaticMarkup(createElement(ValueResolutionsExplorer))
    expect(html).toContain("Nuke.1")
    expect(html).toContain("Resolved: Society should go nuclear.")
    expect(html).toContain("protection against catastrophic harm")
    expect(html).toContain("Debate this topic")
    expect(html).toContain("/practice/debates?section=topics")
    expect(html).toContain(`Show more (${700 - PAGE_SIZE} left)`)
    expect(html.toLowerCase()).not.toContain("idebate")
  })

  it("links a resolution to its Practice Debates sign-up", () => {
    const href = valueResolutionSignupHref(VALUE_RESOLUTIONS[0])
    const params = new URL(href, "https://x.test").searchParams
    expect(params.get("section")).toBe("topics")
    expect(params.get("topic")).toBe("Society should go nuclear.")
    expect(params.get("source")).toBe("Value resolution Nuke.1")
  })
})
