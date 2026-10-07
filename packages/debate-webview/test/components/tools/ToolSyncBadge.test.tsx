/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enabled: true,
  status: "pending" as "pending" | "synced" | "unknown",
  flush: vi.fn(),
}))

vi.mock("@debate/data-sync/src/state/tool-record-mirror", () => ({
  isToolRecordSyncEnabled: () => mocks.enabled,
}))
vi.mock("@debate/data-sync/src/state/tool-record-auto-sync", () => ({
  getToolRecordCollectionSyncStatus: () => mocks.status,
  flushToolRecordCollection: (key: string) => mocks.flush(key),
}))

import { resolveToolSyncKeys } from "../../../src/lib/tools/tool-sync-status"
import { ToolSyncBadge } from "../../../src/components/tools/ToolSyncBadge"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Real catalog keys: the badge drops keys that are not in the catalog.
const KEYS = resolveToolSyncKeys("/research/cards").slice(0, 2)

let root: Root
let host: HTMLDivElement

const button = () => host.querySelector<HTMLButtonElement>("[data-tool-save-now]")
const badge = () => host.querySelector<HTMLElement>("[data-tool-save-state]")

async function renderBadge() {
  await act(async () => root.render(<ToolSyncBadge href="/x" collectionKeys={KEYS} />))
}

beforeEach(() => {
  mocks.enabled = true
  mocks.status = "pending"
  mocks.flush.mockReset()
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ""
})

describe("ToolSyncBadge", () => {
  it("offers Save now while changes are pending and flushes every collection on click", async () => {
    mocks.flush.mockResolvedValue({ pushed: 1, deleted: 0 })
    await renderBadge()
    expect(badge()?.dataset.toolSaveState).toBe("saving")
    expect(button()?.textContent).toBe("Save now")

    mocks.status = "synced"
    await act(async () => button()?.click())

    expect(mocks.flush.mock.calls.map(([key]) => key)).toEqual(KEYS)
    expect(badge()?.dataset.toolSaveState).toBe("saved")
    expect(button()).toBeNull()
  })

  it("shows Retry save with the error after a failed flush", async () => {
    mocks.flush.mockResolvedValue({ pushed: 0, deleted: 0, error: "offline" })
    await renderBadge()
    await act(async () => button()?.click())

    expect(button()?.textContent).toBe("Retry save")
    expect(button()?.title).toContain("offline")
  })

  it("has no button when the tool is fully synced", async () => {
    mocks.status = "synced"
    await renderBadge()
    expect(badge()?.dataset.toolSaveState).toBe("saved")
    expect(button()).toBeNull()
  })

  it("has no button when signed out", async () => {
    mocks.enabled = false
    await renderBadge()
    expect(badge()?.dataset.toolSaveState).toBe("local")
    expect(button()).toBeNull()
  })
})
