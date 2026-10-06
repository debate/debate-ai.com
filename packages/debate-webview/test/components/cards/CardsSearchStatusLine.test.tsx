import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))

import { CardsSearchStatusLine } from "../../../src/components/cards/CardsSearchStatusLine"
import { resolveToolSyncKeys } from "../../../src/lib/tools/tool-sync-status"

describe("CardsSearchStatusLine", () => {
  it("mounts the sync badge for the /research/cards collections", () => {
    expect(renderToStaticMarkup(<CardsSearchStatusLine />)).toContain('data-href="/research/cards"')
  })

  it("watches at least one synced collection, so the badge is not blank", () => {
    expect(resolveToolSyncKeys("/research/cards")).toContain("evidenceLibraryEntries")
  })
})
