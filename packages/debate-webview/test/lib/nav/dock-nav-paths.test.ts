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

import { DOCK_NAV_HREFS, dockNavLabel, isDockNavPath, isDockOwnedPath } from "../../../src/lib/nav/dock-nav-paths"

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

describe("isDockOwnedPath", () => {
  it("accepts every dock destination", () => {
    for (const href of DOCK_NAV_HREFS) {
      expect(isDockOwnedPath(href)).toBe(true)
    }
  })

  it("accepts a page below a destination — unlike isDockNavPath", () => {
    // This is the whole point of the separate predicate: the framed /videos
    // document navigating to /videos/some-lecture on its own should still
    // read as framed, not trigger a breakout.
    expect(isDockOwnedPath("/videos/some-lecture")).toBe(true)
    expect(isDockOwnedPath("/doc/42")).toBe(true)
  })

  it("ignores a trailing slash, query string and hash", () => {
    expect(isDockOwnedPath("/cards/")).toBe(true)
    expect(isDockOwnedPath("/cards?q=nuclear")).toBe(true)
    expect(isDockOwnedPath("/cards#top")).toBe(true)
  })

  it("rejects a tool the dock does not own", () => {
    // A framed /videos document's tool-tree link to /coach — the case
    // AppShell breaks out of the frame for.
    expect(isDockOwnedPath("/coach")).toBe(false)
    expect(isDockOwnedPath("/reason-editor")).toBe(false)
    expect(isDockOwnedPath("/settings")).toBe(false)
    expect(isDockOwnedPath("/")).toBe(false)
    expect(isDockOwnedPath("")).toBe(false)
  })

  it("does not match a path that merely starts with a destination's name", () => {
    expect(isDockOwnedPath("/cards-archive")).toBe(false)
    expect(isDockOwnedPath("/documentation")).toBe(false)
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
