// @vitest-environment jsdom
/**
 * Citation hover cards in the Synergy Slayer reading mode
 * (`packages/debate-help-docs/components/guides/citation-card.tsx`): the link
 * carries its entry as data attributes, and `CitationCardsIn` turns links in
 * loaded page HTML back into hover cards with the read-aloud button.
 */
import { act, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  CitationCard,
  CitationCardsIn,
} from "../../../../packages/debate-help-docs/components/guides/citation-card"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const PROPS = {
  href: "/docs/papers/x/references#ref-smith-2019",
  number: "7",
  citation: "Smith, Jane. 2019. <em>Book</em>.",
  card: '<div class="debate-card"><p><em>Qual</em></p><hr /><p><u>Read me</u></p></div>',
  spoken: "Smith 19",
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("citation cards in reading mode", () => {
  it("keeps the entry on the link in the page HTML", () => {
    const html = renderToStaticMarkup(<CitationCard {...PROPS}>Smith (2019)</CitationCard>)
    expect(html).toContain('data-citation-spoken="Smith 19"')
    expect(html).toContain('data-citation-number="7"')
    expect(html).toContain("data-citation-card=")
  })

  it("turns links in loaded HTML back into hover cards", async () => {
    const pageHtml = `<p>As ${renderToStaticMarkup(<CitationCard {...PROPS}>Smith (2019)</CitationCard>)} argues.</p>`
    function Reader() {
      const ref = useRef<HTMLDivElement | null>(null)
      return (
        <div ref={ref} id="reader">
          <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
          <CitationCardsIn root={ref} version={pageHtml} />
        </div>
      )
    }
    await act(async () => root.render(<Reader />))
    const hosts = container.querySelectorAll(".citation-card-host")
    expect(hosts).toHaveLength(1)
    const link = hosts[0]!.querySelector("a.citation-link")!
    expect(link.textContent).toBe("Smith (2019)")
    // Radix's trigger wires the hover card onto the rebuilt link.
    expect(link.getAttribute("data-state")).toBe("closed")
    expect(container.textContent).toBe("As Smith (2019) argues.")
  })
})
