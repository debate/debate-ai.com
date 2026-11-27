/**
 * @fileoverview The who-debated-whom chart's cards: a clicked entry's card
 * stays pinned until another is clicked, and its opponents link to the
 * rounds on Tabroom.
 */

// @vitest-environment jsdom

import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}))

import { HeadToHeadNetworkChart } from "../src/leaderboard/network/HeadToHeadNetworkChart"
import { HeadToHeadVideosProvider } from "../src/leaderboard/network/HeadToHeadVideosSlot"
import { buildHeadToHeadNetwork, entryKey } from "../src/leaderboard/network/headToHeadNetwork"
import { MAX_ZOOM, MIN_ZOOM } from "../src/leaderboard/network/networkZoom"
import type { RankingEntry } from "../src/types"
import type { HeadToHeadVideosProps } from "../src/leaderboard/network/HeadToHeadVideosSlot"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function entry(rank: number, school: string, name: string): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: 2000 - rank * 10,
    deviation: 50,
    matches: 10,
    rating: 2100 - rank * 10,
    hash: `${school}${name}`,
    affWinRate: null,
    negWinRate: null,
    affElimWinRate: null,
    negElimWinRate: null,
  }
}

const ENTRIES = [
  entry(1, "Emory", "Gallagher & Young"),
  entry(2, "Michigan", "Esmailzadeh & Shah"),
  entry(3, "Kansas", "Baxter & Terreros"),
]
const [A, B, C] = ENTRIES.map((e) => entryKey(e.school, e.name))
const NETWORK = buildHeadToHeadNetwork(
  ENTRIES,
  [
    { aff: A, neg: B, winner: B, tournament: "kentucky-rr", elim: false, roundId: "111111", roundLabel: "Round 3" },
    { aff: B, neg: A, winner: A, tournament: "northwestern", elim: true, roundId: "222222", roundLabel: "Finals" },
    { aff: A, neg: C, winner: A, tournament: "heart-of-texas", elim: false, roundId: "333333", roundLabel: "Round 1" },
  ],
  { width: 400, height: 300, iterations: 30 },
)

let root: Root | null = null
let host: HTMLElement | null = null

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
})

function FakeVideos({ competitors, requireGroups }: HeadToHeadVideosProps) {
  return createElement(
    "div",
    { "data-testid": "h2h-videos" },
    requireGroups ? `pairing:${competitors.length}` : `team:${competitors[0] ?? ""}`,
  )
}

function render(withVideos = false) {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  const chart = createElement(HeadToHeadNetworkChart, {
    network: NETWORK,
    formatLabel: "Policy",
    videoStyles: withVideos ? [1] : [],
  })
  act(() =>
    root!.render(
      withVideos
        ? createElement(HeadToHeadVideosProvider, { component: FakeVideos, children: chart })
        : chart,
    ),
  )
  return host
}

/** The node groups in paint order, by school. */
function nodeGroup(container: HTMLElement, school: string): SVGGElement {
  const groups = [...container.querySelectorAll<SVGGElement>("svg g.cursor-pointer")]
  const index = NETWORK.nodes.findIndex((node) => node.entry.school === school)
  const node = NETWORK.nodes[index]
  return groups.find((g) => g.getAttribute("transform") === `translate(${node.x},${node.y})`)!
}

const click = (el: Element) => act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })))
const hover = (el: Element) => act(() => el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })))

describe("HeadToHeadNetworkChart", () => {
  it("pins a clicked entry's card with opponents linked to their rounds", () => {
    const container = render()
    expect(container.querySelector('button[aria-label="Close"]')).toBeNull()

    click(nodeGroup(container, "Emory"))
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href*="round.mhtml"]')]
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://www.tabroom.com/index/tourn/postings/round.mhtml?round_id=111111",
      "https://www.tabroom.com/index/tourn/postings/round.mhtml?round_id=111111",
      "https://www.tabroom.com/index/tourn/postings/round.mhtml?round_id=222222",
      "https://www.tabroom.com/index/tourn/postings/round.mhtml?round_id=333333",
    ])
    expect(container.textContent).toContain("Kentucky RR Round 3 L")
    expect(container.textContent).toContain("Northwestern Finals W")
    expect(links.every((a) => a.target === "_blank")).toBe(true)
  })

  it("keeps the pinned card while another entry is hovered, until another is clicked", () => {
    const container = render()
    click(nodeGroup(container, "Emory"))
    hover(nodeGroup(container, "Kansas"))
    // Pinned Emory card plus a hover card for Kansas.
    expect(container.querySelector('button[aria-label="Close"]')).not.toBeNull()
    expect(container.textContent).toContain("Baxter & Terreros")
    expect(container.querySelectorAll('a[href*="round_id=222222"]').length).toBe(1)

    click(nodeGroup(container, "Kansas"))
    expect(container.querySelector('a[href*="round_id=222222"]')).toBeNull()
    expect(container.querySelector('a[href*="round_id=333333"]')).not.toBeNull()

    click(container.querySelector('button[aria-label="Close"]')!)
    expect(container.querySelector('button[aria-label="Close"]')).toBeNull()
  })

  it("lists and links every meeting of a pinned pairing", () => {
    const container = render()
    const linkHit = container.querySelectorAll("svg path.cursor-pointer")[0]
    click(linkHit)
    expect(container.textContent).toContain("Kentucky RR Round 3")
    expect(container.textContent).toContain("Northwestern Finals")
    expect(container.querySelector('a[href*="round_id=222222"]')).not.toBeNull()
  })

  it("shows the videos slot on a pinned entry when the host provides one", () => {
    const container = render(true)
    expect(container.querySelector('[data-testid="h2h-videos"]')).toBeNull()
    click(nodeGroup(container, "Emory"))
    const slot = container.querySelector('[data-testid="h2h-videos"]')
    expect(slot?.textContent).toMatch(/^team:/)
  })

  it("shows the pairing videos slot when a link is pinned", () => {
    const container = render(true)
    click(container.querySelectorAll("svg path.cursor-pointer")[0])
    expect(container.querySelector('[data-testid="h2h-videos"]')?.textContent).toMatch(/^pairing:/)
  })

  it("no longer shows the intro paragraph", () => {
    const container = render()
    expect(container.textContent).not.toContain("linked by every round")
    expect(container.textContent).not.toContain("Drag to pan")
  })

  describe("wheel zoom", () => {
    const viewGroup = (container: HTMLElement) => container.querySelector("svg[role=img] > g")!
    const scaleOf = (container: HTMLElement) =>
      Number(/scale\(([\d.e+-]+)\)/.exec(viewGroup(container).getAttribute("transform")!)![1])
    const wheel = (el: Element, deltaY: number, init: WheelEventInit = {}) => {
      const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY, ...init })
      act(() => {
        el.dispatchEvent(event)
      })
      return event
    }

    it("zooms in on scroll up and out on scroll down, preventing page scroll", () => {
      const container = render()
      const svg = container.querySelector("svg[role=img]")!
      expect(scaleOf(container)).toBe(1)

      const up = wheel(svg, -100)
      expect(up.defaultPrevented).toBe(true)
      const zoomedIn = scaleOf(container)
      expect(zoomedIn).toBeGreaterThan(1)

      const down = wheel(svg, 300)
      expect(down.defaultPrevented).toBe(true)
      expect(scaleOf(container)).toBeLessThan(zoomedIn)
    })

    it("keeps the point under the cursor fixed", () => {
      const container = render()
      const svg = container.querySelector("svg[role=img]")!
      // jsdom has no layout: pretend the svg is drawn at 1 user unit per pixel.
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON() {} })
      wheel(svg, -200, { clientX: 100, clientY: 50 })
      const [, tx, ty] = /translate\(([-\d.e+]+),([-\d.e+]+)\)/.exec(viewGroup(container).getAttribute("transform")!)!.map(Number)
      const k = scaleOf(container)
      expect(100 * k + tx).toBeCloseTo(100, 6)
      expect(50 * k + ty).toBeCloseTo(50, 6)
    })

    it("clamps the zoom range", () => {
      const container = render()
      const svg = container.querySelector("svg[role=img]")!
      for (let i = 0; i < 40; i++) wheel(svg, -500)
      expect(scaleOf(container)).toBe(MAX_ZOOM)
      for (let i = 0; i < 80; i++) wheel(svg, 500)
      expect(scaleOf(container)).toBe(MIN_ZOOM)
    })
  })
})
