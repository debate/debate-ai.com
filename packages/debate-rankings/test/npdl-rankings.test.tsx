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
  NPDL_SEASON_YEARS,
  NPDL_SEASONS,
  NPDL_USER_AGENT,
  npdlSeasonFromSlug,
  npdlSlugForSeason,
  parseNpdlCsv,
  parseNpdlHtmlTable,
  parseNpdlInlineTables,
  type NpdlSeasonRankings,
} from "../src/sync/sync-npdl-rankings"
import { npdlDebaters, ParliRankingsTable } from "../src/leaderboard/ParliRankingsSection"
import snapshot from "../data/npdl-rankings.json"

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

  it("offers every published season, 2017-18 (the league's first) on, as end years in the season select", () => {
    expect(NPDL_SEASONS).toEqual([
      "2026-27",
      "2025-26",
      "2024-25",
      "2023-24",
      "2022-23",
      "2021-22",
      "2020-21",
      "2019-20",
      "2018-19",
      "2017-18",
    ])
    expect(NPDL_SEASON_YEARS).toEqual(["2027", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018"])
  })
})

describe("bundled snapshot", () => {
  const seasons = snapshot as Record<string, NpdlSeasonRankings>

  it.each(NPDL_SEASONS)("has %s's team and school rankings", (season) => {
    const s = seasons[season]
    expect(s?.season).toBe(season)
    expect(s.teams.length).toBeGreaterThan(100)
    expect(s.schools.length).toBeGreaterThan(10)
    expect(s.teams[0]).toMatchObject({ rank: 1 })
    expect(s.teams[0].debater1).toBeTruthy()
    expect(s.schools[0]).toMatchObject({ rank: 1, debater1: null, debater2: null })
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

  it("reads sheets a page script loads by name (2023-24)", () => {
    const targets = discoverNpdlSheets(fixture("season-page-script.html"))
    expect(targets).toEqual([
      {
        tab: "team",
        csvUrl: "https://docs.google.com/spreadsheets/d/1fixtureScriptSheet/gviz/tq?tqx=out:csv&sheet=Team&headers=1",
        fallbackUrl: "https://docs.google.com/spreadsheets/d/1fixtureScriptSheet/gviz/tq?tqx=out:html&sheet=Team&headers=1",
      },
      {
        tab: "school",
        csvUrl: "https://docs.google.com/spreadsheets/d/1fixtureScriptSheet/gviz/tq?tqx=out:csv&sheet=School&headers=1",
        fallbackUrl: "https://docs.google.com/spreadsheets/d/1fixtureScriptSheet/gviz/tq?tqx=out:html&sheet=School&headers=1",
      },
    ])
  })
})

describe("parseNpdlInlineTables", () => {
  it("reads tables written into the page (2017-18 to 2022-23), an unclosed one included", () => {
    const tables = parseNpdlInlineTables(fixture("season-page-inline.html"))
    expect(tables.map((t) => t.tab)).toEqual(["team", "school"])
    const [teams, schools] = tables.map((t) => t.table.rows)
    expect(teams.map((r) => r.rank)).toEqual([1, 2, 2])
    expect(teams[2]).toEqual({
      rank: 2,
      school: "Bishop O'Dowd",
      region: null,
      debater1: "Hester",
      debater2: "O'Rafferty",
      points: 74.4,
    })
    expect(schools).toEqual([
      { rank: 1, school: "Menlo-Atherton", region: "CA1", debater1: null, debater2: null, points: 891.5 },
      { rank: 2, school: "Nueva", region: "CA1", debater1: null, debater2: null, points: 600 },
    ])
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

  it("reads a `#` rank column (2025-26 on)", () => {
    const { rows, notes } = parseNpdlCsv(fixture("team-hash.csv"))
    expect(rows.map((r) => [r.rank, r.school, r.points])).toEqual([
      [1, "Stuyvesant", 83],
      [2, "Menlo", 81],
      [2, "Nueva", 81],
    ])
    expect(rows[0]).toMatchObject({ region: "NY", debater1: "Georgatos", debater2: "Miller" })
    expect(notes).toEqual(["The autoqualification number for 2025-26 is 40."])
  })
})

describe("parseNpdlHtmlTable", () => {
  it("drops the viewer's row numbers and decodes entities", () => {
    const { rows } = parseNpdlHtmlTable(fixture("school-pubhtml.html"))
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ rank: 2, school: "Smith & Jones Prep", region: "East", points: 280 })
    expect(rows[1].debater1).toBeNull()
  })

  it("keeps the rank column of a gviz table, which has no row numbers", () => {
    const { rows } = parseNpdlHtmlTable(fixture("school-gviz.html"))
    expect(rows.map((r) => [r.rank, r.school, r.region, r.points])).toEqual([
      [1, "Nueva", "CA1", 664],
      [2, "Dalton", "NY", 661],
    ])
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

  it("reads a page's own tables without fetching any sheet", async () => {
    const seen: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      seen.push(String(input))
      return new Response(fixture("season-page-inline.html"))
    }) as typeof fetch
    const result = await fetchNpdlSeason("2020-21", { fetchImpl, retries: 1 })
    expect(seen).toEqual(["https://www.parliamentarydebate.org/rankings-2020-21"])
    expect(result.teams[0]).toMatchObject({ rank: 1, debater1: "Bodnick", debater2: "Nori" })
    expect(result.schools).toHaveLength(2)
  })

  it("fetches sheets a page script loads by name, as CSV", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === "https://www.parliamentarydebate.org/202324") return new Response(fixture("season-page-script.html"))
      if (url.includes("out:csv&sheet=Team")) return new Response(fixture("team-hash.csv"))
      if (url.includes("out:csv&sheet=School")) return new Response(fixture("school.csv"))
      return new Response("missing", { status: 404 })
    }) as typeof fetch
    const result = await fetchNpdlSeason("2023-24", { fetchImpl, retries: 1 })
    expect(result.teams.map((r) => r.school)).toEqual(["Stuyvesant", "Menlo", "Nueva"])
    expect(result.schools.length).toBeGreaterThan(0)
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
