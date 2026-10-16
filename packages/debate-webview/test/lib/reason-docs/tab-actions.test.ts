import { describe, expect, it } from "vitest"
import {
  CLOSED_TABS_LIMIT,
  canReopenTab,
  closeAllTabs,
  closeOtherTabs,
  closeTabs,
  closeTabsToRight,
  reopenClosedTab,
  type TabState,
} from "../../../src/lib/reason-docs/tab-actions"

const state = (openTabs: number[], activeId: number | null, closed: number[] = []): TabState => ({
  openTabs,
  activeId,
  closed,
})
const all = () => true

describe("closeTabs", () => {
  it("keeps a surviving active tab and records what closed", () => {
    expect(closeTabs(state([1, 2, 3], 1), [2])).toEqual(state([1, 3], 1, [2]))
  })

  it("moves to the tab that slid into the closed one's slot, else the one before", () => {
    expect(closeTabs(state([1, 2, 3], 2), [2]).activeId).toBe(3)
    expect(closeTabs(state([1, 2, 3], 3), [3]).activeId).toBe(2)
    expect(closeTabs(state([1], 1), [1]).activeId).toBeNull()
  })

  it("ignores tabs that are not open", () => {
    const before = state([1, 2], 1)
    expect(closeTabs(before, [9])).toBe(before)
  })

  it("caps the undo stack", () => {
    const ids = Array.from({ length: CLOSED_TABS_LIMIT + 5 }, (_, i) => i + 1)
    const next = closeAllTabs(state(ids, 1))
    expect(next.closed).toHaveLength(CLOSED_TABS_LIMIT)
    expect(next.closed.at(-1)).toBe(ids.at(-1))
  })
})

describe("tab menu actions", () => {
  it("Close others keeps only the clicked tab and opens it", () => {
    expect(closeOtherTabs(state([1, 2, 3], 1), 2)).toEqual(state([2], 2, [1, 3]))
  })

  it("Close to the right closes every later tab", () => {
    expect(closeTabsToRight(state([1, 2, 3, 4], 4), 2)).toEqual(state([1, 2], 2, [3, 4]))
    expect(closeTabsToRight(state([1, 2], 1), 9)).toEqual(state([1, 2], 1))
  })

  it("Close all empties the strip", () => {
    expect(closeAllTabs(state([1, 2], 2))).toEqual(state([], null, [1, 2]))
  })
})

describe("reopenClosedTab", () => {
  it("reopens the most recently closed tab and makes it active", () => {
    const closed = closeTabs(closeTabs(state([1, 2, 3], 1), [2]), [3])
    const reopened = reopenClosedTab(closed, all)
    expect(reopened).toEqual(state([1, 3], 3, [2]))
    expect(reopenClosedTab(reopened, all)).toEqual(state([1, 3, 2], 2, []))
  })

  it("skips deleted files and tabs that are open again", () => {
    const next = reopenClosedTab(state([1], 1, [2, 1, 3]), (id) => id !== 3)
    expect(next).toEqual(state([1, 2], 2, []))
  })

  it("does nothing when there is nothing to reopen", () => {
    const empty = state([1], 1)
    expect(reopenClosedTab(empty, all)).toBe(empty)
    expect(canReopenTab(empty, all)).toBe(false)
    expect(canReopenTab(state([1], 1, [4]), all)).toBe(true)
    expect(canReopenTab(state([1], 1, [4]), () => false)).toBe(false)
  })
})
