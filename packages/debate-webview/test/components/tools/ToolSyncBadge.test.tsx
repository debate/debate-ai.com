// @vitest-environment jsdom
/**
 * @fileoverview DOM-level tests for `ToolSyncBadge`'s "Save now" / "Retry save"
 * button: it only shows while a save is pending, flushes the tool's collections
 * on click, and offers a retry when a flush fails. The repo has no
 * @testing-library dependency, so this mounts with `createRoot` + `act`.
 */

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  signedIn: true,
  statuses: {} as Record<string, "synced" | "pending" | "unknown">,
  flush: vi.fn(),
}))

vi.mock("@debate/data-sync/src/state/tool-record-mirror", () => ({
  isToolRecordSyncEnabled: () => mocks.signedIn,
}))
vi.mock("@debate/data-sync/src/state/tool-record-auto-sync", () => ({
  getToolRecordCollectionSyncStatus: (key: string) => mocks.statuses[key] ?? "unknown",
  flushToolRecordCollection: (key: string) => mocks.flush(key),
}))

vi.mock("../../../src/lib/tools/tool-sync-status", () => ({
  // The real resolver drops keys missing from the catalog; these tests use fake ones.
  resolveToolSyncKeys: (_href: string, keys?: readonly string[]) => [...(keys ?? [])],
}))

import { ToolSyncBadge } from "../../../src/components/tools/ToolSyncBadge"

let container: HTMLElement
let root: Root

async function mountBadge() {
  await act(async () => {
    root.render(<ToolSyncBadge href="/x" collectionKeys={["a", "b"]} />)
  })
}

const saveButton = () => container.querySelector<HTMLButtonElement>("[data-tool-save-now]")

async function clickSave() {
  await act(async () => {
    saveButton()!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
}

beforeEach(() => {
  mocks.signedIn = true
  mocks.statuses = { a: "pending", b: "synced" }
  mocks.flush.mockReset()
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe("ToolSyncBadge save button", () => {
  it("shows Save now while a collection has pending changes", async () => {
    await mountBadge()
    expect(container.querySelector("[data-tool-save-state]")?.getAttribute("data-tool-save-state")).toBe("saving")
    expect(saveButton()?.textContent).toContain("Save now")
  })

  it("hides the button when everything is synced or the user is signed out", async () => {
    mocks.statuses = { a: "synced", b: "synced" }
    await mountBadge()
    expect(saveButton()).toBeNull()

    await act(async () => root.unmount())
    root = createRoot(container)
    mocks.signedIn = false
    mocks.statuses = { a: "pending", b: "pending" }
    await mountBadge()
    expect(container.querySelector("[data-tool-save-state]")?.getAttribute("data-tool-save-state")).toBe("local")
    expect(saveButton()).toBeNull()
  })

  it("flushes every collection on click and hides the button once synced", async () => {
    mocks.flush.mockImplementation(async (key: string) => {
      mocks.statuses[key] = "synced"
      return { pushed: 1, deleted: 0 }
    })
    await mountBadge()
    await clickSave()
    expect(mocks.flush.mock.calls.map(([key]) => key)).toEqual(["a", "b"])
    expect(saveButton()).toBeNull()
    expect(container.querySelector("[data-tool-save-state]")?.getAttribute("data-tool-save-state")).toBe("saved")
  })

  it("offers Retry save with the error in its tooltip when a flush fails", async () => {
    mocks.flush.mockResolvedValue({ pushed: 0, deleted: 0, error: "offline" })
    await mountBadge()
    await clickSave()
    expect(saveButton()?.textContent).toContain("Retry save")
    expect(saveButton()?.title).toContain("offline")
  })

  it("renders nothing for a route with no synced collections", async () => {
    await act(async () => {
      root.render(<ToolSyncBadge href="/x" collectionKeys={[]} />)
    })
    expect(container.innerHTML).toBe("")
  })
})
