/**
 * @fileoverview Pins which paths the app dock opens in the app frame.
 *
 * `AppFrameProvider` runs a dock destination in a same-origin iframe so the
 * dock stays alive (and clickable) while the page loads. Getting this
 * predicate wrong is silent in both directions: too loose and a page the
 * framed document navigated to itself gets a second frame stacked on it; too
 * strict and a dock click falls back to a full route change, which is the
 * unresponsive behaviour the frame exists to avoid.
 */

import { describe, expect, it } from "vitest"

import { DOCK_NAV_HREFS, dockNavLabel, isDockNavPath, toFrameSrc } from "../dock-nav-paths"

describe("isDockNavPath", () => {
  it("accepts every dock destination", () => {
    for (const href of DOCK_NAV_HREFS) {
      expect(isDockNavPath(href)).toBe(true)
    }
  })

  it("ignores a trailing slash, query string and hash", () => {
    expect(isDockNavPath("/cards/")).toBe(true)
    expect(isDockNavPath("/cards?q=nuclear")).toBe(true)
    expect(isDockNavPath("/cards#top")).toBe(true)
    expect(isDockNavPath("/cards/?q=nuclear#top")).toBe(true)
  })

  it("rejects a page below a destination", () => {
    // The framed /videos document navigates here on its own; it is not a
    // separate frame for the dock to open.
    expect(isDockNavPath("/videos/some-lecture")).toBe(false)
    expect(isDockNavPath("/doc/42")).toBe(false)
  })

  it("rejects paths the dock does not own", () => {
    expect(isDockNavPath("/reason-editor")).toBe(false)
    expect(isDockNavPath("/settings")).toBe(false)
    expect(isDockNavPath("/")).toBe(false)
    expect(isDockNavPath("")).toBe(false)
  })

  it("does not match a path that merely starts with a destination's name", () => {
    expect(isDockNavPath("/cards-archive")).toBe(false)
    expect(isDockNavPath("/documentation")).toBe(false)
  })
})

describe("toFrameSrc", () => {
  it("marks the frame's URL without changing where it points", () => {
    expect(toFrameSrc("/videos")).toBe("/videos?embed=1")
  })

  it("keeps the destination's own query and hash", () => {
    expect(toFrameSrc("/cards?q=nuclear")).toBe("/cards?q=nuclear&embed=1")
    expect(toFrameSrc("/doc#outline")).toBe("/doc?embed=1#outline")
  })

  it("is idempotent, so re-framing a path reuses the same document", () => {
    // The frame pool is keyed by path; a src that drifted on each pass would
    // reload the document every time the dock came back to it.
    expect(toFrameSrc(toFrameSrc("/videos"))).toBe("/videos?embed=1")
  })

  it("never leaves the site, whatever it is handed", () => {
    // The pool only ever holds dock paths, but a src that could be talked
    // into an absolute URL would frame someone else's page inside the shell.
    expect(toFrameSrc("//evil.example.com/x")).toBe("/x?embed=1")
    expect(toFrameSrc("https://evil.example.com/x")).toBe("/x?embed=1")
  })
})

describe("dockNavLabel", () => {
  it("names every destination, so no frame is announced as a URL", () => {
    for (const href of DOCK_NAV_HREFS) {
      expect(dockNavLabel(href)).not.toBe(href)
      expect(dockNavLabel(href).length).toBeGreaterThan(0)
    }
  })

  it("falls back to the path for anything else", () => {
    expect(dockNavLabel("/settings")).toBe("/settings")
  })
})
