/**
 * @fileoverview Pins the high school Top 20 bump chart: twenty numbered legend
 * chips, twenty distinguishable line styles, and a cache-busting chart URL.
 */

// @vitest-environment jsdom

import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { eliteDash, ELITE_COLORS, EliteSchoolsBumpChart, type EliteChartCopy } from "../src/leaderboard/profile/NdtEliteSchoolsChart"
import { buildHsEliteSchools, HS_ELITE_COUNT, schoolEliteUrl } from "../src/school-elite"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.innerHTML = ""
})

const copy: EliteChartCopy = {
  id: "t",
  title: "Top 20",
  intro: "",
  rankOf: "Policy programs",
  seasonLabel: "this season",
  window: 4,
  empty: "",
  titles: "TOC titles",
  name: (school) => school.school,
  href: () => "/",
}

describe("HS Top 20 chart", () => {
  it("lists all twenty Policy programs, numbered 1 to 20", () => {
    const chart = buildHsEliteSchools([], "Policy", 2026)
    const host = document.createElement("div")
    document.body.append(host)
    act(() => createRoot(host).render(createElement(EliteSchoolsBumpChart, { chart, copy })))
    const group = host.querySelector('[role="group"]')!
    expect(group.getAttribute("aria-label")).toBe("Top 20 schools")
    const chips = [...group.querySelectorAll("button")]
    expect(chips).toHaveLength(HS_ELITE_COUNT)
    expect(chips.map((chip) => chip.querySelector(".tabular-nums")?.textContent)).toEqual(
      [...Array(HS_ELITE_COUNT)].map((_, i) => String(i + 1)),
    )
  })

  it("has a distinct color for each of the twenty lines and dashes the second ten", () => {
    expect(ELITE_COLORS.length).toBeGreaterThanOrEqual(HS_ELITE_COUNT)
    expect(new Set(ELITE_COLORS).size).toBe(ELITE_COLORS.length)
    expect([...Array(HS_ELITE_COUNT)].map((_, i) => eliteDash(i) === undefined)).toEqual(
      [...Array(HS_ELITE_COUNT)].map((_, i) => i < 10),
    )
  })

  it("requests the chart under a URL that carries the count and years", () => {
    expect(schoolEliteUrl("Policy")).toBe("/api/rankings/school-elite?event=Policy&top=20&years=20")
  })
})
