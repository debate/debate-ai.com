import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}))
vi.mock("../../../src/routes/doc/ResearchAgentEmbed", () => ({
  default: () => <div data-testid="embed" />,
}))

import { WorkspaceScreen } from "../../../src/routes/doc/WorkspaceScreen"

describe("WorkspaceScreen", () => {
  it("mounts the research workspace with the sync badge for the /research/docs collections", () => {
    const html = renderToStaticMarkup(<WorkspaceScreen />)
    expect(html).toContain('data-testid="embed"')
    expect(html).toContain('data-href="/research/docs"')
  })
})
