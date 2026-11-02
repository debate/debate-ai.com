import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("@debate-ai/reason-docs/docs/ReasonDocsSidebarPanels", () => ({
  ReasonDocsSidebarPanels: () => <div data-testid="docs-panels" />,
}))
vi.mock("@debate-ai/research-evidence", () => ({
  SearchInterface: () => <div data-testid="search-interface" />,
}))

import SearchPage from "../../../src/routes/cards/page"

describe("CARDS search page", () => {
  it("renders the search workspace with no account-save strip above it", () => {
    const html = renderToStaticMarkup(<SearchPage />)
    expect(html).toContain("search-interface")
    expect(html).not.toContain("cards-sync-strip")
    expect(html).not.toContain("Save now")
  })

  it("draws no second docs column inside the page — the app sidebar holds the panels", () => {
    const html = renderToStaticMarkup(<SearchPage />)
    expect(html).not.toContain("cards-docs-panel")
    expect(html).not.toContain("docs-panels")
  })
})
