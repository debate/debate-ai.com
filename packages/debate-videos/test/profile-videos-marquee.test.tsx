/**
 * @fileoverview The school page's video marquee: two copies of the row for
 * the loop, plus left and right arrow buttons.
 */

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { ProfileVideosMarqueeRow, arrowStep, wrapOffset } from "../src/panels/ProfileVideosMarquee"
import type { VideoType } from "../src/types/videos"

const video = ["abc123", "Harker AB vs Greenhill CD", "2025-04-20"] as unknown as VideoType

describe("ProfileVideosMarqueeRow", () => {
  it("draws the row twice with left and right arrows", () => {
    const html = renderToStaticMarkup(<ProfileVideosMarqueeRow videos={[video]} label="Harker" />)
    expect(html).toContain('aria-label="Scroll videos left"')
    expect(html).toContain('aria-label="Scroll videos right"')
    expect(html.match(/mqdefault\.jpg/g)).toHaveLength(2)
    expect(html).toContain("overflow-x-auto")
  })

  it("renders nothing without videos", () => {
    expect(renderToStaticMarkup(<ProfileVideosMarqueeRow videos={[]} label="Harker" />)).toBe("")
  })

  it("wraps offsets into one copy and steps most of a screen", () => {
    expect(wrapOffset(1250, 1000)).toBe(250)
    expect(wrapOffset(-100, 1000)).toBe(900)
    expect(arrowStep(1000)).toBe(800)
    expect(arrowStep(100)).toBe(200)
  })
})
