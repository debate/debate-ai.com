/**
 * @fileoverview Pins the app frame's keep-alive pool.
 *
 * Every assertion here is about *not* reloading a page the user already
 * opened. The failure this guards against is silent — the app still works,
 * pages just quietly reload and lose their scroll position and unsaved state
 * — so it can't be caught by anything but a test that names the invariant.
 */

import { describe, expect, it } from "vitest"

import { keepAlive, MAX_KEPT_FRAMES } from "../frame-pool"

describe("keepAlive", () => {
  it("appends a path the pool doesn't have", () => {
    expect(keepAlive(["/videos"], "/cards", "/cards")).toEqual(["/videos", "/cards"])
  })

  it("returns the pool untouched for a path it already holds", () => {
    // Identity, not just equality: a new array would re-render the frame list
    // for nothing.
    const pool = ["/videos", "/cards"]
    expect(keepAlive(pool, "/videos", "/videos")).toBe(pool)
  })

  it("never reorders, so revisiting a frame doesn't move (and reload) it", () => {
    // An LRU would promote /videos to the end here. Moving an iframe in the
    // DOM reloads its document, which is the whole cost this pool avoids.
    let pool = ["/videos", "/cards", "/debate"]
    pool = keepAlive(pool, "/videos", "/videos")
    pool = keepAlive(pool, "/cards", "/cards")
    expect(pool).toEqual(["/videos", "/cards", "/debate"])
  })

  it("evicts the oldest once it is over the cap", () => {
    const full = Array.from({ length: MAX_KEPT_FRAMES }, (_, i) => `/p${i}`)
    const next = keepAlive(full, "/new", "/new")
    expect(next).toHaveLength(MAX_KEPT_FRAMES)
    expect(next[0]).toBe("/p1")
    expect(next).toContain("/new")
    expect(next).not.toContain("/p0")
  })

  it("never evicts the frame that is on screen", () => {
    // Dropping it would blank the content column mid-session.
    const full = Array.from({ length: MAX_KEPT_FRAMES }, (_, i) => `/p${i}`)
    const next = keepAlive(full, "/new", "/p0")
    expect(next).toContain("/p0")
    expect(next).toContain("/new")
    expect(next).not.toContain("/p1")
  })

  it("still admits the new path when nothing may be evicted", () => {
    // A one-slot pool holding the visible frame: the incoming path wins a
    // temporary slot rather than being dropped on the floor.
    const next = keepAlive(["/videos"], "/cards", "/videos")
    expect(next).toEqual(["/videos", "/cards"])
  })
})
