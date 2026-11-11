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

  it("links each kind and tool collection to its tool, and leaves rows without an href as plain text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          total: 4,
          items: [
            { key: "wordCountRounds", label: "Word-count rounds", count: 1, href: "/word-count" },
            { key: "drills", label: "Drill sets", count: 1 },
          ],
          tools: [
            { collection: "flowKeymap", label: "Flow Editor Shortcuts", count: 1, href: "/debate" },
            { collection: "vulnerabilityReports", label: "Vulnerability Reports", count: 1, href: null },
          ],
        }),
      }),
    )
    const host = await mount()
    const links = [...host.querySelectorAll("dt a")].map((a) => [a.textContent, a.getAttribute("href")])
    expect(links).toEqual([
      ["Word-count rounds", "/word-count"],
      ["Flow Editor Shortcuts", "/debate"],
    ])
    const plain = [...host.querySelectorAll("dt")].filter((dt) => !dt.querySelector("a")).map((dt) => dt.textContent)
    expect(plain).toEqual(["Drill sets", "Vulnerability Reports"])
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

  it("lists drill sets with open and export links but no Delete when the server marks them read-only", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings/saved-data/drills") {
        return {
          ok: true,
          json: async () => ({
            items: [{ id: 4, title: "Round 12 · 3 drills", updatedAt: "2024-01-01T00:00:00.000Z", href: "/practice/drills" }],
            hasMore: false,
            deletable: false,
          }),
        }
      }
      return { ok: true, json: async () => ({ total: 1, items: [{ key: "drills", label: "Drill sets", count: 1 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data/drills")
    const open = [...host.querySelectorAll("a")].find((a) => a.textContent === "Round 12 · 3 drills")!
    expect(open.getAttribute("href")).toBe("/practice/drills")
    const exportLink = [...host.querySelectorAll("a")].find((a) => a.textContent === "Export")!
    expect(exportLink.getAttribute("href")).toBe("/api/settings/saved-data/drills?id=4")
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Delete")).toBe(false)
    expect(host.textContent).toContain("use Clear on the Drill Sets page")
  })

  it("keeps Delete for servers that predate the deletable flag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/settings/saved-data/docs"
          ? { ok: true, json: async () => ({ items: [{ id: 1, title: "Aff", updatedAt: "2024-01-01T00:00:00.000Z", href: null }] }) }
          : { ok: true, json: async () => ({ total: 1, items: [{ key: "docs", label: "Documents", count: 1 }] }) },
      ),
    )
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Delete")).toBe(true)
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
  it("searches a kind by title on the server and keeps the query when loading more", async () => {
    const item = (id: number, title: string) => ({ id, title, updatedAt: "2024-01-01T00:00:00.000Z", href: null })
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/settings/saved-data/docs") return { ok: true, json: async () => ({ items: [item(1, "Aff case"), item(2, "Neg blocks")], hasMore: false }) }
      if (url === "/api/settings/saved-data/docs?q=neg+50%25") return { ok: true, json: async () => ({ items: [item(2, "Neg 50% blocks")], hasMore: true }) }
      if (url === "/api/settings/saved-data/docs?offset=1&q=neg+50%25") return { ok: true, json: async () => ({ items: [item(3, "Neg 50% file")], hasMore: false }) }
      if (url === "/api/settings/saved-data/docs?q=zzz") return { ok: true, json: async () => ({ items: [], hasMore: false }) }
      return { ok: true, json: async () => ({ total: 2, items: [{ key: "docs", label: "Documents", count: 2 }] }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount()
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Manage")!.click())
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!
    expect(input.getAttribute("aria-label")).toBe("Search saved documents by title")
    const type = async (value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      await act(async () => {
        setter.call(input, value)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })
    }
    const submit = async () => act(async () => host.querySelector<HTMLFormElement>('form[role="search"]')!.requestSubmit())

    await type("  neg 50%  ")
    await submit()
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data/docs?q=neg+50%25")
    expect(host.textContent).toContain("Neg 50% blocks")
    expect(host.textContent).not.toContain("Aff case")

    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Load more")!.click())
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/saved-data/docs?offset=1&q=neg+50%25")
    expect(host.querySelectorAll("ul[aria-label] li")).toHaveLength(2)

    await type("zzz")
    await submit()
    expect(host.textContent).toContain('No saved documents match "zzz".')

    // Clearing the box lists everything again without pressing Search.
    await type("")
    expect(host.textContent).toContain("Aff case")
    expect(host.textContent).not.toContain("No saved documents match")
  })
})

