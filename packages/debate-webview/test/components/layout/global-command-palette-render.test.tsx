/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/tools",
}))

import { GlobalCommandPalette, openGlobalCommandPalette } from "../../../src/components/layout/GlobalCommandPalette"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeAll(() => {
  // jsdom lacks the layout APIs cmdk and Radix reach for.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView ??= () => {}
})

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  localStorage.setItem("favorite-tools", JSON.stringify(["/research"]))
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<GlobalCommandPalette />))
  act(() => openGlobalCommandPalette())
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ""
  localStorage.clear()
  push.mockReset()
})

function type(text: string) {
  const input = document.querySelector<HTMLInputElement>("[cmdk-input]")!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  act(() => {
    setValue.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

const headings = () => [...document.querySelectorAll("[cmdk-group-heading]")].map((h) => h.textContent)
const rows = () => [...document.querySelectorAll("[cmdk-item]")]

describe("GlobalCommandPalette", () => {
  it("shows Favorites in the empty-query browse view", () => {
    expect(headings()).toContain("Favorites")
    expect(headings()).toContain("Go to")
  })

  it("switches to one ranked, highlighted list once something is typed", () => {
    type("reserch")
    expect(headings()).not.toContain("Favorites")
    expect(headings()[0]).toMatch(/results?$/)
    const first = rows()[0]
    expect(first.textContent).toContain("Research Workspace")
    expect(first.querySelector("mark")?.textContent).toBe("Research")
    // The starred tool is listed once, as an ordinary result.
    expect(rows().filter((r) => r.textContent?.includes("Research Workspace"))).toHaveLength(1)
    expect(first.getAttribute("data-selected")).toBe("true")
  })

  it("shows an empty state for a query with no hits", () => {
    type("zzzqx")
    expect(rows()).toHaveLength(0)
    expect(document.body.textContent).toContain("No results for")
  })

  it("navigates to the chosen result", () => {
    type("reserch")
    act(() => (rows()[0] as HTMLElement).click())
    expect(push).toHaveBeenCalledWith("/research")
  })
})
