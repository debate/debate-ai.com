// @vitest-environment jsdom
/**
 * The docs toolbar's Zoom level button
 * (`packages/debate-help-docs/components/guides/zoom-button.tsx` and
 * `lib/docs-zoom.ts`): click / Ctrl-click / Shift-click, the Ctrl/Cmd +, -, 0
 * shortcuts, limits, persistence and the tooltip.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { DocsZoomButton } from "../../../../packages/debate-help-docs/components/guides/zoom-button"
import {
  DOCS_ZOOM_INIT_SCRIPT,
  ZOOM_STORAGE_KEY,
  ZOOM_TOOLTIP,
  ZOOM_VARIABLE,
  normalizeZoom,
  zoomIn,
  zoomOut,
} from "../../../../packages/debate-help-docs/lib/docs-zoom"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("zoom levels", () => {
  it("steps between 50% and 200% and stops at the limits", () => {
    expect(zoomIn(100)).toBe(110)
    expect(zoomOut(100)).toBe(90)
    expect(zoomIn(200)).toBe(200)
    expect(zoomOut(50)).toBe(50)
    expect(zoomIn(120)).toBe(125)
    expect(normalizeZoom("nonsense")).toBe(100)
    expect(normalizeZoom(999)).toBe(200)
    expect(normalizeZoom(1)).toBe(50)
  })
})

describe("DocsZoomButton", () => {
  let host: HTMLDivElement
  let root: Root
  const html = document.documentElement
  const button = () => host.querySelector("button")!
  const click = (init: MouseEventInit = {}) =>
    act(() => {
      button().dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }))
    })
  const key = (init: KeyboardEventInit, target: EventTarget = document.body) => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
    act(() => {
      target.dispatchEvent(event)
    })
    return event
  }
  const level = () => html.style.getPropertyValue(ZOOM_VARIABLE)

  beforeEach(() => {
    localStorage.clear()
    html.style.removeProperty(ZOOM_VARIABLE)
    host = document.createElement("div")
    document.body.append(host)
    root = createRoot(host)
    act(() => root.render(<DocsZoomButton />))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("shows 100% and explains every shortcut in its tooltip", () => {
    expect(button().textContent).toBe("100%")
    const tip = button().getAttribute("title")!
    expect(tip).toBe(ZOOM_TOOLTIP)
    for (const part of ["Click", "Ctrl/Cmd + click", "Shift + click", "Ctrl/Cmd + +", "Ctrl/Cmd + -", "Ctrl/Cmd + 0"]) {
      expect(tip).toContain(part)
    }
  })

  it("zooms in on click, out on Ctrl/Cmd+click, and resets on Shift+click", () => {
    click()
    expect(button().textContent).toBe("110%")
    expect(level()).toBe("1.1")
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBe("110")
    click({ ctrlKey: true })
    click({ metaKey: true })
    expect(button().textContent).toBe("90%")
    click({ shiftKey: true })
    expect(button().textContent).toBe("100%")
    expect(level()).toBe("1")
    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBeNull()
  })

  it("follows Ctrl/Cmd with +, =, -, and 0, replacing the browser's zoom", () => {
    expect(key({ key: "+", ctrlKey: true }).defaultPrevented).toBe(true)
    expect(button().textContent).toBe("110%")
    key({ key: "=", metaKey: true })
    expect(button().textContent).toBe("125%")
    key({ key: "-", ctrlKey: true })
    expect(button().textContent).toBe("110%")
    key({ key: "0", ctrlKey: true })
    expect(button().textContent).toBe("100%")
  })

  it("ignores keys without Ctrl/Cmd and keys typed in fields", () => {
    expect(key({ key: "+" }).defaultPrevented).toBe(false)
    const input = document.createElement("input")
    document.body.append(input)
    expect(key({ key: "+", ctrlKey: true }, input).defaultPrevented).toBe(false)
    input.remove()
    expect(button().textContent).toBe("100%")
  })

  it("clamps at 50% and 200%", () => {
    for (let i = 0; i < 20; i++) key({ key: "+", ctrlKey: true })
    expect(button().textContent).toBe("200%")
    for (let i = 0; i < 20; i++) key({ key: "-", ctrlKey: true })
    expect(button().textContent).toBe("50%")
  })

  it("restores the stored level on mount and before paint", () => {
    act(() => root.unmount())
    localStorage.setItem(ZOOM_STORAGE_KEY, "150")
    html.style.removeProperty(ZOOM_VARIABLE)
    new Function(DOCS_ZOOM_INIT_SCRIPT)()
    expect(level()).toBe("1.5")
    root = createRoot(host)
    act(() => root.render(<DocsZoomButton />))
    expect(button().textContent).toBe("150%")
  })
})
