/**
 * @vitest-environment jsdom
 */
import { act } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mount } from "../../helpers/dom"

vi.mock("@debate-ai/qwksearch/components/base-url", () => ({}))
vi.mock("@debate-ai/qwksearch/components/Providers", () => ({
  QwksearchProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@debate-ai/qwksearch/components/Workspace", () => ({
  QwksearchWorkspace: () => <div data-testid="workspace" />,
}))
vi.mock("../../../src/components/qwksearch/SidebarWithAppDock", () => ({
  SidebarWithAppDock: () => null,
}))

import ResearchAgentEmbed from "../../../src/routes/doc/ResearchAgentEmbed"
import { WorkspaceLoading } from "../../../src/routes/doc/WorkspaceLoading"

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("ResearchAgentEmbed in the browser", () => {
  it("shows the loader, then mounts the workspace components directly", async () => {
    const view = mount(<ResearchAgentEmbed />)
    expect(view.container.querySelector('[data-testid="research-workspace-loading"]')).not.toBeNull()
    await vi.waitFor(() => {
      expect(view.container.querySelector('[data-testid="workspace"]')).not.toBeNull()
    })
    expect(view.container.querySelector("iframe")).toBeNull()
    expect(view.container.querySelector('[data-testid="research-workspace-loading"]')).toBeNull()
  })
})

describe("WorkspaceLoading progress", () => {
  it("creeps forward between steps but stays under 100%", () => {
    vi.useFakeTimers()
    const view = mount(<WorkspaceLoading loaded={0} total={3} />)
    const bar = () => Number(view.container.querySelector('[role="progressbar"]')!.getAttribute("aria-valuenow"))
    expect(bar()).toBe(0)
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    const early = bar()
    expect(early).toBeGreaterThan(0)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(bar()).toBeGreaterThan(early)
    expect(bar()).toBeLessThan(100)
    view.unmount()
  })
})
