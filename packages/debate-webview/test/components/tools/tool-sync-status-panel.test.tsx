/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → General "Account sync" panel: reads the published
 * sync snapshot (never drives the sync itself), shows syncing / synced /
 * failed states, retries via the snapshot's `resync`, and offers the
 * sign-in-reminder opt-back-in to a signed-out guest who opted out. Also
 * shows when the tab's last complete merge finished ("Last synced …").
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
import { buildToolStorageOverview } from "../../../src/lib/tools/tool-storage-overview"
import { TOOL_GROUPS } from "../../../src/routes/tools/tool-groups"
import { publishToolSyncSnapshot, resetToolSyncSnapshot } from "../../../src/lib/tools/tool-sync-store"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const resync = vi.fn()
const noResults: ToolRecordHydrationResult[] = []

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
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
    expect(host.textContent).toMatch(/All \d+ tools that save data are synced to your account\./)
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("counts only the tools that save to the account, not device-only ones", async () => {
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync })
    const { host } = await mount()

    const rows = buildToolStorageOverview(TOOL_GROUPS, { enabled: true, reconciled: true, results: noResults })
      .flatMap((group) => group.rows)
    const accountRows = rows.filter((row) => row.status.kind !== "local")
    expect(accountRows.length).toBeGreaterThan(1)
    expect(host.querySelector("[data-tool-sync-summary]")?.textContent).toBe(
      `All ${accountRows.length} tools that save data are synced to your account.`,
    )
    // The rendered rows agree: one per tool, the count leaves out device-only ones.
    const pills = [...host.querySelectorAll("[data-tool-storage-row] [data-status]")]
    expect(pills).toHaveLength(rows.length)
    expect(pills.filter((pill) => pill.getAttribute("data-status") !== "local")).toHaveLength(accountRows.length)
  })

  it("disables Sync now and shows it busy while a merge runs, then re-enables it", async () => {
    publishToolSyncSnapshot({ enabled: true, reconciled: false, results: noResults, resync })
    const { host } = await mount()
    const button = () => host.querySelector<HTMLButtonElement>("section[data-tool-sync-status] button")!

    expect(button().textContent).toBe("Syncing…")
    expect(button().disabled).toBe(true)
    expect(button().getAttribute("aria-busy")).toBe("true")
    await act(async () => button().click())
    expect(resync).not.toHaveBeenCalled()

    await act(async () => publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync }))
    expect(button().textContent).toBe("Sync now")
    expect(button().disabled).toBe(false)
    expect(button().getAttribute("aria-busy")).toBe("false")
    await act(async () => button().click())
    expect(resync).toHaveBeenCalledTimes(1)
  })

  it("says when the last complete merge finished, and keeps the age current", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })
    const mergedAt = new Date("2026-11-16T10:00:00Z").getTime()
    vi.setSystemTime(mergedAt + 3 * 60_000)
    sessionStorage.setItem("toolRecordSyncHydratedAt", String(mergedAt))
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync })
    const { host } = await mount()

    const line = () => host.querySelector("[data-tool-sync-last]")
    expect(line()?.textContent).toBe("Last synced 3 minutes ago")
    expect(line()?.querySelector("time")?.getAttribute("dateTime")).toBe("2026-11-16T10:00:00.000Z")

    await act(async () => {
      vi.advanceTimersByTime(2 * 60_000)
    })
    expect(line()?.textContent).toBe("Last synced 5 minutes ago")

    // Another frame of the same tab finishing a merge updates the line on the next tick.
    sessionStorage.setItem("toolRecordSyncHydratedAt", String(Date.now()))
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(line()?.textContent).toBe("Last synced just now")
  })

  it("hides the last-synced line while a merge runs and when there is no complete merge", async () => {
    sessionStorage.setItem("toolRecordSyncHydratedAt", String(Date.now()))
    publishToolSyncSnapshot({ enabled: true, reconciled: false, results: noResults, resync })
    const { host } = await mount()
    expect(host.querySelector("[data-tool-sync-last]")).toBeNull()

    // A merge that hit server errors leaves no mark: the failures list speaks instead.
    sessionStorage.clear()
    await act(async () => publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync }))
    expect(host.querySelector("[data-tool-sync-last]")).toBeNull()
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
