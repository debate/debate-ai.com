/**
 * @vitest-environment jsdom
 *
 * The navigation progress bar end to end: `useRouteLoading` arming the bar on
 * an in-app link click or a back/forward to another page, settling it two
 * frames after the pathname changes, and `RouteProgressBar` showing only past
 * its delay, trickling, then filling and fading out.
 */
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ pathname: "/videos" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))

import { RouteProgressBar } from "../../../src/components/ui/RouteProgressBar"
import {
  ROUTE_PROGRESS_FINISH_MS,
  ROUTE_PROGRESS_SHOW_DELAY_MS,
  ROUTE_PROGRESS_START,
  ROUTE_PROGRESS_TRICKLE_MS,
  useRouteProgressStore,
} from "../../../src/lib/ui/route-progress"
import { ROUTE_LOADING_TIMEOUT_MS, startRouteLoading, useRouteLoading } from "../../../src/lib/ui/use-route-loading"
import { cleanup, mount, type Mounted } from "../../helpers/dom"

function Harness() {
  useRouteLoading()
  return (
    <div>
      <a href="/rankings" id="internal">Rankings</a>
      <a href="/videos" id="same">Videos</a>
      <a href="https://example.com/x" id="external">Out</a>
      <a href="/rankings" target="_blank" id="blank">New tab</a>
      <span id="plain">text</span>
      <RouteProgressBar />
    </div>
  )
}

const pending = () => useRouteProgressStore.getState().pending
const bar = () => document.querySelector<HTMLElement>("[data-route-progress]")!
const clickOn = (id: string, init: MouseEventInit = {}) =>
  act(() => {
    document.getElementById(id)!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }))
  })
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

let view: Mounted

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame"] })
  nav.pathname = "/videos"
  window.history.replaceState(null, "", "/videos")
  view = mount(<Harness />)
})

// Swallow the navigations jsdom cannot perform.
document.addEventListener("click", (e) => e.preventDefault())

afterEach(async () => {
  // Let any transition left pending time out so the module state is clean.
  await advance(ROUTE_LOADING_TIMEOUT_MS + ROUTE_PROGRESS_FINISH_MS * 3)
  cleanup()
  vi.useRealTimers()
})

describe("useRouteLoading", () => {
  it("arms on an in-app link to another page and settles after the new route paints", async () => {
    await clickOn("internal")
    expect(pending()).toBe(true)

    nav.pathname = "/rankings"
    view.rerender(<Harness />)
    expect(pending()).toBe(true)
    await advance(50)
    expect(pending()).toBe(false)
  })

  it("ignores links to the same page, other origins, new tabs, modified clicks and non-links", async () => {
    await clickOn("same")
    await clickOn("external")
    await clickOn("blank")
    await clickOn("internal", { metaKey: true })
    await clickOn("internal", { button: 1 })
    await clickOn("plain")
    expect(pending()).toBe(false)
  })

  it("arms on back/forward to another page only", async () => {
    await act(() => window.dispatchEvent(new PopStateEvent("popstate")))
    expect(pending()).toBe(false)
    window.history.replaceState(null, "", "/rankings")
    await act(() => window.dispatchEvent(new PopStateEvent("popstate")))
    expect(pending()).toBe(true)
  })

  it("drops a bar restored from the back/forward cache", async () => {
    startRouteLoading()
    expect(pending()).toBe(true)
    const restored = Object.assign(new Event("pageshow"), { persisted: false })
    await act(() => window.dispatchEvent(restored))
    expect(pending()).toBe(true)
    await act(() => window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true })))
    expect(pending()).toBe(false)
  })

  it("gives up on a transition that never lands", async () => {
    await clickOn("internal")
    await advance(ROUTE_LOADING_TIMEOUT_MS - 1)
    expect(pending()).toBe(true)
    startRouteLoading()
    await advance(ROUTE_LOADING_TIMEOUT_MS - 1)
    expect(pending()).toBe(true)
    await advance(1)
    expect(pending()).toBe(false)
  })

  it("stops listening once unmounted", async () => {
    view.unmount()
    document.body.innerHTML = '<a href="/rankings" id="late">late</a>'
    await clickOn("late")
    expect(pending()).toBe(false)
  })
})

describe("RouteProgressBar", () => {
  it("stays hidden for a transition that ends inside the show delay", async () => {
    await act(() => startRouteLoading())
    // Two animation frames to settle still land inside the delay.
    await advance(ROUTE_PROGRESS_SHOW_DELAY_MS / 3)
    expect(bar().className).toContain("opacity-0")
    nav.pathname = "/rankings"
    view.rerender(<Harness />)
    // Settle first (two frames), in its own act so React commits the change
    // before the show timer would have fired.
    await advance(40)
    expect(pending()).toBe(false)
    await advance(ROUTE_PROGRESS_SHOW_DELAY_MS)
    expect(bar().className).toContain("opacity-0")
    expect(bar().style.width).toBe("0%")
  })

  it("appears past the delay, trickles, then fills and fades out", async () => {
    await act(() => startRouteLoading())
    await advance(ROUTE_PROGRESS_SHOW_DELAY_MS)
    expect(bar().className).toContain("opacity-100")
    expect(bar().style.width).toBe(`${ROUTE_PROGRESS_START}%`)
    await advance(ROUTE_PROGRESS_TRICKLE_MS * 3)
    const trickled = parseFloat(bar().style.width)
    expect(trickled).toBeGreaterThan(ROUTE_PROGRESS_START)
    expect(trickled).toBeLessThan(100)

    nav.pathname = "/rankings"
    view.rerender(<Harness />)
    await advance(50)
    expect(bar().style.width).toBe("100%")
    await advance(ROUTE_PROGRESS_FINISH_MS)
    expect(bar().className).toContain("opacity-0")
    await advance(ROUTE_PROGRESS_FINISH_MS)
    expect(bar().style.width).toBe("0%")
  })
})
