import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import ResearchAgentEmbed from "../../../src/routes/doc/ResearchAgentEmbed"
import { WorkspaceLoading } from "../../../src/routes/doc/WorkspaceLoading"

describe("WorkspaceLoading", () => {
  it("draws the orbital sphere with a progress bar", () => {
    const html = renderToStaticMarkup(<WorkspaceLoading loaded={1} total={2} />)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="50"')
    expect(html).toContain("orbitalSpin")
  })

  it("never claims 100% before the workspace has mounted", () => {
    const html = renderToStaticMarkup(<WorkspaceLoading loaded={3} total={3} />)
    expect(html).toContain('aria-valuenow="99"')
  })
})

describe("ResearchAgentEmbed", () => {
  it("renders the loader, not an empty page, before the workspace loads", () => {
    const html = renderToStaticMarkup(<ResearchAgentEmbed />)
    expect(html).toContain('data-testid="research-workspace-loading"')
    expect(html).not.toContain("<iframe")
  })
})
