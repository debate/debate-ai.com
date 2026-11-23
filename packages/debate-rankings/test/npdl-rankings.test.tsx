/**
 * @fileoverview Pins the NPDL parliamentary rankings scraper (sheet discovery
 * on a season page, CSV and pubhtml parsing with ties kept as published, the
 * generic User-Agent) and the /rank page's Parliamentary table.
 */

import { readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
  discoverNpdlSheets,
  fetchNpdlSeason,
  NPDL_SEASONS,
  NPDL_USER_AGENT,
  npdlSeasonFromSlug,
  npdlSlugForSeason,
  parseNpdlCsv,
  parseNpdlHtmlTable,
} from "../src/sync/sync-npdl-rankings"
import { npdlDebaters, ParliRankingsTable } from "../src/leaderboard/ParliRankingsSection"

const fixture = (name: string) => readFileSync(new URL(`./fixtures/npdl/${name}`, import.meta.url), "utf8")

describe("NPDL seasons", () => {
  it("reads every slug style as a season", () => {
    expect(npdlSeasonFromSlug("/rankings-202526")).toBe("2025-26")
    expect(npdlSeasonFromSlug("/rankings-2024-25")).toBe("2024-25")
    expect(npdlSeasonFromSlug("/202324")).toBe("2023-24")
    expect(npdlSlugForSeason("2023-24")).toBe("/202324")
    expect(npdlSlugForSeason("1999-00")).toBeUndefined()
    expect(NPDL_SEASONS[0]).toBe("2026-27")
    expect(NPDL_SEASONS).toContain("2017-18")
  })
})

describe("discoverNpdlSheets", () => {
  it("tags each iframe by the heading above it and drops repeats", () => {
    const targets = discoverNpdlSheets(fixture("season-page.html"))
    expect(targets.map((t) => t.tab)).toEqual(["team", "school"])
    expect(targets[0].csvUrl).toBe(
      "https://docs.google.com/spreadsheets/d/e/2PACX-fixtureSheetId/pub?gid=111&single=true&output=csv",
    )
    expect(targets[1].fallbackUrl).toContain("pubhtml?gid=222")
  })
})

describe("parseNpdlCsv", () => {
  it("skips the title row, keeps published ties and quoted commas", () => {
    const { rows, notes, skipped } = parseNpdlCsv(fixture("team.csv"))
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 9, 9, 11])
    expect(rows[0]).toEqual({
      rank: 1,
      school: "Blind Brook/Stuyvesant",
      region: "Northeast",
      debater1: "Ava Chen",
      debater2: "Lee, Jr., Sam",
      points: 88.5,
    })
    expect(rows[4].points).toBe(1204)
    expect(notes).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it("throws without a Rank + School header", () => {
    expect(() => parseNpdlCsv("a,b\n1,2\n")).toThrow(/header/)
  })
})

describe("parseNpdlHtmlTable", () => {
  it("drops the viewer's row numbers and decodes entities", () => {
    const { rows } = parseNpdlHtmlTable(fixture("school-pubhtml.html"))
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ rank: 2, school: "Smith & Jones Prep", region: "East", points: 280 })
    expect(rows[1].debater1).toBeNull()
  })
})

describe("fetchNpdlSeason", () => {
  it("scrapes a season's two sheets, falling back to pubhtml when CSV is blocked", async () => {
    const seen: { url: string; ua: string | null }[] = []
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      seen.push({ url, ua: new Headers(init?.headers).get("User-Agent") })
      if (url === "https://www.parliamentarydebate.org/rankings-2024-25") return new Response(fixture("season-page.html"))
      if (url.includes("gid=111") && url.includes("output=csv")) return new Response(fixture("team.csv"))
      if (url.includes("gid=222") && url.includes("output=csv")) return new Response("forbidden", { status: 403 })
      if (url.includes("gid=222") && url.includes("pubhtml")) return new Response(fixture("school-pubhtml.html"))
      return new Response("missing", { status: 404 })
    }) as typeof fetch

    const logs: string[] = []
    const result = await fetchNpdlSeason("2024-25", { fetchImpl, retries: 1, log: (l) => logs.push(l) })
    expect(result.season).toBe("2024-25")
    expect(result.teams).toHaveLength(5)
    expect(result.schools.map((s) => s.school)).toEqual(["Mission San Jose", "Smith & Jones Prep"])
    expect(logs.some((l) => l.includes("trying pubhtml"))).toBe(true)
    expect(new Set(seen.map((s) => s.ua))).toEqual(new Set([NPDL_USER_AGENT]))
    expect(NPDL_USER_AGENT).not.toMatch(/@|contact/i)
  })

  it("rejects unknown seasons", async () => {
    await expect(fetchNpdlSeason("1990-91")).rejects.toThrow(/unknown/)
  })
})

describe("ParliRankingsTable", () => {
  const { rows } = parseNpdlCsv(fixture("team.csv"))

  it("lists teams with debaters and tied ranks", () => {
    const html = renderToStaticMarkup(createElement(ParliRankingsTable, { rows, kind: "teams" }))
    expect(html).toContain("Debaters")
    expect(html).toContain("Ava Chen &amp; Lee, Jr., Sam")
    expect(html.match(/>9</g)).toHaveLength(2)
  })

  it("shows a 'Show all' button past 25 rows and an empty state", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...rows[0], rank: i + 1 }))
    expect(renderToStaticMarkup(createElement(ParliRankingsTable, { rows: many, kind: "schools" }))).toContain("Show all 30")
    expect(renderToStaticMarkup(createElement(ParliRankingsTable, { rows: [], kind: "schools" }))).toContain("No schools ranked")
    expect(npdlDebaters({ debater1: "A", debater2: null })).toBe("A")
  })
})
