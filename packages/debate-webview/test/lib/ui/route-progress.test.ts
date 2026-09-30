/**
 * @fileoverview Pins the navigation progress bar's optimistic pacing: it moves
 * forward on every tick but never reaches its ceiling, so 100% stays reserved
 * for a transition that has actually landed.
 */

import { describe, expect, it } from "vitest"

import {
  nextRouteProgress,
  ROUTE_PROGRESS_CEILING,
  ROUTE_PROGRESS_START,
  setRouteProgressPending,
  useRouteProgressStore,
} from "../../../src/lib/ui/route-progress"

describe("nextRouteProgress", () => {
  it("always moves forward from below the ceiling", () => {
    for (const random of [0, 0.5, 0.999]) {
      expect(nextRouteProgress(ROUTE_PROGRESS_START, random)).toBeGreaterThan(ROUTE_PROGRESS_START)
    }
  })

  it("never reaches the ceiling, however many ticks run", () => {
    let value = ROUTE_PROGRESS_START
    for (let i = 0; i < 1000; i++) value = nextRouteProgress(value, 0.999)
    expect(value).toBeLessThan(ROUTE_PROGRESS_CEILING)
    expect(value).toBeGreaterThan(ROUTE_PROGRESS_CEILING - 1)
  })

  it("slows down as it nears the ceiling", () => {
    const early = nextRouteProgress(20, 0.5) - 20
    const late = nextRouteProgress(80, 0.5) - 80
    expect(late).toBeLessThan(early)
  })

  it("never goes past the ceiling from a value at or above it", () => {
    expect(nextRouteProgress(ROUTE_PROGRESS_CEILING)).toBe(ROUTE_PROGRESS_CEILING)
    expect(nextRouteProgress(100)).toBe(ROUTE_PROGRESS_CEILING)
  })
})

describe("route progress store", () => {
  it("tracks whether a transition is pending", () => {
    setRouteProgressPending(true)
    expect(useRouteProgressStore.getState().pending).toBe(true)
    setRouteProgressPending(false)
    expect(useRouteProgressStore.getState().pending).toBe(false)
  })
})
