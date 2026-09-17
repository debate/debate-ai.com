/**
 * @fileoverview Pins what the grid's watch marker renders — the thing a user
 * actually sees, as opposed to the record behind it.
 *
 * Two properties are worth holding still. An unwatched library must look
 * exactly as it did before this feature existed (no badge, no bar, no stray
 * wrapper), and every badge that does render must carry its percentage as
 * text: the tooltip is a hover, and a hover is not available to a screen
 * reader or to a phone.
 */

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TooltipProvider } from "../src/ui/primitives/tooltip"
import {
  WatchProgressBadge,
  WatchProgressBar,
} from "../src/components/video-card/WatchProgressBadge"
import type { WatchHistoryEntry } from "../src/state/videoWatchHistory"

const entry = (overrides: Partial<WatchHistoryEntry> = {}): WatchHistoryEntry => ({
  videoId: "abc",
  positionSeconds: 600,
  durationSeconds: 1000,
  title: "NDT Finals",
  watchedAt: "2026-03-01T12:00:00.000Z",
  completed: false,
  ...overrides,
})

/** Renders inside a provider, as every surface that uses the badge does. */
function render(node: React.ReactElement): string {
  return renderToStaticMarkup(createElement(TooltipProvider, null, node))
}

describe("WatchProgressBadge", () => {
  it("renders nothing for a video that was never watched", () => {
    expect(render(createElement(WatchProgressBadge, { entry: null }))).toBe("")
  })

  it("renders nothing for a click that never became playback", () => {
    expect(
      render(createElement(WatchProgressBadge, { entry: entry({ positionSeconds: 2 }) })),
    ).toBe("")
  })

  it("labels a part-watched video with its percentage and clock", () => {
    const html = render(createElement(WatchProgressBadge, { entry: entry() }))

    expect(html).toContain("Mostly watched — 60% (10:00 of 16:40)")
    expect(html).toContain('data-watch-status="mostly"')
    expect(html).toContain('data-watch-percent="60"')
  })

  it("draws a ring rather than a check while a video is unfinished", () => {
    const html = render(createElement(WatchProgressBadge, { entry: entry() }))

    expect(html).toContain("<svg")
    expect(html).toContain("stroke-dashoffset")
  })

  it("marks a finished video with its own icon, not a ring", () => {
    const html = render(
      createElement(WatchProgressBadge, { entry: entry({ completed: true }) }),
    )

    expect(html).toContain('data-watch-status="watched"')
    expect(html).toContain("Watched — 100%")
    expect(html).not.toContain("stroke-dashoffset")
  })

  it("still badges a video whose length the embed never reported", () => {
    const html = render(
      createElement(WatchProgressBadge, { entry: entry({ durationSeconds: 0 }) }),
    )

    expect(html).toContain('data-watch-status="started"')
    expect(html).toContain("10:00 watched")
  })
})

describe("WatchProgressBar", () => {
  it("renders nothing without measurable progress", () => {
    expect(renderToStaticMarkup(createElement(WatchProgressBar, { entry: null }))).toBe("")
    expect(
      renderToStaticMarkup(
        createElement(WatchProgressBar, { entry: entry({ durationSeconds: 0 }) }),
      ),
    ).toBe("")
  })

  it("fills to the fraction watched", () => {
    const html = renderToStaticMarkup(createElement(WatchProgressBar, { entry: entry() }))

    expect(html).toContain("width:60%")
  })
})
