// @vitest-environment jsdom
/**
 * @fileoverview "All time" lives in the rankings season picker: it hides the
 * Teams/Schools toggle (and the old modal button is gone), and picking it
 * (`?season=all-time`) shows the greatest of all time inline as the page for
 * each of the four events.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { flush, mount, type Mounted } from "./helpers/mount"

const m = vi.hoisted(() => ({ search: "", replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(m.search),
  useRouter: () => ({ replace: m.replace, push: vi.fn() }),
}))

const { LeaderboardFilterBar } = await import("../src/leaderboard/LeaderboardFilterBar")
const { ALL_TIME_SEASON, AllTimeRankingsView } = await import("../src/leaderboard/AllTimeRankingsView")
const { LeaderboardPanel } = await import("../src/leaderboard/RankingsLeaderboardPanel")

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
})

describe("rankings All time season", () => {
  it("is no longer a separate modal button", () => {
    const html = bar("2026")
    expect(html).not.toContain("<dialog")
    expect(html).not.toContain('aria-haspopup="dialog"')
    expect(html).toContain("Teams")
  })

  it("hides the Teams/Schools toggle on All time", () => {
    expect(bar(ALL_TIME_SEASON)).not.toContain(">Schools<")
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
    m.search = "format=VCX&season=all-time"
    view = await mount(<LeaderboardPanel />)
    await flush()
    const text = view.container.textContent ?? ""
    expect(text).toContain("Greatest of all time · high school Policy")
    expect(text).toContain("All time")
    expect(view.container.querySelector("dialog")).toBeNull()
    expect(view.container.querySelector("tbody")).toBeNull()
  })
})
