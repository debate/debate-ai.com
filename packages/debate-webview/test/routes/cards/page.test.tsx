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

  it("opens the docs panels as a column inside the page, beside the search", () => {
    const html = renderToStaticMarkup(<SearchPage />)
    expect(html).toContain('data-testid="cards-docs-panel"')
    expect(html.indexOf("docs-panels")).toBeLessThan(html.indexOf("search-interface"))
  })
})
