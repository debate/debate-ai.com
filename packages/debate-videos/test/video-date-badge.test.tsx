/**
 * @fileoverview The stacked year / month / season date badge shared by the
 * watch page header and the list rows.
 */

import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { MONTH_BADGE_COLORS } from "../src/components/videos/card/videoCardUtils"
import { VideoDateBadge } from "../src/components/videos/card/VideoDateBadge"
import type { VideoType } from "../src/types/videos"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
  useParams: () => ({}),
  usePathname: () => "/videos/goat",
}))

const { VideoListRows } = await import("../src/components/videos/grid/VideoListRows")

describe("VideoDateBadge", () => {
  it("stacks the year, the month and the season in that order", () => {
    const html = renderToStaticMarkup(
      <VideoDateBadge date="2026-11-14T12:00:00" seasonYear={2027} style={4} />,
    )
    expect(html.indexOf("&#x27;26")).toBeGreaterThan(-1)
    expect(html.indexOf("&#x27;26")).toBeLessThan(html.indexOf("Nov"))
    expect(html.indexOf("Nov")).toBeLessThan(html.indexOf("26-27"))
  })

  it("styles the year and month the way the watch page header does", () => {
    const html = renderToStaticMarkup(
      <VideoDateBadge date="2026-11-14T12:00:00" seasonYear={2027} style={4} />,
    )
    expect(html).toContain("text-orange-300 backdrop-blur-md bg-orange-900/80 border border-orange-400/90 px-2 py-1 rounded")
    expect(html).toContain("text-[11px] font-semibold leading-none")
    expect(html).toContain(MONTH_BADGE_COLORS[10])
  })

  it("renders nothing for a date that does not parse", () => {
    expect(renderToStaticMarkup(<VideoDateBadge date="nope" seasonYear={0} style={4} />)).toBe("")
  })
})

describe("date cell in the list rows", () => {
  const row: VideoType = ["a", "Round a", "2025-04-20", "Channel", 10, "", 2, "Tournament of Champions",
    "Finals", "Aff Team", "Neg Team", true, "3-0", null, null, true, null, 2025]

  it("draws the stacked badge instead of a plain date", () => {
    const html = renderToStaticMarkup(
      createElement(VideoListRows, {
        videos: [row],
        videoContainerRef: { current: null },
        favorites: new Set<string>(),
        onToggleFavorite: () => {},
        onHideVideo: () => {},
        onUnhideVideo: () => {},
        hiddenVideos: new Set<string>(),
        layout: "round",
      }),
    )
    expect(html).toContain('data-testid="video-date-badge"')
    expect(html).toContain("&#x27;25")
    expect(html).toContain("Apr")
    expect(html).toContain("24-25")
  })
})
