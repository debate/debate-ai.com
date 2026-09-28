/**
 * @fileoverview Pins the app frame's keep-alive pool.
 *
 * Every assertion here is about *not* reloading a page the user already
 * opened. The failure this guards against is silent — the app still works,
 * pages just quietly reload and lose their scroll position and unsaved state
 * — so it can't be caught by anything but a test that names the invariant.
 */

import { describe, expect, it } from "vitest"

import { keepAlive, keepAllAlive } from "../../../src/lib/nav/frame-pool"

describe("keepAlive", () => {
  it("appends a path the pool doesn't have", () => {
    expect(keepAlive(["/videos"], "/cards")).toEqual(["/videos", "/cards"])
  })

  it("returns the pool untouched for a path it already holds", () => {
    // Identity, not just equality: a new array would re-render the frame list
    // for nothing.
    const pool = ["/videos", "/cards"]
    expect(keepAlive(pool, "/videos")).toBe(pool)
  })

  it("never reorders, so revisiting a frame doesn't move (and reload) it", () => {
    // An LRU would promote /videos to the end here. Moving an iframe in the
    // DOM reloads its document, which is the whole cost this pool avoids.
    let pool = ["/videos", "/cards", "/debate"]
    pool = keepAlive(pool, "/videos")
    pool = keepAlive(pool, "/cards")
    expect(pool).toEqual(["/videos", "/cards", "/debate"])
  })

  it("never evicts, however many frames it holds", () => {
    const many = Array.from({ length: 20 }, (_, i) => `/p${i}`)
    const next = keepAlive(many, "/new")
    expect(next).toHaveLength(21)
    expect(next[0]).toBe("/p0")
  })
})

describe("keepAllAlive", () => {
  it("appends the missing paths after the existing ones, in order", () => {
    expect(keepAllAlive(["/cards"], ["/videos", "/cards", "/doc"])).toEqual(["/cards", "/videos", "/doc"])
  })

  it("returns the pool untouched when it already holds every path", () => {
    const pool = ["/videos", "/cards"]
    expect(keepAllAlive(pool, ["/cards", "/videos"])).toBe(pool)
  })
})
