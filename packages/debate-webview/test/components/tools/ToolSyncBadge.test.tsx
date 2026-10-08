// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

const mocks = vi.hoisted(() => ({
  enabled: true,
  status: "pending" as "pending" | "synced" | "unknown",
  flush: vi.fn(),
  saveToolNow: vi.fn(),
}))

vi.mock("@debate/data-sync/src/state/tool-record-mirror", () => ({
  isToolRecordSyncEnabled: () => mocks.enabled,
}))
vi.mock("@debate/data-sync/src/state/tool-record-auto-sync", () => ({
  flushToolRecordCollection: mocks.flush,
  getToolRecordCollectionSyncStatus: () => mocks.status,
}))
vi.mock("../../../src/lib/tools/tool-save-now", () => ({
  saveToolNow: mocks.saveToolNow,
}))

import { ToolSyncBadge } from "../../../src/components/tools/ToolSyncBadge"

const KEYS = ["pinnedDebates"] as const

describe("ToolSyncBadge (DOM)", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    mocks.enabled = true
    mocks.status = "pending"
    mocks.flush.mockReset()
    mocks.saveToolNow.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = () => act(() => root.render(<ToolSyncBadge href="/x" collectionKeys={KEYS} />))
  const button = () => container.querySelector<HTMLButtonElement>("[data-tool-save-now]")

  it("flushes the tool's collections when Save now is clicked, then shows no error", async () => {
    mocks.saveToolNow.mockResolvedValue({ ok: true })
    render()
    expect(button()).not.toBeNull()

    await act(async () => button()!.click())

    expect(mocks.saveToolNow).toHaveBeenCalledWith(KEYS, mocks.flush)
    expect(container.textContent).not.toContain("Save failed")
  })

  it("offers a retry after a failed save", async () => {
    mocks.saveToolNow.mockResolvedValue({ ok: false, error: "offline" })
    render()

    await act(async () => button()!.click())

    expect(button()).not.toBeNull()
    expect(button()!.textContent).toMatch(/retry/i)
  })

  it("hides Save now when everything is synced", () => {
    mocks.status = "synced"
    render()
    expect(container.querySelector("[data-tool-save-state]")?.getAttribute("data-tool-save-state")).toBe("saved")
    expect(button()).toBeNull()
  })
})
