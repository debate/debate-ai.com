/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const flush = vi.fn()
let status: "pending" | "synced" = "pending"

vi.mock("@debate/data-sync/src/state/tool-record-mirror", () => ({
  isToolRecordSyncEnabled: () => true,
}))
vi.mock("@debate/data-sync/src/state/tool-record-auto-sync", () => ({
  flushToolRecordCollection: (key: string) => flush(key),
  getToolRecordCollectionSyncStatus: () => status,
}))

import { ToolSyncBadge } from "../../../src/components/tools/ToolSyncBadge"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLDivElement

const button = () => host.querySelector<HTMLButtonElement>("[data-tool-save-now]")
const badge = () => host.querySelector<HTMLElement>("[data-tool-save-state]")

beforeEach(async () => {
  status = "pending"
  flush.mockReset()
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<ToolSyncBadge href="/x" collectionKeys={["flowKeymap"]} />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("ToolSyncBadge Save now", () => {
  it("shows Save now while a save is pending and flushes the tool's collections on click", async () => {
    expect(badge()?.dataset.toolSaveState).toBe("saving")
    expect(button()?.textContent).toBe("Save now")

    flush.mockImplementation(async () => {
      status = "synced"
      return { pushed: 1, deleted: 0 }
    })
    await act(async () => button()!.click())

    expect(flush).toHaveBeenCalledExactlyOnceWith("flowKeymap")
    expect(badge()?.dataset.toolSaveState).toBe("saved")
    expect(button()).toBeNull()
  })

  it("offers Retry save with the error when a flush fails", async () => {
    flush.mockResolvedValue({ pushed: 0, deleted: 0, error: "offline" })
    await act(async () => button()!.click())

    expect(button()?.textContent).toBe("Retry save")
    expect(button()?.title).toContain("offline")
  })
})
