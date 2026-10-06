/**
 * @fileoverview The `/doc` workspace has no ToolPageHeader, so it mounts the
 * account-sync badge itself, watching the collections filed under `/research/docs`.
 */

import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { findToolRecordCollection, TOOL_RECORD_COLLECTIONS } from "@debate/data-sync/src/state/toolRecordCollections"

vi.mock("../../src/routes/doc/ResearchAgentEmbed", () => ({
  default: () => createElement("div", { "data-embed": true }),
}))
vi.mock("../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => createElement("span", { "data-badge-href": href }),
}))

const { WorkspaceScreen, DOC_SYNC_HREF } = await import("../../src/routes/doc/WorkspaceScreen")

describe("WorkspaceScreen sync badge", () => {
  it("renders the embedded workspace with the sync badge beside it", () => {
    const html = renderToStaticMarkup(createElement(WorkspaceScreen))
    expect(html).toContain("data-embed")
    expect(html).toContain("data-doc-sync-actions")
    expect(html).toContain(`data-badge-href="${DOC_SYNC_HREF}"`)
  })

  it("points at a route that actually has synced collections", () => {
    const keys = TOOL_RECORD_COLLECTIONS.filter((c) => c.href === DOC_SYNC_HREF).map((c) => c.key)
    expect(keys.length).toBeGreaterThan(0)
    expect(findToolRecordCollection(keys[0]!)?.href).toBe(DOC_SYNC_HREF)
  })
})
