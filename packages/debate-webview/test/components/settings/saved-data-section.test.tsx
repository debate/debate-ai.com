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

  it("loads further pages of a kind with a Load more button", async () => {
    const item = (id: number) => ({ id, title: `Flow ${id}`, updatedAt: "2024-01-01T00:00:00.000Z", href: null })
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings/saved-data/flows") return { ok: true, json: async () => ({ items: [item(2), item(1)], hasMore: true }) }
      if (url === "/api/settings/saved-data/flows?offset=2") return { ok: true, json: async () => ({ items: [item(1), item(0)], hasMore: false }) }
      return { ok: true, json: async () => ({ total: 3, items: [{ key: "flows", label: "Flows", count: 3 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    const more = [...host.querySelectorAll("button")].find((b) => b.textContent === "Load more")!
    await act(async () => more.click())
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data/flows?offset=2")
    expect(host.querySelectorAll("ul[aria-label] li")).toHaveLength(3)
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Load more")).toBe(false)
  })

  it("keeps the list and reports the item when a delete fails", async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === "DELETE") return { ok: false, status: 500 }
      if (url === "/api/settings/saved-data/docs") {
        return { ok: true, json: async () => ({ items: [{ id: 3, title: "Aff blocks", updatedAt: "2024-01-01T00:00:00.000Z", href: null }] }) }
      }
      return { ok: true, json: async () => ({ total: 1, items: [{ key: "docs", label: "Documents", count: 1 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", () => true)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Delete")!.click())
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Couldn\'t delete "Aff blocks". Try again.')
    expect(host.querySelectorAll("ul[aria-label] li")).toHaveLength(1)
    // The count is untouched because nothing was deleted.
    expect(host.querySelector("dd")?.textContent).toContain("1")
  })

  it("keeps loaded rows and the Load more button when a later page fails", async () => {
    const item = (id: number) => ({ id, title: `Flow ${id}`, updatedAt: "2024-01-01T00:00:00.000Z", href: null })
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings/saved-data/flows") return { ok: true, json: async () => ({ items: [item(2), item(1)], hasMore: true }) }
      if (url === "/api/settings/saved-data/flows?offset=2") return { ok: false, status: 503 }
      return { ok: true, json: async () => ({ total: 3, items: [{ key: "flows", label: "Flows", count: 3 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Load more")!.click())
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Couldn't load more flows. Try again.")
    expect(host.querySelectorAll("ul[aria-label] li")).toHaveLength(2)
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Load more")).toBe(true)
  })

  it("offers Try again when the first page fails, and shows the list once it loads", async () => {
    let listCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings/saved-data/rounds") {
        listCalls += 1
        if (listCalls === 1) return { ok: false, status: 500 }
        return { ok: true, json: async () => ({ items: [{ id: 4, title: "Round 4", updatedAt: "2024-01-01T00:00:00.000Z", href: "/debate?roundId=4" }] }) }
      }
      return { ok: true, json: async () => ({ total: 1, items: [{ key: "rounds", label: "Rounds", count: 1 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    expect(host.textContent).toContain("Couldn't load rounds.")
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Try again")!.click())
    expect(listCalls).toBe(2)
    expect(host.textContent).not.toContain("Couldn't load rounds.")
    expect(host.querySelector('a[href="/debate?roundId=4"]')?.textContent).toBe("Round 4")
  })
})
