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
