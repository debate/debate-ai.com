import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  canIdlePrefetch,
  dockIdlePrefetchTargets,
  resetDockIdlePrefetch,
  scheduleDockIdlePrefetch,
} from "../../../src/lib/nav/dock-idle-prefetch"

const HREFS = ["/videos", "/research/cards", "/debate", "/practice/versus-ai", "/research/docs"]

describe("dockIdlePrefetchTargets", () => {
  it("skips the page on screen and the heavy routes", () => {
    expect(dockIdlePrefetchTargets(HREFS, "/debate")).toEqual(["/videos", "/research/cards"])
  })

  it("never warms the practice stack from another page", () => {
    expect(dockIdlePrefetchTargets(HREFS, "/research/cards")).not.toContain("/practice/versus-ai")
  })

  it("treats a page under a destination as that destination", () => {
    expect(dockIdlePrefetchTargets(HREFS, "/videos/pf")).toEqual(["/research/cards", "/debate"])
  })

  it("does not confuse a sibling path with a destination's subtree", () => {
    expect(dockIdlePrefetchTargets(HREFS, "/cardsets")).toContain("/research/cards")
  })
})

describe("canIdlePrefetch", () => {
  it("allows it when the browser gives no connection hints", () => {
    expect(canIdlePrefetch({})).toBe(true)
    expect(canIdlePrefetch(undefined)).toBe(true)
  })

  it("respects data saver and 2G", () => {
    expect(canIdlePrefetch({ connection: { saveData: true } })).toBe(false)
    expect(canIdlePrefetch({ connection: { effectiveType: "2g" } })).toBe(false)
    expect(canIdlePrefetch({ connection: { effectiveType: "slow-2g" } })).toBe(false)
    expect(canIdlePrefetch({ connection: { effectiveType: "4g" } })).toBe(true)
  })
})

describe("scheduleDockIdlePrefetch", () => {
  beforeEach(() => resetDockIdlePrefetch())

  function fakeWindow(connection?: { saveData?: boolean }) {
    return {
      navigator: { connection },
      document: { readyState: "complete" },
      setTimeout: (fn: () => void) => setTimeout(fn, 0) as unknown as number,
      clearTimeout: (id: number) => clearTimeout(id),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window
  }

  it("prefetches each target once, in order, then stops", async () => {
    vi.useFakeTimers()
    const prefetch = vi.fn()
    const cancel = scheduleDockIdlePrefetch(prefetch, ["/videos", "/research/cards"], fakeWindow())
    await vi.runAllTimersAsync()
    expect(prefetch.mock.calls.map(([href]) => href)).toEqual(["/videos", "/research/cards"])
    cancel()
    vi.useRealTimers()
  })

  it("runs once per page load however many docks ask", async () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const second = vi.fn()
    const cancel = scheduleDockIdlePrefetch(first, ["/videos"], fakeWindow())
    scheduleDockIdlePrefetch(second, ["/videos"], fakeWindow())
    await vi.runAllTimersAsync()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    cancel()
    vi.useRealTimers()
  })

  it("does not warm a route twice when another dock restarts the queue", async () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const cancel = scheduleDockIdlePrefetch(first, ["/videos", "/research/cards"], fakeWindow())
    await vi.runAllTimersAsync()
    cancel()
    const second = vi.fn()
    scheduleDockIdlePrefetch(second, ["/videos", "/research/cards", "/debate"], fakeWindow())
    await vi.runAllTimersAsync()
    expect(first.mock.calls.map(([href]) => href)).toEqual(["/videos", "/research/cards"])
    expect(second.mock.calls.map(([href]) => href)).toEqual(["/debate"])
    vi.useRealTimers()
  })

  it("does nothing on a data-saver connection", async () => {
    vi.useFakeTimers()
    const prefetch = vi.fn()
    scheduleDockIdlePrefetch(prefetch, ["/videos"], fakeWindow({ saveData: true }))
    await vi.runAllTimersAsync()
    expect(prefetch).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("stops the pending steps when cancelled", async () => {
    vi.useFakeTimers()
    const prefetch = vi.fn()
    const cancel = scheduleDockIdlePrefetch(prefetch, ["/videos", "/research/cards"], fakeWindow())
    cancel()
    await vi.runAllTimersAsync()
    expect(prefetch).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
