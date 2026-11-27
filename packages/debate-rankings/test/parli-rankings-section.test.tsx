// @vitest-environment jsdom
/**
 * @fileoverview The Parli section's load states: a season from the API, and
 * "not available" with a Try again that reloads past the browser cache.
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { ParliRankingsSection } from "../src/leaderboard/ParliRankingsSection"
import { click, flush, mount, type Mounted } from "./helpers/mount"

const body = (rankings: unknown) =>
  new Response(JSON.stringify({ source: "database", seasons: ["2024-25"], rankings }))

const season = {
  season: "2024-25",
  pageUrl: "https://www.parliamentarydebate.org/rankings-2024-25",
  fetchedAt: "2026-11-26T06:00:00.000Z",
  teams: [{ rank: 1, school: "Dalton", region: "NY", debater1: "Gordon", debater2: "Langdon", points: 86.7 }],
  schools: [],
}

async function settle(root: HTMLElement, text: string) {
  for (let i = 0; i < 50 && !root.textContent?.includes(text); i++) {
    await flush(() => new Promise((resolve) => setTimeout(resolve, 10)))
  }
}

let view: Mounted | null = null
afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

describe("ParliRankingsSection", () => {
  it("asks for the picked season and shows it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => body(season))
    const shown = vi.fn()
    view = await mount(<ParliRankingsSection season="2024-25" onSeasonShown={shown} />)
    await settle(view.container, "Gordon & Langdon")
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("/api/rankings/npdl?season=2024-25")
    expect(view.container.textContent).toContain("rankings, 2024-25")
    expect(shown).toHaveBeenCalledWith("2024-25")
  })

  it("offers Try again when the rankings are unavailable, reloading past the cache", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => new Response("boom", { status: 500 }))
      .mockImplementationOnce(async () => body(season))
    view = await mount(<ParliRankingsSection />)
    const root = view.container
    await settle(root, "aren't available")
    expect(root.textContent).toContain("Parliamentary rankings aren't available right now.")

    await click([...root.querySelectorAll("button")].find((b) => b.textContent === "Try again")!)
    await settle(root, "Gordon & Langdon")
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual({ cache: "reload" })
    expect(root.textContent).toContain("Dalton")
  })
})
