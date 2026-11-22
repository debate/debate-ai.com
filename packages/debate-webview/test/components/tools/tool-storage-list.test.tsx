/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → General "Where each tool saves": renders signed in
 * and out, grouped like the sidebar, follows the published sync snapshot
 * (never the driving hook), shows a failed tool's error, and filters by tool
 * name or group with a "Showing N of M" count.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"

const { driveSync } = vi.hoisted(() => ({ driveSync: vi.fn() }))
vi.mock("../../../src/lib/hooks/useToolRecordSync", () => ({ useToolRecordSync: driveSync }))

import { ToolStorageList } from "../../../src/components/tools/sync/ToolStorageList"
import { buildToolStorageOverview, countToolStorageRows } from "../../../src/lib/tools/tool-storage-overview"
import { TOOL_GROUPS } from "../../../src/routes/tools/tool-groups"
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

const rowHrefs = (host: HTMLElement) =>
  [...host.querySelectorAll("[data-tool-storage-row]")].map((el) => el.getAttribute("data-tool-storage-row"))

async function typeFilter(host: HTMLElement, value: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="search"]')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  await act(async () => {
    setValue.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

describe("ToolStorageList", () => {
  it("renders for a signed-out guest, with synced tools kept on this device", async () => {
    const host = await mount()
    expect(host.textContent).toContain("Where each tool saves")
    expect(host.textContent).toContain("keep their data on this device")
    const prep = row(host, "/practice/prep")
    expect(prep?.querySelector("[data-status]")?.textContent).toBe("This device only")
    expect(prep?.textContent).toContain("Kept on this device until you sign in, then saved to your account.")
    // SQL-backed tools only save in the account, so a guest is asked to sign in.
    const contacts = row(host, "/contacts")
    expect(contacts?.textContent).toContain("Saved to your account once you sign in: contacts and blocks.")
    expect(contacts?.querySelector("[data-status]")?.getAttribute("data-status")).toBe("signIn")
    expect(contacts?.querySelector("[data-status]")?.textContent).toBe("Sign in to save")
    expect(host.textContent).toContain("Tools marked Sign in to save keep their items in your account")
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("shows Saved to account for SQL-backed tools once signed in", async () => {
    act(() => publishToolSyncSnapshot({ enabled: true, reconciled: true, results: noResults, resync }))
    const host = await mount()
    const contacts = row(host, "/contacts")
    expect(contacts?.querySelector("[data-status]")?.getAttribute("data-status")).toBe("account")
    expect(contacts?.querySelector("[data-status]")?.textContent).toBe("Saved to account")
    expect(contacts?.textContent).toContain("Saved to your account: contacts and blocks.")
    expect(host.textContent).not.toContain("Sign in to save")
    expect(host.textContent).not.toContain("once you sign in")
  })

  it("is collapsed, groups rows like the sidebar and lists each tool once", async () => {
    const host = await mount()
    const details = host.querySelector("details[data-tool-storage-list]")
    expect(details?.hasAttribute("open")).toBe(false)

    const expected = buildToolStorageOverview(TOOL_GROUPS, { enabled: false, reconciled: false, results: noResults })
    const headings = [...host.querySelectorAll("[data-tool-storage-group]")].map((el) => el.getAttribute("data-tool-storage-group"))
    expect(headings).toEqual(expected.map((group) => group.heading))
    const hrefs = rowHrefs(host)
    expect(hrefs).toHaveLength(new Set(hrefs).size)
    expect(hrefs).toHaveLength(countToolStorageRows(expected))
    expect(details?.querySelector("summary")?.textContent).toContain(`(${hrefs.length})`)
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
    expect(prep?.querySelector("[data-tool-storage-error]")?.textContent).toBe("Record too large")
    expect(driveSync).not.toHaveBeenCalled()
  })

  it("filters rows by tool name, keeps their group heading, and counts what's shown", async () => {
    const host = await mount()
    expect(host.querySelector("[data-tool-storage-count]")).toBeNull()

    await typeFilter(host, "CONTACTS")
    const hrefs = rowHrefs(host)
    expect(hrefs).toContain("/contacts")
    expect(hrefs).not.toContain("/practice/prep")
    const group = row(host, "/contacts")?.closest("[data-tool-storage-group]")
    expect(group?.querySelector("h3")?.textContent).toBeTruthy()
    const total = countToolStorageRows(buildToolStorageOverview(TOOL_GROUPS, { enabled: false, reconciled: false, results: noResults }))
    expect(host.querySelector("[data-tool-storage-count]")?.textContent).toBe(`Showing ${hrefs.length} of ${total} tools.`)
  })

  it("filters by group heading, keeping that whole group", async () => {
    const host = await mount()
    const sync = { enabled: false, reconciled: false, results: noResults }
    const target = buildToolStorageOverview(TOOL_GROUPS, sync)[0]
    await typeFilter(host, target.heading)
    for (const tool of target.rows) expect(rowHrefs(host)).toContain(tool.href)
  })

  it("says when nothing matches and clears back to the full list", async () => {
    const host = await mount()
    const all = rowHrefs(host)
    await typeFilter(host, "no such tool")
    expect(rowHrefs(host)).toEqual([])
    expect(host.querySelector("[data-tool-storage-count]")?.textContent).toBe("No tools match “no such tool”.")

    await typeFilter(host, "   ")
    expect(rowHrefs(host)).toEqual(all)
    expect(host.querySelector("[data-tool-storage-count]")).toBeNull()
  })
})
