import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))
vi.mock("@debate/research-evidence", () => ({
  SearchInterface: () => <div data-testid="search-interface" />,
}))

import SearchPage from "../../../src/routes/cards/page"

describe("CARDS search page", () => {
  it("shows the sync badge for the evidence library above the workspace", () => {
    const html = renderToStaticMarkup(<SearchPage />)
    expect(html).toContain('data-href="/research/cards"')
    expect(html.indexOf("sync-badge")).toBeLessThan(html.indexOf("search-interface"))
  })

  it("still renders the search workspace", () => {
    expect(renderToStaticMarkup(<SearchPage />)).toContain("search-interface")
  })
})
