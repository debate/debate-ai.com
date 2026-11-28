// @vitest-environment jsdom
/**
 * @fileoverview The Parli "Who debated whom" card: record sheets per top team
 * when Tabroom rounds are synced, and the empty state while loading or when
 * the season has none.
 */

import { afterEach, describe, expect, it } from "vitest"
import { ParliRecordSheets } from "../src/leaderboard/network/ParliRecordSheets"
import type { ParliRoundsSeason } from "../src/sync/parli-tabroom-rounds"
import type { NpdlSeasonRankings } from "../src/sync/sync-npdl-rankings"
import { click, flush, mount, type Mounted } from "./helpers/mount"

const rankings: NpdlSeasonRankings = {
  season: "2026-27",
  pageUrl: "https://www.parliamentarydebate.org/rankings-2026-27",
  fetchedAt: "2026-11-26T06:00:00.000Z",
  teams: [
    { rank: 1, school: "Carlmont", region: "CA1", debater1: "Chien", debater2: "Suto", points: 60 },
    { rank: 2, school: "Nueva", region: "CA1", debater1: "Asudani", debater2: "Wee", points: 55 },
    { rank: 3, school: "Piedmont", region: "CA1", debater1: "Nobody", debater2: "Played", points: 50 },
  ],
  schools: [],
}

const rounds: ParliRoundsSeason = {
  season: "2026-27",
  circuitId: 179,
  fetchedAt: "2026-11-27T00:00:00.000Z",
  results: "public",
  skipped: [],
  tournaments: [
    {
      id: "39001",
      name: "Cal Parli Invitational",
      start: "2026-11-14",
      end: "2026-11-15",
      location: "Berkeley, CA",
      events: [
        {
          id: "5001",
          name: "Open Parli",
          rounds: [
            { id: "7001", label: "Round 1", elim: false, pairings: [{ gov: "Carlmont SC", opp: "Nueva AW", judges: ["Zach Berg", "Ann Li"] }] },
            { id: "7002", label: "Semis", elim: true, pairings: [{ gov: "Nueva AW", opp: "Carlmont SC", judges: ["Sam Cho"], winner: "gov", resultSource: "advancement" }] },
          ],
        },
      ],
    },
  ],
}

let view: Mounted | null = null
afterEach(async () => {
  await view?.unmount()
  view = null
})

const settle = () => flush(() => new Promise((resolve) => setTimeout(resolve, 10)))
const empty = (root: HTMLElement) => root.querySelector('[data-testid="h2h-network-empty"]')?.textContent ?? null

describe("ParliRecordSheets", () => {
  it("shows a loading note until the rankings arrive", async () => {
    view = await mount(<ParliRecordSheets rankings={undefined} loadRounds={async () => rounds} />)
    expect(empty(view.container)).toContain("Loading")
  })

  it("falls back to the empty state with no rankings or no synced season", async () => {
    view = await mount(<ParliRecordSheets rankings={null} loadRounds={async () => rounds} />)
    await settle()
    expect(empty(view.container)).toContain("No Tabroom round data for Parli yet")
    await view.rerender(<ParliRecordSheets rankings={rankings} loadRounds={async () => null} />)
    await settle()
    expect(empty(view.container)).toContain("No Tabroom rounds for the top Parli teams in 2026-27")
    expect(view.container.querySelector('[data-testid="parli-record-sheets"]')).toBeNull()
  })

  it("falls back when the snapshot fails to load", async () => {
    view = await mount(
      <ParliRecordSheets
        rankings={rankings}
        loadRounds={async () => {
          throw new Error("chunk failed")
        }}
      />,
    )
    await settle()
    expect(empty(view.container)).toContain("No Tabroom rounds")
  })

  it("draws a record sheet per matched top team and opens the first", async () => {
    view = await mount(<ParliRecordSheets rankings={rankings} loadRounds={async () => rounds} />)
    await settle()
    const root = view.container
    expect(root.querySelector("#h2h-network-title")?.textContent).toBe("Who debated whom")
    const sheets = [...root.querySelectorAll('[data-testid="parli-sheet"]')] as HTMLDetailsElement[]
    expect(sheets).toHaveLength(2)
    expect(sheets.map((s) => s.open)).toEqual([true, false])
    expect(sheets[0].textContent).toContain("Carlmont Chien & Suto")
    expect(sheets[0].querySelector('[data-testid="parli-sheet-record"]')?.textContent).toBe("0–1")
    expect(sheets[1].querySelector('[data-testid="parli-sheet-record"]')?.textContent).toBe("1–0")

    const body = [...sheets[0].querySelectorAll("tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent))
    expect(body).toHaveLength(2)
    expect(body[0][0]).toContain("Cal Parli Invitational")
    expect(body[0].slice(1, 3)).toEqual(["Round 1", "Gov"])
    expect(body[0][3]).toContain("Nueva Asudani & Wee")
    expect(body[0][4]).toBe("Zach Berg, Ann Li")
    expect(body[0][5]).toBe("—")
    expect(body[1][5]).toContain("L")
    expect(sheets[0].querySelector("a[target=_blank]")?.getAttribute("href")).toBe(
      "https://www.tabroom.com/index/tourn/postings/round.mhtml?tourn_id=39001&round_id=7001",
    )
    expect(root.querySelector('[data-testid="parli-sheets-note"]')?.textContent).toContain("2 Tabroom pairings at 1 NPDL tournaments")
    expect(root.querySelector('[data-testid="parli-sheets-note"]')?.textContent).toContain("inferred from who advanced")
    expect(root.querySelector('[data-testid="parli-sheets-unmatched"]')?.textContent).toContain("#3 Piedmont Nobody & Played")
  })

  it("opens a ranked opponent's sheet from the link", async () => {
    view = await mount(<ParliRecordSheets rankings={rankings} loadRounds={async () => rounds} />)
    await settle()
    const link = view.container.querySelector('[data-testid="parli-opponent-link"]') as HTMLElement
    expect(link.getAttribute("href")).toMatch(/^#parli-sheet-2-/)
    await click(link)
    const sheets = [...view.container.querySelectorAll('[data-testid="parli-sheet"]')] as HTMLDetailsElement[]
    expect(sheets.map((s) => s.open)).toEqual([true, true])
  })

  it("links a team to its page only when it has one", async () => {
    view = await mount(
      <ParliRecordSheets rankings={rankings} loadRounds={async () => rounds} teamHref={(row) => (row.rank === 1 ? "/teams/carlmont" : null)} />,
    )
    await settle()
    const links = [...view.container.querySelectorAll("summary a")].map((a) => a.getAttribute("href"))
    expect(links).toEqual(["/teams/carlmont"])
  })
})
