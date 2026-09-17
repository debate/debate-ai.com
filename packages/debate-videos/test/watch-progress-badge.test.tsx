/**
 * @fileoverview Pins what the grid's watch marker renders — the thing a user
 * actually sees, as opposed to the record behind it.
 *
 * Three properties are worth holding still. A thumbnail overlay must not
 * decorate an unwatched video (no badge, no bar, no stray wrapper); the
 * surfaces that *do* want a marker on every item ask for it with
 * `showUnwatched`, and get a ring with no arc labelled "Not watched"; and
 * every badge that renders must carry its label as text, because the tooltip
 * is a hover and a hover is not available to a screen reader or to a phone.
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

  it("draws a plain ring labelled \"Not watched\" when asked to show one", () => {
    // What every row and every card's action row passes, so the marker is
    // there to hover on a video the user has never played.
    const html = render(
      createElement(WatchProgressBadge, { entry: null, showUnwatched: true }),
    )

    expect(html).toContain("Not watched")
    expect(html).toContain('data-watch-status="unwatched"')
    expect(html).toContain('data-watch-percent="0"')
    // The track alone: no progress arc, so it cannot read as partly watched.
    expect(html).toContain("<svg")
    expect(html).not.toContain("stroke-dashoffset")
  })

  it("calls a click that never became playback unwatched, not started", () => {
    const html = render(
      createElement(WatchProgressBadge, {
        entry: entry({ positionSeconds: 2 }),
        showUnwatched: true,
      }),
    )

    expect(html).toContain("Not watched")
    expect(html).not.toContain("stroke-dashoffset")
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
