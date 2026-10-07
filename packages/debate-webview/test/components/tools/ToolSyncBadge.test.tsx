// @vitest-environment jsdom
/**
 * @fileoverview `ToolSyncBadge` mounted for real: the "Save now" / "Retry save"
 * button must call the tool's flush for each collection and reflect the result.
 * Mounts with `createRoot` + React's `act` (no @testing-library in the repo).
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const sync = vi.hoisted(() => ({
  status: "pending" as "pending" | "synced",
  flush: vi.fn(),
}))

vi.mock("@debate/data-sync/src/state/tool-record-mirror", () => ({ isToolRecordSyncEnabled: () => true }))
vi.mock("@debate/data-sync/src/state/tool-record-auto-sync", () => ({
  getToolRecordCollectionSyncStatus: () => sync.status,
  flushToolRecordCollection: (key: string) => sync.flush(key),
}))

import { TOOL_RECORD_COLLECTIONS } from "@debate/data-sync/src/state/toolRecordCollections"
import { ToolSyncBadge } from "../../../src/components/tools/ToolSyncBadge"

let container: HTMLElement
let root: Root

// Two real catalog keys: `resolveToolSyncKeys` drops unknown ones.
const KEYS = TOOL_RECORD_COLLECTIONS.slice(0, 2).map((collection) => collection.key)

async function mountBadge() {
  await act(async () => {
    root.render(<ToolSyncBadge href="/x" collectionKeys={KEYS} />)
  })
}

const button = () => container.querySelector<HTMLButtonElement>("[data-tool-save-now]")

beforeEach(() => {
  sync.status = "pending"
  sync.flush.mockReset()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("ToolSyncBadge Save now", () => {
  it("shows Save now while changes are pending and flushes every collection on click", async () => {
    sync.flush.mockResolvedValue({ pushed: 1, deleted: 0 })
    await mountBadge()
    expect(button()?.textContent).toBe("Save now")

    sync.status = "synced"
    await act(async () => button()!.click())

    expect(sync.flush.mock.calls.map(([key]) => key)).toEqual(KEYS)
    expect(button()).toBeNull()
    expect(container.querySelector("[data-tool-save-state]")?.getAttribute("data-tool-save-state")).toBe("saved")
  })

  it("offers Retry save with the error in its tooltip after a failed flush", async () => {
    sync.flush.mockResolvedValue({ pushed: 0, deleted: 0, error: "offline" })
    await mountBadge()
    await act(async () => button()!.click())

    expect(button()?.textContent).toBe("Retry save")
    expect(button()?.title).toContain("offline")
  })

  it("renders no button when the tool is already saved", async () => {
    sync.status = "synced"
    await mountBadge()
    expect(button()).toBeNull()
  })
})
