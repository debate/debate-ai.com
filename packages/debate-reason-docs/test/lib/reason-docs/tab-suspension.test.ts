import { describe, expect, it } from "vitest"
import { MAX_LIVE_TABS, pruneUsage, suspendedTabIds, touchTab } from "../../../src/lib/reason-docs/tab-suspension"
import { editorContentKey, topicTabId } from "../../../src/lib/reason-docs/tab-ids"

describe("tab suspension", () => {
  it("keeps five tabs live", () => {
    expect(MAX_LIVE_TABS).toBe(5)
  })

  it("suspends nothing at or under the cap", () => {
    expect(suspendedTabIds([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 5)).toEqual([])
  })

  it("suspends the least recently used tabs past the cap, in strip order", () => {
    // Used 1..7 in order, then 2 again: 1 and 3 are now the least recent.
    const usage = [1, 3, 4, 5, 6, 7, 2]
    expect(suspendedTabIds([1, 2, 3, 4, 5, 6, 7], usage, 2)).toEqual([1, 3])
  })

  it("never suspends the active tab, however stale its usage", () => {
    expect(suspendedTabIds([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], 1)).toEqual([2])
  })

  it("treats never-used tabs as least recently used", () => {
    expect(suspendedTabIds([9, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 5)).toEqual([9])
  })

  it("covers Topic Starter tabs too", () => {
    const t = topicTabId(4)
    expect(suspendedTabIds([t, 1, 2, 3, 4, 5], [t, 1, 2, 3, 4, 5], 5)).toEqual([t])
    expect(editorContentKey(t)).toBe("topic-4")
    expect(editorContentKey(12)).toBe("12")
  })

  it("touches a tab to most recent, keeping the array when nothing moves", () => {
    const usage = [1, 2, 3]
    expect(touchTab(usage, 1)).toEqual([2, 3, 1])
    expect(touchTab(usage, 3)).toBe(usage)
    expect(touchTab(usage, null)).toBe(usage)
    expect(touchTab(usage, 4)).toEqual([1, 2, 3, 4])
  })

  it("prunes closed tabs from usage", () => {
    const usage = [1, 2, 3]
    expect(pruneUsage(usage, [1, 3])).toEqual([1, 3])
    expect(pruneUsage(usage, [1, 2, 3, 4])).toBe(usage)
  })
})
