/** @vitest-environment jsdom */
/**
 * @fileoverview `useInfiniteScroll` and `useScrolledPast` watch a sentinel
 * with an IntersectionObserver: the first asks for the next page when the
 * sentinel nears the viewport, the second reports once it has scrolled above it.
 */

import { createRef, type RefObject } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useInfiniteScroll } from "../src/hooks/useInfiniteScroll"
import { useScrolledPast } from "../src/hooks/useScrolledPast"
import { flush, mount, renderHook } from "./helpers/mount"

type Callback = (entries: Array<Partial<IntersectionObserverEntry>>) => void

class FakeObserver {
  static instances: FakeObserver[] = []
  observed: Element[] = []
  disconnected = false
  constructor(
    public callback: Callback,
    public options?: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  disconnect() {
    this.disconnected = true
  }
  fire(entry: Partial<IntersectionObserverEntry>) {
    this.callback([entry])
  }
}

beforeEach(() => {
  FakeObserver.instances = []
  vi.stubGlobal("IntersectionObserver", FakeObserver)
})
afterEach(() => vi.unstubAllGlobals())

function sentinel(): RefObject<HTMLDivElement | null> {
  const ref = createRef<HTMLDivElement | null>() as { current: HTMLDivElement | null }
  ref.current = document.createElement("div")
  return ref
}

describe("useInfiniteScroll", () => {
  it("loads more when the sentinel intersects, with a 400px lead", async () => {
    const loadMore = vi.fn()
    const ref = sentinel()
    const hook = await renderHook(() => useInfiniteScroll(ref, true, false, loadMore))
    const [observer] = FakeObserver.instances
    expect(observer.observed).toEqual([ref.current])
    expect(observer.options?.rootMargin).toBe("400px")

    observer.fire({ isIntersecting: false })
    expect(loadMore).not.toHaveBeenCalled()
    observer.fire({ isIntersecting: true })
    expect(loadMore).toHaveBeenCalledTimes(1)

    await hook.unmount()
    expect(observer.disconnected).toBe(true)
  })

  it.each([
    ["there is no next page", false, false],
    ["a page is already loading", true, true],
  ])("does not observe when %s", async (_label, hasMore, isLoading) => {
    const hook = await renderHook(() => useInfiniteScroll(sentinel(), hasMore, isLoading, vi.fn()))
    expect(FakeObserver.instances).toHaveLength(0)
    await hook.unmount()
  })

  it("does not observe without a sentinel element", async () => {
    const ref = createRef<HTMLDivElement>()
    await renderHook(() => useInfiniteScroll(ref, true, false, vi.fn()))
    expect(FakeObserver.instances).toHaveLength(0)
  })

  it("calls the latest loadMore without rebuilding the observer", async () => {
    const ref = sentinel()
    const first = vi.fn()
    const second = vi.fn()
    function Harness({ loadMore }: { loadMore: () => void }) {
      useInfiniteScroll(ref, true, false, loadMore)
      return null
    }
    const mounted = await mount(<Harness loadMore={first} />)
    await mounted.rerender(<Harness loadMore={second} />)
    expect(FakeObserver.instances).toHaveLength(1)
    FakeObserver.instances[0].fire({ isIntersecting: true })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    await mounted.unmount()
  })
})

describe("useScrolledPast", () => {
  function markerRef() {
    return { current: document.createElement("div") } as RefObject<HTMLElement | null>
  }

  it("tracks the marker leaving the top, not one still below the fold", async () => {
    const ref = markerRef()
    const hook = await renderHook(() => useScrolledPast(ref))
    const observer = FakeObserver.instances[0]
    expect(hook.result.current).toBe(false)

    await flush(() => observer.fire({ isIntersecting: false, boundingClientRect: { top: -20 } as DOMRectReadOnly }))
    expect(hook.result.current).toBe(true)

    await flush(() => observer.fire({ isIntersecting: true, boundingClientRect: { top: 10 } as DOMRectReadOnly }))
    expect(hook.result.current).toBe(false)

    await flush(() => observer.fire({ isIntersecting: false, boundingClientRect: { top: 900 } as DOMRectReadOnly }))
    expect(hook.result.current).toBe(false)

    await hook.unmount()
    expect(observer.disconnected).toBe(true)
  })

  it("stays false without IntersectionObserver support", async () => {
    vi.stubGlobal("IntersectionObserver", undefined)
    const hook = await renderHook(() => useScrolledPast(markerRef()))
    expect(hook.result.current).toBe(false)
  })
})
