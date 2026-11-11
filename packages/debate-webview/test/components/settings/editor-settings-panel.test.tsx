/** @vitest-environment jsdom */
/**
 * @fileoverview The /settings sidebar: General first (holding My team and My
 * school), Sound & speech, Privacy and MCP server & API, then the editor's tabs under an Editor
 * heading (its own General rows as "Editor prefs"), and the old
 * `?category=my-school` and `?category=general` links.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

let search = ""
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }))
vi.mock("@debate-ai/editor/styles.css", () => ({}))
vi.mock("@debate-ai/editor/settings-section", () => ({
  DebateEditorSettingsSection: ({ category }: { category: string }) => <div data-editor-category={category} />,
}))
vi.mock("@debate-ai/round", () => ({ UserSettingsPanel: () => <div data-testid="account" /> }))
vi.mock("@debate-ai/rankings/leaderboard", () => ({ MyRankedTeamsSettings: () => <div data-testid="my-team" /> }))
vi.mock("@debate-ai/rankings/src/schools/ui/MySchoolSettings", () => ({
  MySchoolSettings: () => <div data-testid="my-school" />,
}))
vi.mock("../../../src/components/settings/ResearchSettingsTab", () => ({ ResearchSettingsTab: () => null }))
for (const name of [
  "TeamCoachingSection",
  "OwnAiKeySection",
  "SoundEffectsSection",
  "SavedDataSection",
  "OnDeviceModelsSection",
  "ReadAloudVoiceSection",
  "SidebarIconAnimationsSection",
  "SchoolArtSection",
  "PrivacySettingsSection",
  "McpServerSection",
]) {
  vi.doMock(`../../../src/components/settings/sections/${name}`, () => ({ [name]: () => <div data-testid={name} /> }))
}
vi.doMock("../../../src/components/tools/sync/ToolSyncStatusPanel", () => ({
  ToolSyncStatusPanel: () => <div data-testid="ToolSyncStatusPanel" />,
}))
vi.mock("../../../src/lib/hooks/useSession", () => ({ useSession: () => ({ user: null }) }))
vi.mock("../../../src/lib/hooks/useEditorPreferencesSync", () => ({
  useEditorPreferencesSync: () => ({ ready: true, noteRenderedKeys: () => {} }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
Element.prototype.scrollIntoView = () => {}

// Every mounted root is unmounted after each test. Clearing the body alone
// left the panel mounted, so its `?category=` anchor-scroll interval kept
// polling a now-empty document and could fire after jsdom was torn down
// ("ReferenceError: document is not defined" failing `bun run test`).
const roots: Root[] = []

afterEach(() => {
  act(() => {
    for (const root of roots.splice(0)) root.unmount()
  })
  vi.useRealTimers()
  document.body.innerHTML = ""
  search = ""
})

async function mount() {
  const { EditorSettingsPanel } = await import("../../../src/components/settings/EditorSettingsPanel")
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  await act(async () => root.render(<EditorSettingsPanel />))
  return host
}

const tabLabels = (host: HTMLElement) => [...host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)

describe("EditorSettingsPanel", () => {
  it("lists General, Sound & speech, Privacy and MCP ahead of the editor's tabs, with no separate claim tabs", async () => {
    const host = await mount()
    const labels = tabLabels(host)
    expect(labels.slice(0, 6)).toEqual(["General", "Sound & speech", "Privacy", "MCP server & API", "Editor prefs", "Files"])
    expect(labels).not.toContain("My team")
    expect(labels).not.toContain("My school")
    expect(labels.filter((label) => label === "General")).toHaveLength(1)
    expect([...host.querySelectorAll(".dai-settings-group")].map((g) => g.textContent)).toContain("Editor")
  })

  it("opens the MCP server & API tab for ?category=mcp", async () => {
    search = "category=mcp"
    const host = await mount()
    expect(host.querySelector('[data-testid="McpServerSection"]')).not.toBeNull()
  })

  it("renders the team and school claims inside General, without the editor's General rows", async () => {
    search = "category=my-school"
    const host = await mount()
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("General")
    expect(host.querySelector("#settings-my-team [data-testid='my-team']")).not.toBeNull()
    expect(host.querySelector("#settings-my-school [data-testid='my-school']")).not.toBeNull()
    expect(host.querySelector("[data-editor-category='general']")).toBeNull()
  })

  it("shows the account tool-sync panel right after Saved to your account in General", async () => {
    const host = await mount()
    const ids = [...host.querySelectorAll("[data-testid]")].map((el) => el.getAttribute("data-testid"))
    expect(ids).toContain("ToolSyncStatusPanel")
    expect(ids.indexOf("ToolSyncStatusPanel")).toBe(ids.indexOf("SavedDataSection") + 1)
  })

  it("opens the editor's General rows on their own Editor prefs tab for ?category=general", async () => {
    search = "category=general"
    const host = await mount()
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Editor prefs")
    expect(host.querySelector("[data-editor-category='general']")).not.toBeNull()
    expect(host.querySelector("[data-testid='my-team']")).toBeNull()
  })

  it("stops retrying the ?category= anchor scroll once the panel unmounts", async () => {
    vi.useFakeTimers()
    search = "category=my-school"
    await mount()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    act(() => {
      for (const root of roots.splice(0)) root.unmount()
    })
    expect(vi.getTimerCount()).toBe(0)
  })

  it("gives up on an anchor that never renders instead of polling forever", async () => {
    vi.useFakeTimers()
    search = "category=my-school"
    const host = await mount()
    host.querySelector("#settings-my-school")?.remove()
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView")
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })
    expect(scroll).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    scroll.mockRestore()
  })
})
