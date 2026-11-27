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

beforeEach(() => {
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
    expect(panel.className).toContain("21rem")
    expect(entries[1]!.textContent).toContain("Cited at")

    // Clicking Smith twice goes to its first, then its second citation.
    const smithLinks = collectReferenceItems(container)[1]!.links
    const head = entries[1]!.querySelector("button")!
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
