import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("../../../src/routes/doc/ResearchAgentEmbed", () => ({
  default: () => <div data-testid="embed" />,
}))

import { WorkspaceScreen } from "../../../src/routes/doc/WorkspaceScreen"

describe("WorkspaceScreen", () => {
  it("mounts the research workspace with no floating account-save badge", () => {
    const html = renderToStaticMarkup(<WorkspaceScreen />)
    expect(html).toContain('data-testid="embed"')
    expect(html).not.toContain("data-doc-sync-actions")
  })
})
