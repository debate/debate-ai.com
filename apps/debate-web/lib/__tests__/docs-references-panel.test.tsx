// @vitest-environment jsdom
/**
 * The Synergy Slayer References side panel
 * (`packages/debate-help-docs/components/guides/references-panel.tsx` and
 * `references-panel-items.ts`): every cited source in first-citation order,
 * jumping to each place it is cited, Collapse all, and what Read all reads.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CitationCard } from "../../../../packages/debate-help-docs/components/guides/citation-card"
import {
  collectReferenceItems,
  readAllCards,
} from "../../../../packages/debate-help-docs/components/guides/references-panel-items"
import { ReferencesPanelButton } from "../../../../packages/debate-help-docs/components/guides/references-panel"
import {
  DEFAULT_PANEL_WIDTH,
  DOCKED_ATTRIBUTE,
  KEY_STEP,
  KEY_STEP_LARGE,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  WIDTH_STORAGE_KEY,
  WIDTH_VARIABLE,
  clampPanelWidth,
  dockPanel,
  maxPanelWidth,
  readStoredWidth,
  widthForKey,
} from "../../../../packages/debate-help-docs/components/guides/references-panel-dock"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SMITH = {
  href: "/docs/journal/x/references#ref-smith-2019",
  number: "7",
  citation: "Smith, Jane. <em>Book</em>. 2019.",
  card: '<div class="debate-card"><p>Smith says X.</p><p><em>Jane Smith is a Professor of History, Harvard</em></p><hr /><p><u>Smith card</u></p></div>',
  spoken: "Smith 19",
  authors: "Smith",
  year: "2019",
}
const JONES = {
  href: "/docs/journal/x/references#ref-jones-2001",
  number: "3",
  citation: "Jones, Al. <em>Other</em>. 2001.",
  card: '<div class="debate-card"><p><u>Jones card</u></p></div>',
  spoken: "Jones 01",
  authors: "Jones",
  year: "2001",
}

const cite = (props: typeof SMITH, label: string) => renderToStaticMarkup(<CitationCard {...props}>{label}</CitationCard>)

const PAGE =
  `<p>First ${cite(JONES, "Jones (2001)")} and ${cite(SMITH, "Smith (2019)")} agree.</p>` +
  `<figure><img alt="" /></figure>` +
  `<p>Later, ${cite(SMITH, "Smith (2019)")} again.</p>` +
  `<div class="citation-tooltip">${cite(JONES, "Jones (2001)")}</div>`

let container: HTMLDivElement
let root: Root
let host: HTMLDivElement

const originalWidth = window.innerWidth
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width })
}

beforeEach(() => {
  localStorage.clear()
  setWindowWidth(1440)
  container = document.createElement("div")
  container.className = "synergy-slayer-doc"
  container.innerHTML = PAGE
  document.body.appendChild(container)
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  host.remove()
  setWindowWidth(originalWidth)
  localStorage.clear()
})

describe("collectReferenceItems", () => {
  it("lists each source once, in first-citation order, with every place it is cited", () => {
    const items = collectReferenceItems(container)
    expect(items.map((item) => item.spoken)).toEqual(["Jones 01", "Smith 19"])
    expect(items[0]!.links).toHaveLength(1) // the tooltip copy is not page text
    expect(items[1]!.links).toHaveLength(2)
    expect(items[1]!.number).toBe("7")
    expect(items[1]!.label).toBe("Smith (2019)")
    expect(items[1]!.paragraph?.textContent).toContain("First")
  })

  it("reads each introducing paragraph once, before its first card", () => {
    const reading = readAllCards(collectReferenceItems(container))
    expect(reading[0]!.intro).toBe("First Jones (2001) and Smith (2019) agree.")
    expect(reading[1]!.intro).toBeUndefined()
    expect(reading[1]!.spoken).toBe("Smith 19")
    expect(reading[1]!.card).toContain("Smith card")
  })
})

describe("ReferencesPanelButton", () => {
  it("opens a panel of the cards, jumps to each citation in turn, and collapses all", async () => {
    await act(async () => root.render(<ReferencesPanelButton />))
    const button = () => document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
    expect(button().textContent).toContain("References")
    await act(async () => button().click())

    const panel = document.querySelector("[data-references-panel]")!
    expect(panel.textContent).toContain("References · 2")
    const entries = panel.querySelectorAll("li[data-reference-index]")
    expect(entries).toHaveLength(2)
    expect(entries[0]!.textContent).toContain("Jones ’01")
    expect(entries[1]!.textContent).toContain("Smith card")
    // Summary first, then authors ’yy — qualifications without the name, then the citation.
    expect(entries[1]!.textContent).toContain("Smith says X.Smith ’19 — Professor of History, Harvard. Smith, Jane.")
    expect(entries[1]!.textContent).not.toContain("Jane Smith is a")
    expect(entries[1]!.querySelector('[data-flag="professor"]')).not.toBeNull()
    expect(entries[1]!.querySelector('[data-flag="source-book"]')).not.toBeNull()
    expect(entries[0]!.querySelector('[data-flag="professor"]')).toBeNull()
    expect(panel.querySelector(".references-panel-intro")).toBeNull()
    expect(panel.getAttribute("style")).toContain("width: 336px")
    expect(entries[1]!.textContent).toContain("Cited at")

    // Clicking Smith twice goes to its first, then its second citation.
    const smithLinks = collectReferenceItems(container)[1]!.links
    // The entry's own button, not the Reading mode / Copy / Favorite row above it.
    const head = entries[1]!.querySelector<HTMLButtonElement>('button[title^="Show where it is cited"]')!
    await act(async () => head.click())
    expect(smithLinks[0]!.classList.contains("citation-link-flash")).toBe(true)
    await act(async () => head.click())
    expect(smithLinks[1]!.classList.contains("citation-link-flash")).toBe(true)

    const collapse = Array.from(panel.querySelectorAll("button")).find((b) => b.textContent === "Collapse all")!
    await act(async () => collapse.click())
    expect(panel.textContent).not.toContain("Smith card")
    expect(panel.textContent).toContain("Expand all")

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })))
    expect(document.querySelector("[data-references-panel]")).toBeNull()
  })
})

describe("docked References panel", () => {
  const html = document.documentElement
  const open = async () => {
    await act(async () => root.render(<ReferencesPanelButton />))
    const button = document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
    await act(async () => button.click())
    return button
  }
  const panel = () => document.querySelector<HTMLElement>("[data-references-panel]")!
  const handle = () => document.querySelector<HTMLElement>('[role="separator"]')!
  const key = async (name: string, init: KeyboardEventInit = {}) =>
    act(async () => {
      handle().dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init }))
    })
  const pointer = async (type: string, clientX: number) =>
    act(async () => {
      handle().dispatchEvent(new MouseEvent(type, { clientX, button: 0, bubbles: true, cancelable: true }))
    })

  it("docks beside the page on a wide window: no drawer, the page gets room and the outline is hidden", async () => {
    await open()
    expect(panel().getAttribute("data-docked")).toBe("")
    expect(panel().className).not.toContain("shadow-2xl")
    expect(html.hasAttribute(DOCKED_ATTRIBUTE)).toBe(true)
    expect(html.style.getPropertyValue(WIDTH_VARIABLE)).toBe(`${DEFAULT_PANEL_WIDTH}px`)
    expect(handle().getAttribute("aria-valuenow")).toBe(String(DEFAULT_PANEL_WIDTH))
  })

  it("undocks when closed, by Escape (focus returns to the button) or by the close button", async () => {
    const button = await open()
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })))
    expect(document.querySelector("[data-references-panel]")).toBeNull()
    expect(html.hasAttribute(DOCKED_ATTRIBUTE)).toBe(false)
    expect(html.style.getPropertyValue(WIDTH_VARIABLE)).toBe("")
    expect(document.activeElement).toBe(button)

    await act(async () => button.click())
    expect(html.hasAttribute(DOCKED_ATTRIBUTE)).toBe(true)
    await act(async () => panel().querySelector<HTMLButtonElement>('button[aria-label^="Close"]')!.click())
    expect(html.hasAttribute(DOCKED_ATTRIBUTE)).toBe(false)
  })

  it("stays a drawer over the page on a narrow window, with no handle and no room made", async () => {
    setWindowWidth(700)
    await open()
    expect(panel().getAttribute("data-docked")).toBeNull()
    expect(panel().className).toContain("shadow-2xl")
    expect(handle()).toBeNull()
    expect(html.hasAttribute(DOCKED_ATTRIBUTE)).toBe(false)
  })

  it("resizes by dragging the handle, clamped, and remembers the width", async () => {
    await open()
    await pointer("pointerdown", 1440 - DEFAULT_PANEL_WIDTH)
    expect(html.hasAttribute("data-references-resizing")).toBe(true)
    await pointer("pointermove", 1440 - 500)
    expect(panel().style.width).toBe("500px")
    expect(html.style.getPropertyValue(WIDTH_VARIABLE)).toBe("500px")
    await pointer("pointermove", 1440 - 5000)
    expect(panel().style.width).toBe(`${maxPanelWidth(1440)}px`)
    await pointer("pointermove", 1440 - 10)
    expect(panel().style.width).toBe(`${MIN_PANEL_WIDTH}px`)
    await pointer("pointermove", 1440 - 450)
    await pointer("pointerup", 1440 - 450)
    expect(html.hasAttribute("data-references-resizing")).toBe(false)
    expect(localStorage.getItem(WIDTH_STORAGE_KEY)).toBe("450")
    // Moving after the drag ended does nothing.
    await pointer("pointermove", 1440 - 300)
    expect(panel().style.width).toBe("450px")
  })

  it("opens at the remembered width", async () => {
    localStorage.setItem(WIDTH_STORAGE_KEY, "520")
    await open()
    expect(panel().style.width).toBe("520px")
    expect(html.style.getPropertyValue(WIDTH_VARIABLE)).toBe("520px")
  })

  it("resizes from the keyboard and resets", async () => {
    await open()
    expect(handle().tabIndex).toBe(0)
    await key("ArrowLeft")
    expect(panel().style.width).toBe(`${DEFAULT_PANEL_WIDTH + KEY_STEP}px`)
    await key("ArrowLeft", { shiftKey: true })
    expect(panel().style.width).toBe(`${DEFAULT_PANEL_WIDTH + KEY_STEP + KEY_STEP_LARGE}px`)
    await key("ArrowRight")
    expect(panel().style.width).toBe(`${DEFAULT_PANEL_WIDTH + KEY_STEP_LARGE}px`)
    expect(localStorage.getItem(WIDTH_STORAGE_KEY)).toBe(String(DEFAULT_PANEL_WIDTH + KEY_STEP_LARGE))
    await key("End")
    expect(panel().style.width).toBe(`${maxPanelWidth(1440)}px`)
    await key("Home")
    expect(panel().style.width).toBe(`${MIN_PANEL_WIDTH}px`)
    await key("Enter")
    expect(panel().style.width).toBe(`${DEFAULT_PANEL_WIDTH}px`)
    expect(localStorage.getItem(WIDTH_STORAGE_KEY)).toBe(String(DEFAULT_PANEL_WIDTH))
  })

  it("follows the window when it shrinks, without forgetting the saved width", async () => {
    localStorage.setItem(WIDTH_STORAGE_KEY, "700")
    await open()
    expect(panel().style.width).toBe("700px")
    setWindowWidth(1100)
    await act(async () => window.dispatchEvent(new Event("resize")))
    expect(panel().style.width).toBe(`${maxPanelWidth(1100)}px`)
    expect(localStorage.getItem(WIDTH_STORAGE_KEY)).toBe("700")
  })

  it("keeps the page docked until the last of two open panels closes", () => {
    const first = dockPanel(300)
    const second = dockPanel(300)
    first()
    first()
    expect(document.documentElement.hasAttribute(DOCKED_ATTRIBUTE)).toBe(true)
    second()
    expect(document.documentElement.hasAttribute(DOCKED_ATTRIBUTE)).toBe(false)
  })
})

describe("references panel width limits", () => {
  it("clamps between the minimum and 60% of the window (at most the maximum)", () => {
    expect(clampPanelWidth(10, 1440)).toBe(MIN_PANEL_WIDTH)
    expect(clampPanelWidth(5000, 1440)).toBe(MAX_PANEL_WIDTH)
    expect(clampPanelWidth(5000, 1100)).toBe(660)
    expect(clampPanelWidth(Number.NaN, 1440)).toBe(DEFAULT_PANEL_WIDTH)
    expect(maxPanelWidth(300)).toBe(MIN_PANEL_WIDTH)
  })

  it("defaults to 25% narrower than the original 28rem, and ignores a bad stored value", () => {
    expect(DEFAULT_PANEL_WIDTH).toBe(28 * 16 * 0.75)
    expect(readStoredWidth()).toBe(DEFAULT_PANEL_WIDTH)
    localStorage.setItem(WIDTH_STORAGE_KEY, "wide")
    expect(readStoredWidth()).toBe(DEFAULT_PANEL_WIDTH)
  })

  it("maps keys to widths and ignores the rest", () => {
    expect(widthForKey("ArrowLeft", false, 300, 1440)).toBe(300 + KEY_STEP)
    expect(widthForKey("ArrowRight", true, 400, 1440)).toBe(400 - KEY_STEP_LARGE)
    expect(widthForKey("a", false, 300, 1440)).toBeNull()
  })
})
