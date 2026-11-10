/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → General "Account sync" panel: reads the published
 * sync snapshot (never drives the sync itself), shows syncing / synced /
 * failed states, retries via the snapshot's `resync`, and offers the
 * sign-in-reminder opt-back-in to a signed-out guest who opted out.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"
import { TOOL_RECORD_COLLECTIONS } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections"

// The panel must never call the driving hook: its cleanups stop the global
// auto-sync watcher when the panel unmounts.
const { driveSync, prompt, setOptedOut } = vi.hoisted(() => {
  const prompt = { optedOut: false }
  return {
    driveSync: vi.fn(),
    prompt,
    setOptedOut: vi.fn((value: boolean) => {
      prompt.optedOut = value
    }),
  }
})
vi.mock("../../../src/lib/hooks/useToolRecordSync", () => ({ useToolRecordSync: driveSync }))
vi.mock("../../../src/lib/sign-in-prompt-preference", () => ({
  isSignInPromptOptedOut: () => prompt.optedOut,
  setSignInPromptOptedOut: (value: boolean) => setOptedOut(value),
}))

import { ToolSyncStatusPanel } from "../../../src/components/tools/sync/ToolSyncStatusPanel"
import { publishToolSyncSnapshot, resetToolSyncSnapshot } from "../../../src/lib/tools/tool-sync-store"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const resync = vi.fn()
const noResults: ToolRecordHydrationResult[] = []

afterEach(() => {
  document.body.innerHTML = ""
  act(() => resetToolSyncSnapshot())
  prompt.optedOut = false
  vi.clearAllMocks()
})

async function mount() {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(<ToolSyncStatusPanel />))
  return { host, root }
}

describe("ToolSyncStatusPanel", () => {
  it("renders nothing for a signed-out guest who has not opted out", async () => {
    const { host } = await mount()
    expect(host.innerHTML).toBe("")
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("follows the published snapshot from syncing to synced", async () => {
    publishToolSyncSnapshot({ enabled: true, reconciled: false, results: noResults, resync })
    const { host } = await mount()
    expect(host.textContent).toContain("Syncing your tools to your account")

    await act(async () => publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync }))
    expect(host.textContent).toContain("Every tool's data is synced to your account.")
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("lists a failed collection with a link to its tool, and Sync now retries", async () => {
    const collection = TOOL_RECORD_COLLECTIONS[0]
    const failed: ToolRecordHydrationResult[] = [
      { collection: collection.key, adopted: 0, pushed: 0, synced: false, error: "Record too large" },
    ]
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results: failed, resync })
    const { host } = await mount()

    expect(host.textContent).toContain("1 tool couldn't sync just now.")
    expect(host.textContent).toContain("Record too large")
    expect(host.querySelector(`a[href="${collection.href}"]`)?.textContent).toBe(collection.label)

    const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Sync now"))!
    await act(async () => button.click())
    expect(resync).toHaveBeenCalledTimes(1)
  })

  it("lists where each tool saves, with a failed collection's tool marked", async () => {
    const results: ToolRecordHydrationResult[] = [
      { collection: "judgeRoundRecords", adopted: 0, pushed: 0, synced: false, error: "too large" },
    ]
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results, resync })
    const { host } = await mount()

    const details = host.querySelector("details[data-tool-storage-overview]")
    expect(details?.querySelector("summary")?.textContent).toContain("Where each tool saves")
    expect(details?.hasAttribute("open")).toBe(false)

    const prep = host.querySelector('[data-tool-storage-row="/practice/prep"]')
    expect(prep?.querySelector("[data-status]")?.getAttribute("data-status")).toBe("failed")
    expect(prep?.textContent).toContain("Couldn't sync")

    const wordCount = host.querySelector('[data-tool-storage-row="/word-count"]')
    expect(wordCount?.textContent).toContain("Saved to your account: word-count rounds.")
    expect(wordCount?.querySelector("a")?.getAttribute("href")).toBe("/word-count")

    expect(host.querySelector('[data-tool-storage-row="/coaching/rankings"]')).toBeNull()
  })

  it("offers to turn sign-in reminders back on for a guest who opted out", async () => {
    prompt.optedOut = true
    const { host } = await mount()
    const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Turn sign-in reminders back on"))!
    expect(button).toBeDefined()

    await act(async () => button.click())
    expect(setOptedOut).toHaveBeenCalledWith(false)
    expect(host.innerHTML).toBe("")
  })
})
