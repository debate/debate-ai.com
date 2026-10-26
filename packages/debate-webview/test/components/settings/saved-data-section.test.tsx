/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → "Saved to your account": counts for a signed-in
 * user, a sign-in hint (and no request) when signed out, and a load failure.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

let user: { id: string } | null = { id: "u1" }
vi.doMock("../../../src/lib/hooks/useSession", () => ({
  useSession: () => ({ user, isLoading: false }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  document.body.innerHTML = ""
  user = { id: "u1" }
  vi.unstubAllGlobals()
})

async function mount() {
  const { SavedDataSection } = await import("../../../src/components/settings/sections/SavedDataSection")
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => root.render(<SavedDataSection />))
  return host
}

describe("SavedDataSection", () => {
  it("lists the per-kind counts for a signed-in user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 3, items: [{ key: "docs", label: "Documents", count: 2 }, { key: "flows", label: "Flows", count: 1 }] }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data")
    expect(host.textContent).toContain("Documents")
    expect(host.textContent).toContain("2")
    expect(host.textContent).toContain("Flows")
  })

  it("links to the bulk export only when something is saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 1, items: [{ key: "docs", label: "Documents", count: 1 }] }) }))
    expect((await mount()).querySelector('a[href="/api/settings/saved-data?export=all"]')).not.toBeNull()
    document.body.innerHTML = ""
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 0, items: [{ key: "docs", label: "Documents", count: 0 }] }) }))
    expect((await mount()).querySelector('a[href*="export=all"]')).toBeNull()
  })

  it("lists synced tool collections under a Tool data heading when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 2,
          items: [{ key: "docs", label: "Documents", count: 0 }],
          tools: [{ collection: "flowKeymap", label: "Flow Editor Shortcuts", count: 2 }],
        }),
      }),
    )
    const host = await mount()
    expect(host.textContent).toContain("Tool data")
    expect(host.textContent).toContain("Flow Editor Shortcuts")
  })

  it("omits the Tool data heading when there are no tool records", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 0, items: [], tools: [] }) }),
    )
    const host = await mount()
    expect(host.textContent).not.toContain("Tool data")
  })

  it("shows a sign-in hint without calling the API when signed out", async () => {
    user = null
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(host.textContent).toContain("Sign in")
  })

  it("shows an error message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    const host = await mount()
    expect(host.textContent).toContain("Couldn't load your saved data")
  })
})

describe("SavedDataSection manage", () => {
  it("lists a kind's items and deletes one after confirmation", async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === "DELETE") return { ok: true, json: async () => ({ ok: true }) }
      if (url === "/api/settings/saved-data/flows") {
        return { ok: true, json: async () => ({ items: [{ id: 7, title: "NC case", updatedAt: "2024-01-01T00:00:00.000Z", href: null }] }) }
      }
      return { ok: true, json: async () => ({ total: 1, items: [{ key: "flows", label: "Flows", count: 1 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", () => true)
    const host = await mount()
    const manage = [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!
    await act(async () => manage.click())
    expect(host.textContent).toContain("NC case")
    const exportLink = [...host.querySelectorAll("a")].find((a) => a.textContent === "Export")!
    expect(exportLink.getAttribute("href")).toBe("/api/settings/saved-data/flows?id=7")
    expect(exportLink.hasAttribute("download")).toBe(true)
    const del = [...host.querySelectorAll("button")].find((b) => b.textContent === "Delete")!
    await act(async () => del.click())
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data/flows?id=7", { method: "DELETE" })
    expect(host.textContent).not.toContain("NC case")
  })

  it("loads the next page of a long list on demand", async () => {
    const item = (id: number) => ({ id, title: `Flow ${id}`, updatedAt: "2024-01-01T00:00:00.000Z", href: null })
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings/saved-data/flows") return { ok: true, json: async () => ({ items: [item(3), item(2)], hasMore: true }) }
      if (url === "/api/settings/saved-data/flows?offset=2") return { ok: true, json: async () => ({ items: [item(1)], hasMore: false }) }
      return { ok: true, json: async () => ({ total: 3, items: [{ key: "flows", label: "Flows", count: 3 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    expect(host.textContent).not.toContain("Flow 1")
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Load more")!.click())
    expect(host.textContent).toContain("Flow 1")
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Load more")).toBe(false)
  })
})
