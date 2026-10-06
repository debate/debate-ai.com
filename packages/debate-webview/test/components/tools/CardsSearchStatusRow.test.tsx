import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))

import { CardsSearchStatusRow } from "../../../src/components/tools/CardsSearchStatusRow"

describe("CardsSearchStatusRow", () => {
  it("mounts the sync badge for the /research/cards collections", () => {
    const html = renderToStaticMarkup(<CardsSearchStatusRow />)
    expect(html).toContain('data-href="/research/cards"')
  })

  it("collapses when the badge renders nothing", () => {
    expect(renderToStaticMarkup(<CardsSearchStatusRow />)).toContain("empty:hidden")
  })
})
