/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → Saved to your account → "Restore from export…":
 * posts the picked file, reports restored and skipped items, surfaces the
 * server's error, and reloads the counts in `SavedDataSection` after a restore.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { RestoreSavedData, describeRestored } from "../../../src/components/settings/sections/RestoreSavedData"
import { publishToolSyncSnapshot, resetToolSyncSnapshot } from "../../../src/lib/tools/tool-sync-store"

vi.doMock("../../../src/lib/hooks/useSession", () => ({
  useSession: () => ({ user: { id: "u1" }, isLoading: false }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
  resetToolSyncSnapshot()
})

async function render(node: React.ReactNode) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  await act(async () => createRoot(host).render(node))
  return host
}

/** Picks `text` as a file in the hidden input and lets the upload settle. */
async function pick(host: HTMLElement, text: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File([text], "export.json", { type: "application/json" })
  Object.defineProperty(input, "files", { value: [file], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
  // file.text() and res.json() resolve on later ticks.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("describeRestored", () => {
  it("names each restored kind with the right plural", () => {
    expect(describeRestored({ flows: 2, docs: 1 })).toBe("Restored 1 document and 2 flows.")
    expect(describeRestored({ docs: 2, flows: 1, rounds: 3 })).toBe("Restored 2 documents, 1 flow and 3 rounds.")
    expect(describeRestored({ docs: 0 })).toBe("Nothing new to restore.")
    expect(describeRestored({ judgeDecisions: 1, speeches: 2 })).toBe("Restored 1 judge decision and 2 sent speeches.")
  })

  it("names restored tool data records last", () => {
    expect(describeRestored({ flows: 1 }, 5)).toBe("Restored 1 flow and 5 tool data records.")
    expect(describeRestored({}, 1)).toBe("Restored 1 tool data record.")
    expect(describeRestored({ flows: 0 }, 0)).toBe("Nothing new to restore.")
  })

  it("names restored word-count rounds and drill sets", () => {
    expect(describeRestored({ wordCountRounds: 1, drills: 2 })).toBe("Restored 1 word-count round and 2 drill sets.")
    expect(describeRestored({ flows: 1, wordCountRounds: 2, drills: 1 })).toBe("Restored 1 flow, 2 word-count rounds and 1 drill set.")
  })

  it("names restored judge decisions and sent speeches", () => {
    expect(describeRestored({ judgeDecisions: 1, speeches: 2 })).toBe("Restored 1 judge decision and 2 sent speeches.")
    expect(describeRestored({ drills: 1, judgeDecisions: 3, speeches: 1 })).toBe("Restored 1 drill set, 3 judge decisions and 1 sent speech.")
  })
})

describe("RestoreSavedData", () => {
  it("posts the file, reports what was restored and skipped, and asks for a reload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        restored: { docs: 0, flows: 1, rounds: 0, practiceRounds: 0 },
        skipped: [{ kind: "rounds", title: "TOC Finals", reason: "Already in your account." }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const onRestored = vi.fn()
    const host = await render(<RestoreSavedData onRestored={onRestored} />)
    await pick(host, '{"kind":"flows","id":1}')

    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data", expect.objectContaining({ method: "POST", body: '{"kind":"flows","id":1}' }))
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Restored 1 flow.")
    expect(host.textContent).toContain("Skipped 1")
    expect(host.querySelector('[aria-label="Skipped items"]')?.textContent).toContain("TOC Finals — Already in your account.")
    expect(onRestored).toHaveBeenCalledTimes(1)
  })

  it("reports restored tool data, reloads the counts and starts a sync so this device adopts it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          restored: { flows: 0 },
          restoredToolRecords: 3,
          skipped: [{ kind: "toolRecords", title: "Pinned Debates · 1 record", reason: "Already in your account." }],
        }),
      }),
    )
    const resync = vi.fn()
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results: [], resync })
    const onRestored = vi.fn()
    const host = await render(<RestoreSavedData onRestored={onRestored} />)
    await pick(host, '{"exportedAt":"x","toolRecords":{}}')
    const status = host.querySelector('[role="status"]')?.textContent ?? ""
    expect(status).toContain("Restored 3 tool data records.")
    expect(status).toContain("syncing to this device now")
    expect(host.querySelector('[aria-label="Skipped items"]')?.textContent).toContain("Pinned Debates · 1 record — Already in your account.")
    expect(onRestored).toHaveBeenCalledTimes(1)
    expect(resync).toHaveBeenCalledTimes(1)
  })

  it("does not start a sync when no tool data was restored", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ restored: { flows: 1 }, skipped: [] }) }))
    const resync = vi.fn()
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results: [], resync })
    const host = await render(<RestoreSavedData onRestored={vi.fn()} />)
    await pick(host, '{"kind":"flows","id":1}')
    expect(host.textContent).not.toContain("syncing to this device")
    expect(resync).not.toHaveBeenCalled()
  })

  it("does not reload when nothing new was restored", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ restored: { flows: 0 }, skipped: [] }) }))
    const onRestored = vi.fn()
    const host = await render(<RestoreSavedData onRestored={onRestored} />)
    await pick(host, "{}")
    expect(host.textContent).toContain("Nothing new to restore.")
    expect(onRestored).not.toHaveBeenCalled()
  })

  it("shows the server's error for a file it rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "This isn't a Debate AI export file." }) }))
    const host = await render(<RestoreSavedData onRestored={vi.fn()} />)
    await pick(host, "[]")
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("This isn't a Debate AI export file.")
  })

  it("falls back to a generic message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    const host = await render(<RestoreSavedData onRestored={vi.fn()} />)
    await pick(host, "{}")
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Couldn't restore this file")
  })
})

describe("SavedDataSection restore", () => {
  it("offers restore even when nothing is saved, and reloads the counts after one", async () => {
    let total = 0
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        total = 1
        return { ok: true, json: async () => ({ restored: { flows: 1 }, skipped: [] }) }
      }
      return { ok: true, json: async () => ({ total, items: [{ key: "flows", label: "Flows", count: total }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const { SavedDataSection } = await import("../../../src/components/settings/sections/SavedDataSection")
    const host = await render(<SavedDataSection />)
    expect(host.textContent).toContain("Restore from export…")
    await pick(host, '{"kind":"flows"}')
    expect(fetchMock.mock.calls.filter(([url, init]) => url === "/api/settings/saved-data" && !init)).toHaveLength(2)
    expect(host.querySelector('a[href*="export=all"]')).not.toBeNull()
  })
})
