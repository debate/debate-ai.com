// @vitest-environment jsdom
/**
 * @fileoverview "All time" lives in the rankings season picker: it hides the
 * Teams/Schools toggle (and the old modal button is gone), and picking it
 * (`?season=all-time`) shows the greatest of all time inline as the page for
 * each of the four events.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { click, flush, mount, type Mounted } from "./helpers/mount"

const m = vi.hoisted(() => ({ search: "", pathname: "/rank", replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(m.search),
  useRouter: () => ({ replace: m.replace, push: vi.fn() }),
  usePathname: () => m.pathname,
}))

const { LeaderboardFilterBar } = await import("../src/leaderboard/LeaderboardFilterBar")
const { ALL_TIME_SEASON, AllTimeRankingsView, HsAllTimeSchoolsList } = await import("../src/leaderboard/AllTimeRankingsView")
const { LeaderboardPanel } = await import("../src/leaderboard/RankingsLeaderboardPanel")
const { ParliAllTimeList } = await import("../src/leaderboard/ParliAllTimeRankings")

function bar(year: string) {
  return renderToStaticMarkup(
    <LeaderboardFilterBar
      division="NDT"
      view="teams"
      year={year}
      years={["2026", "2025"]}
      onChangeDivision={() => {}}
      onChangeView={() => {}}
      onChangeYear={() => {}}
    />,
  )
}

let view: Mounted | undefined
afterEach(async () => {
  await view?.unmount()
  view = undefined
  m.search = ""
  m.pathname = "/rank"
})

describe("rankings All time season", () => {
  it("is no longer a separate modal button", () => {
    const html = bar("2026")
    expect(html).not.toContain("<dialog")
    expect(html).not.toContain('aria-haspopup="dialog"')
    expect(html).toContain("Teams")
  })

  it("keeps the Teams/Schools toggle on All time", () => {
    expect(bar(ALL_TIME_SEASON)).toContain(">Schools<")
  })

  it("lists a high school event's all-time schools", () => {
    const html = renderToStaticMarkup(
      <HsAllTimeSchoolsList
        event="Policy"
        schools={[
          { rank: 1, school: "Glenbrook North", handle: "glenbrook-north", score: 300.5, titles: 6 },
          { rank: 2, school: "Caddo Magnet", score: 120, titles: 1 },
        ]}
      />,
    )
    expect(html).toContain("Greatest of all time · high school Policy schools")
    expect(html).toContain("Glenbrook North")
    expect(html).toContain('href="/@glenbrook-north"')
    expect(html).toContain("6 titles")
    expect(html).toContain("1 title<")
    expect(html).toContain("300.5 pts")
    expect(renderToStaticMarkup(<HsAllTimeSchoolsList event="Policy" schools={undefined} />)).toContain("Loading all-time schools")
  })

  it("shows the college all-seasons schools on College Policy Schools", () => {
    const html = renderToStaticMarkup(<AllTimeRankingsView division="NDT" view="schools" />)
    expect(html).toContain("all-seasons NDT points")
  })

  it.each([
    ["VPF", "Public Forum"],
    ["VLD", "Lincoln-Douglas"],
    ["VCX", "Policy"],
  ] as const)("shows the %s high school greatest of all time inline", (division, event) => {
    const html = renderToStaticMarkup(<AllTimeRankingsView division={division} />)
    expect(html).toContain(`Greatest of all time · high school ${event}`)
    expect(html).not.toContain('role="tablist"')
  })

  it("shows college all-seasons NDT points for College Policy", () => {
    const html = renderToStaticMarkup(<AllTimeRankingsView division="NDT" />)
    expect(html).toContain("all-seasons NDT points")
  })

  it("renders as the page from ?season=all-time instead of the season table", async () => {
    m.pathname = "/rank/VCX"
    m.search = "season=all-time"
    view = await mount(<LeaderboardPanel />)
    await flush()
    const text = view.container.textContent ?? ""
    expect(text).toContain("Greatest of all time · high school Policy")
    expect(text).toContain("All time")
    expect(view.container.querySelector("dialog")).toBeNull()
    expect(view.container.querySelector("tbody")).toBeNull()
  })

  describe("Parli", () => {
    const allTime = {
      source: "snapshot",
      seasons: ["2024-25", "2023-24"],
      teams: [
        { rank: 1, school: "Nueva", debaters: "Patel & Rao", score: 9.9, seasons: 2, firstYear: 2024, lastYear: 2025, bestRank: 1, firstPlaces: 1 },
        { rank: 2, school: "Dalton", debaters: "Gordon & Langdon", score: 4.8, seasons: 1, firstYear: 2025, lastYear: 2025, bestRank: 4, firstPlaces: 0 },
      ],
      schools: [{ rank: 1, school: "Nueva", score: 14.8, seasons: 2, bestRank: 1, firstPlaces: 2 }],
    }

    it("lists the greatest teams and schools with the same points as the high school lists", () => {
      const teams = renderToStaticMarkup(
        <ParliAllTimeList view="teams" teams={allTime.teams} schools={allTime.schools} seasons={allTime.seasons} />,
      )
      expect(teams).toContain("Greatest of all time · parliamentary teams")
      expect(teams).toContain("Patel &amp; Rao")
      expect(teams).toContain("2024-2025")
      expect(teams).toContain("1 #1 season<")
      expect(teams).toContain("9.9 pts")
      expect(teams).toContain("(101 - rank) / 20")
      const schools = renderToStaticMarkup(
        <ParliAllTimeList view="schools" teams={allTime.teams} schools={allTime.schools} seasons={allTime.seasons} />,
      )
      expect(schools).toContain("Greatest of all time · parliamentary schools")
      expect(schools).toContain("2 #1 seasons")
      expect(schools).toContain("14.8 pts")
    })

    it("offers All time on the Parli tab and shows it from /rank/PARLI?season=all-time", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(allTime)))
      try {
        m.pathname = "/rank/PARLI"
        m.search = "season=all-time"
        view = await mount(<LeaderboardPanel />)
        for (let i = 0; i < 50 && !view.container.textContent?.includes("Patel & Rao"); i++) {
          await flush(() => new Promise((resolve) => setTimeout(resolve, 10)))
        }
        const text = view.container.textContent ?? ""
        expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("/api/rankings/npdl/all-time")
        expect(text).toContain("Greatest of all time · parliamentary teams")
        expect(text).toContain("Patel & Rao")
        expect(view.container.querySelector('[aria-label="Season"]')?.textContent).toContain("All time")
        expect(view.container.querySelector("tbody")).toBeNull()
      } finally {
        fetchSpy.mockRestore()
      }
    })

    it("offers Try again when the all-time lists are unavailable", async () => {
      let asked = 0
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        if (String(input) !== "/api/rankings/npdl/all-time") return new Response("{}", { status: 404 })
        return asked++ === 0 ? new Response("boom", { status: 502 }) : new Response(JSON.stringify(allTime))
      })
      try {
        m.pathname = "/rank/PARLI"
        m.search = "season=all-time&by=schools"
        view = await mount(<LeaderboardPanel />)
        for (let i = 0; i < 50 && !view.container.textContent?.includes("unavailable"); i++) {
          await flush(() => new Promise((resolve) => setTimeout(resolve, 10)))
        }
        const retry = [...view.container.querySelectorAll("button")].find((b) => b.textContent === "Try again")!
        await click(retry)
        for (let i = 0; i < 50 && !view.container.textContent?.includes("14.8 pts"); i++) {
          await flush(() => new Promise((resolve) => setTimeout(resolve, 10)))
        }
        expect(view.container.textContent).toContain("Greatest of all time · parliamentary schools")
        const calls = fetchSpy.mock.calls.filter(([url]) => String(url) === "/api/rankings/npdl/all-time")
        expect(calls).toHaveLength(2)
        expect(calls[1]?.[1]).toEqual({ cache: "reload" })
      } finally {
        fetchSpy.mockRestore()
      }
    })
  })
})
