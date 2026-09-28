/**
 * @fileoverview How the docs sidebar panels divide the height they share.
 *
 * What these pin: the panels' sizes used to be fixed in CSS, so on `/cards` —
 * where they are the whole sidebar — a long file tree and the open tabs
 * scrolled past each other in a 380px box. They are now a resizable stack, and
 * the numbers that stack opens at come from here.
 *
 * The cases worth holding are the ones a reader can reach: a stored split that
 * covers the panels on screen, a panel switched on since that split was
 * dragged (it must get a share of its own, not the remainder), and storage that
 * has been edited into nonsense — a zero size would open a panel with no height
 * and no separator wide enough to drag it back.
 */

import { describe, it, expect } from "vitest"
import {
  PANEL_MIN_SIZE,
  PANEL_ORDER,
  layoutFor,
  parseLayout,
  visiblePanelsOf,
  type SidebarPanel,
} from "../panel-layout"

/** Percentages, so a valid layout over n panels always sums to 100. */
const sum = (layout: Record<string, number>) => Object.values(layout).reduce((a, b) => a + b, 0)

describe("visiblePanelsOf", () => {
  it("stacks in a fixed order however the panels were switched on", () => {
    expect(visiblePanelsOf(["openTabs", "files"])).toEqual(["files", "openTabs"])
  })

  it("drops the panels that are off", () => {
    expect(visiblePanelsOf(["openTabs"])).toEqual(["openTabs"])
  })

  it("keeps all three when all three are on", () => {
    expect(visiblePanelsOf([...PANEL_ORDER])).toEqual([...PANEL_ORDER])
  })

  it("is empty for no panels — the caller keeps at least one on", () => {
    expect(visiblePanelsOf([])).toEqual([])
  })
})

describe("layoutFor", () => {
  it("weights Files above Open Tabs by default, the 60/40 the CSS cap gave", () => {
    const layout = layoutFor(["files", "openTabs"], {})
    expect(layout).toEqual({ files: 60, openTabs: 40 })
  })

  it("gives a lone panel the whole box", () => {
    expect(layoutFor(["openTabs"], {})).toEqual({ openTabs: 100 })
  })

  it("sums to 100 for every panel set", () => {
    for (const visible of [["files"], ["files", "openTabs"], [...PANEL_ORDER]] as SidebarPanel[][]) {
      expect(sum(layoutFor(visible, {}))).toBeCloseTo(100)
    }
  })

  it("uses the stored split when it covers every visible panel", () => {
    expect(layoutFor(["files", "openTabs"], { files: 80, openTabs: 20 })).toEqual({ files: 80, openTabs: 20 })
  })

  it("renormalizes a stored split to the panels on screen", () => {
    // Open Tabs was switched off since the drag; Files keeps the box rather
    // than keeping its old 30% and leaving a gap.
    expect(layoutFor(["files"], { files: 30, openTabs: 70 })).toEqual({ files: 100 })
  })

  it("falls back to the weights when a visible panel has no stored size", () => {
    // Topics was switched on after the last drag. Mixing the two would hand it
    // whatever Files and Open Tabs left, which is nothing.
    const layout = layoutFor([...PANEL_ORDER], { files: 60, openTabs: 40 })
    expect(layout.topicStarters).toBeGreaterThan(0)
    expect(sum(layout)).toBeCloseTo(100)
    expect(layout.files).toBeGreaterThan(layout.topicStarters!)
  })

  it("ignores a stored zero, which the parser drops anyway", () => {
    const layout = layoutFor(["files", "openTabs"], { files: 100, openTabs: 0 })
    expect(layout).toEqual({ files: 60, openTabs: 40 })
  })

  it("is empty for no panels rather than dividing by zero", () => {
    expect(layoutFor([], {})).toEqual({})
  })

  it("leaves room for the minimum panel size in the default split", () => {
    // Three panels at the default weights, in the shortest column the sidebar
    // is likely to get (a 600px viewport, panels box ~380px): every share must
    // still clear the drag floor.
    const box = 380
    const layout = layoutFor([...PANEL_ORDER], {})
    for (const share of Object.values(layout)) {
      expect((share / 100) * box).toBeGreaterThanOrEqual(PANEL_MIN_SIZE)
    }
  })
})

describe("parseLayout", () => {
  it("reads a stored split back", () => {
    expect(parseLayout('{"files":70,"openTabs":30}')).toEqual({ files: 70, openTabs: 30 })
  })

  it("has nothing for a reader who has never dragged", () => {
    expect(parseLayout(null)).toEqual({})
    expect(parseLayout(undefined)).toEqual({})
    expect(parseLayout("")).toEqual({})
  })

  it("survives storage that is not JSON", () => {
    expect(parseLayout("{not json")).toEqual({})
  })

  it("rejects JSON that is not an object of sizes", () => {
    expect(parseLayout("[70,30]")).toEqual({})
    expect(parseLayout('"files"')).toEqual({})
    expect(parseLayout("null")).toEqual({})
    expect(parseLayout("7")).toEqual({})
  })

  it("drops keys that are not panels", () => {
    expect(parseLayout('{"files":70,"aside":30}')).toEqual({ files: 70 })
  })

  it("drops sizes that would open a panel unreachable", () => {
    // Zero and negative leave no separator to drag back; a string is not a
    // size at all, and NaN/Infinity poison the sum in `layoutFor`.
    expect(parseLayout('{"files":0,"openTabs":-5,"topicStarters":"40"}')).toEqual({})
    expect(parseLayout('{"files":1e999}')).toEqual({})
  })
})
