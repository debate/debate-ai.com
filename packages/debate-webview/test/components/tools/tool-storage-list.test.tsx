/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → General "Where each tool saves": renders signed in
 * and out, follows the published sync snapshot (never the driving hook),
 * shows a failed tool's error, and filters by name.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"

const { driveSync } = vi.hoisted(() => ({ driveSync: vi.fn() }))
vi.mock("../../../src/lib/hooks/useToolRecordSync", () => ({ useToolRecordSync: driveSync }))

import { ToolStorageList } from "../../../src/components/tools/sync/ToolStorageList"
import { publishToolSyncSnapshot, resetToolSyncSnapshot } from "../../../src/lib/tools/tool-sync-store"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const resync = vi.fn()
const noResults: ToolRecordHydrationResult[] = []

afterEach(() => {
  document.body.innerHTML = ""
  act(() => resetToolSyncSnapshot())
  vi.clearAllMocks()
})

async function mount() {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(<ToolStorageList />))
  return host
}

const row = (host: HTMLElement, href: string) =>
  host.querySelector<HTMLElement>(`[data-tool-storage-row="${href}"]`)

describe("ToolStorageList", () => {
  it("renders for a signed-out guest, with synced tools kept on this device", async () => {
    const host = await mount()
    expect(host.textContent).toContain("Where each tool saves")
    expect(host.textContent).toContain("keep their data on this device")
    expect(row(host, "/practice/prep")?.textContent).toContain("On this device")
    // SQL-backed tools carry no live badge.
    const contacts = row(host, "/contacts")
    expect(contacts?.textContent).toContain("Saved to your account: contacts and blocks.")
    expect(contacts?.querySelector("span.rounded-full")).toBeNull()
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("links each row to its tool and skips tools that store nothing", async () => {
    const host = await mount()
    expect(row(host, "/contacts")?.querySelector("a")?.getAttribute("href")).toBe("/contacts")
    expect(row(host, "/coaching/rankings")).toBeNull()
  })

  it("follows the snapshot to synced, then shows a failure's error", async () => {
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync })
    const host = await mount()
    expect(host.textContent).toContain("save to your account automatically")
    expect(row(host, "/practice/prep")?.textContent).toContain("Synced")

    const failed: ToolRecordHydrationResult[] = [
      { collection: "judgeProfiles", adopted: 0, pushed: 0, synced: false, error: "Record too large" },
    ]
    await act(async () => publishToolSyncSnapshot({ enabled: true, reconciled: true, results: failed, resync }))
    const prep = row(host, "/practice/prep")
    expect(prep?.textContent).toContain("Couldn't sync")
    expect(prep?.textContent).toContain("Record too large")
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("filters rows by tool name and says when nothing matches", async () => {
    const host = await mount()
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    await act(async () => {
      setValue.call(input, "contacts")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const hrefs = [...host.querySelectorAll("[data-tool-storage-row]")].map((el) => el.getAttribute("data-tool-storage-row"))
    expect(hrefs).toContain("/contacts")
    expect(hrefs).not.toContain("/practice/prep")

    await act(async () => {
      setValue.call(input, "no such tool")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    expect(host.textContent).toContain("No tools match")
  })
})
