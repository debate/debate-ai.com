/**
 * @fileoverview Pins which paths count as the app dock's own destinations.
 */

import { describe, expect, it } from "vitest"

import { DOCK_NAV_HREFS, dockNavLabel, isDockNavPath } from "../../../src/lib/nav/dock-nav-paths"

describe("isDockNavPath", () => {
  it("accepts every dock destination", () => {
    for (const href of DOCK_NAV_HREFS) {
      expect(isDockNavPath(href)).toBe(true)
    }
  })

  it("ignores a trailing slash, query string and hash", () => {
    expect(isDockNavPath("/research/cards/")).toBe(true)
    expect(isDockNavPath("/research/cards?q=nuclear")).toBe(true)
    expect(isDockNavPath("/research/cards#top")).toBe(true)
    expect(isDockNavPath("/research/cards/?q=nuclear#top")).toBe(true)
  })

  it("rejects a page below a destination", () => {
    // A page under a destination, not a destination.
    expect(isDockNavPath("/videos/some-lecture")).toBe(false)
    expect(isDockNavPath("/research/docs/42")).toBe(false)
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

describe("dockNavLabel", () => {
  it("names every destination, so no icon is announced as a URL", () => {
    for (const href of DOCK_NAV_HREFS) {
      expect(dockNavLabel(href)).not.toBe(href)
      expect(dockNavLabel(href).length).toBeGreaterThan(0)
    }
  })

  it("falls back to the path for anything else", () => {
    expect(dockNavLabel("/settings")).toBe("/settings")
  })
})
