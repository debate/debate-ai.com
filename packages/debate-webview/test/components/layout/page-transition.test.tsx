/** @vitest-environment jsdom */
/**
 * @fileoverview Pins the page transition's promise: it never delays a page,
 * and the orbital loader shows only once a navigation has taken over a second.
 */

import { act } from "react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, installDomShims, mount } from "../../helpers/dom"

const nav = vi.hoisted(() => ({ pathname: "/videos" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))

import { PageTransition } from "../../../src/components/layout/PageTransition"

beforeAll(installDomShims)
beforeEach(() => {
  vi.useFakeTimers()
  nav.pathname = "/videos"
  window.history.replaceState(null, "", "/videos")
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function clickLink(container: HTMLElement) {
  const a = container.querySelector("a")!
  act(() => {
    a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
  })
}

const loader = () => document.querySelector('[data-testid="page-transition-loader"]')

describe("PageTransition", () => {
  it("renders the page as-is, with no wrapping box", () => {
    const { container } = mount(
      <PageTransition>
        <p>page</p>
      </PageTransition>,
    )
    const wrapper = container.querySelector<HTMLElement>("[data-page-transition]")!
    expect(wrapper.style.display).toBe("contents")
    expect(wrapper.textContent).toBe("page")
    expect(loader()).toBeNull()
  })

  it("shows the orbital loader only after a navigation has taken over a second", () => {
    const { container } = mount(
      <PageTransition>
        <a href="/practice" onClick={(e) => e.preventDefault()}>go</a>
      </PageTransition>,
    )
    clickLink(container)
    act(() => vi.advanceTimersByTime(900))
    expect(loader()).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(loader()).not.toBeNull()
  })

  it("never shows the loader when the page arrives within a second, and hides it on arrival", () => {
    const view = mount(
      <PageTransition>
        <a href="/practice" onClick={(e) => e.preventDefault()}>go</a>
      </PageTransition>,
    )
    clickLink(view.container)
    act(() => vi.advanceTimersByTime(300))
    nav.pathname = "/practice"
    view.rerender(
      <PageTransition>
        <p>practice</p>
      </PageTransition>,
    )
    act(() => vi.advanceTimersByTime(2000))
    expect(loader()).toBeNull()

    // And a slow one clears the moment its page commits.
    view.rerender(
      <PageTransition>
        <a href="/videos" onClick={(e) => e.preventDefault()}>back</a>
      </PageTransition>,
    )
    window.history.replaceState(null, "", "/practice")
    clickLink(view.container)
    act(() => vi.advanceTimersByTime(1100))
    expect(loader()).not.toBeNull()
    nav.pathname = "/videos"
    view.rerender(
      <PageTransition>
        <p>videos</p>
      </PageTransition>,
    )
    expect(loader()).toBeNull()
  })

  it("ignores a click on a link to the current page", () => {
    const { container } = mount(
      <PageTransition>
        <a href="/videos" onClick={(e) => e.preventDefault()}>here</a>
      </PageTransition>,
    )
    clickLink(container)
    act(() => vi.advanceTimersByTime(1500))
    expect(loader()).toBeNull()
  })
})
