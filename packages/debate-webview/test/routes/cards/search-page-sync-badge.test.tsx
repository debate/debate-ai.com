import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))
vi.mock("@debate/research-evidence", () => ({
  SearchInterface: () => <div data-testid="search-interface" />,
}))

import SearchPage from "../../../src/routes/cards/page"

describe("/research/cards search page", () => {
  it("mounts the sync badge for the shared-cards collections above the workspace", () => {
    const html = renderToStaticMarkup(<SearchPage />)
    expect(html).toContain('data-href="/research/cards"')
    expect(html.indexOf("data-cards-sync-strip")).toBeLessThan(html.indexOf("search-interface"))
  })
})
