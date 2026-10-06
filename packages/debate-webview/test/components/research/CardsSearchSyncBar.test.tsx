import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))

import { CardsSearchSyncBar } from "../../../src/components/research/CardsSearchSyncBar"
import { resolveToolSyncKeys } from "../../../src/lib/tools/tool-sync-status"

describe("CardsSearchSyncBar", () => {
  it("mounts the sync badge for the /research/cards collections", () => {
    const html = renderToStaticMarkup(<CardsSearchSyncBar />)
    expect(html).toContain('data-href="/research/cards"')
    expect(html).toContain("data-cards-sync-bar")
  })

  it("watches at least one catalog collection filed under /research/cards", () => {
    expect(resolveToolSyncKeys("/research/cards")).toContain("evidenceLibraryEntries")
  })
})
