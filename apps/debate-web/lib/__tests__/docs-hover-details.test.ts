// @vitest-environment jsdom
/**
 * @fileoverview Pins hover-to-expand on the References pages
 * (`packages/debate-help-docs/lib/hover-details.ts`): pointing at an entry
 * opens it, leaving closes it, and entries opened any other way stay open.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  attachHoverExpand,
  clearHoverOpened,
  HOVER_OPEN_DELAY_MS,
  isHoverOpened,
} from "../../../../packages/debate-help-docs/lib/hover-details"

let detach: () => void

function entries() {
  return Array.from(document.querySelectorAll("details"))
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = `
    <ol>
      <li><details><summary>Albert</summary><div>card one</div></details></li>
      <li><details><summary>Alinsky</summary><div>card two</div></details></li>
    </ol>
    <details id="other"><summary>Not a reference</summary></details>`
  detach = attachHoverExpand(document)
})

afterEach(() => {
  detach()
  vi.useRealTimers()
})

function hover(el: Element) {
  el.dispatchEvent(new MouseEvent("mouseenter"))
}
function unhover(el: Element) {
  el.dispatchEvent(new MouseEvent("mouseleave"))
}

describe("attachHoverExpand", () => {
  it("opens an entry after the hover delay and closes it on leave", () => {
    const [first] = entries()
    hover(first)
    expect(first.open).toBe(false)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    expect(first.open).toBe(true)
    expect(isHoverOpened(first)).toBe(true)
    unhover(first)
    expect(first.open).toBe(false)
  })

  it("does not open an entry the pointer only passed over", () => {
    const [first] = entries()
    hover(first)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS - 50)
    unhover(first)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    expect(first.open).toBe(false)
  })

  it("leaves entries that were already open alone", () => {
    const [first] = entries()
    first.open = true
    hover(first)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    unhover(first)
    expect(first.open).toBe(true)
  })

  it("pins a hover-opened entry open when its summary is clicked", () => {
    const [first] = entries()
    hover(first)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    const click = new MouseEvent("click", { bubbles: true, cancelable: true })
    first.querySelector("summary")!.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    unhover(first)
    expect(first.open).toBe(true)
  })

  it("keeps entries open after Expand all clears hover state", () => {
    const [first] = entries()
    hover(first)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    clearHoverOpened(document)
    unhover(first)
    expect(first.open).toBe(true)
  })

  it("ignores details outside a list", () => {
    const other = document.getElementById("other") as HTMLDetailsElement
    hover(other)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    expect(other.open).toBe(false)
  })

  it("stops reacting after cleanup", () => {
    const [first] = entries()
    detach()
    hover(first)
    vi.advanceTimersByTime(HOVER_OPEN_DELAY_MS)
    expect(first.open).toBe(false)
  })
})
