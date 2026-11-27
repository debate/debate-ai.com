/**
 * @fileoverview Pan/zoom math for the who-debated-whom graph.
 */

import { describe, expect, it } from "vitest"
import { MAX_ZOOM, MIN_ZOOM, clampZoom, wheelZoomFactor, zoomAbout } from "../src/leaderboard/network/networkZoom"

describe("zoomAbout", () => {
  it("keeps the anchor point fixed on screen", () => {
    const view = { x: 30, y: -20, k: 1.5 }
    const next = zoomAbout(view, 1.4, 200, 120)
    expect(next.k).toBeCloseTo(2.1)
    // Graph point under the anchor before and after.
    expect((200 - view.x) / view.k).toBeCloseTo((200 - next.x) / next.k)
    expect((120 - view.y) / view.k).toBeCloseTo((120 - next.y) / next.k)
  })

  it("clamps to the zoom range and leaves the view alone at the limit", () => {
    expect(zoomAbout({ x: 0, y: 0, k: 1 }, 1000, 10, 10).k).toBe(MAX_ZOOM)
    expect(zoomAbout({ x: 0, y: 0, k: 1 }, 0.0001, 10, 10).k).toBe(MIN_ZOOM)
    const atMax = { x: 5, y: 6, k: MAX_ZOOM }
    expect(zoomAbout(atMax, 2, 10, 10)).toBe(atMax)
  })
})

describe("wheelZoomFactor", () => {
  const base = { deltaMode: 0, ctrlKey: false }
  it("zooms in for negative deltas and out for positive", () => {
    expect(wheelZoomFactor({ ...base, deltaY: -100 })).toBeGreaterThan(1)
    expect(wheelZoomFactor({ ...base, deltaY: 100 })).toBeLessThan(1)
    expect(wheelZoomFactor({ ...base, deltaY: 0 })).toBe(1)
  })
  it("is symmetric and reacts more to trackpad pinch (ctrl) and line-mode wheels", () => {
    expect(wheelZoomFactor({ ...base, deltaY: -50 }) * wheelZoomFactor({ ...base, deltaY: 50 })).toBeCloseTo(1)
    expect(wheelZoomFactor({ deltaMode: 0, ctrlKey: true, deltaY: -5 })).toBeGreaterThan(wheelZoomFactor({ ...base, deltaY: -5 }))
    expect(wheelZoomFactor({ deltaMode: 1, ctrlKey: false, deltaY: -3 })).toBeGreaterThan(wheelZoomFactor({ ...base, deltaY: -3 }))
  })
})

describe("clampZoom", () => {
  it("bounds values", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
  })
})
