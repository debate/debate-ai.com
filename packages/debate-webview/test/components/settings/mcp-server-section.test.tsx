/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → MCP server & API: the endpoint, the setup-guide
 * link, and creating / listing / revoking API keys through /api/mcp/keys.
 */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MCP_SETUP_DOCS_URL, McpServerSection } from "../../../src/components/settings/sections/McpServerSection"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const KEY = { id: "k1", name: "Claude Desktop", hint: "abcd", createdAt: "2026-10-25T00:00:00Z", expiresAt: "2027-10-25T00:00:00Z" }

afterEach(() => {
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
})

async function mount(signedIn: boolean) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  await act(async () => createRoot(host).render(<McpServerSection signedIn={signedIn} />))
  await act(async () => {})
  return host
}

describe("McpServerSection", () => {
  it("shows this origin's MCP URL and links the setup guide", async () => {
    vi.stubGlobal("fetch", vi.fn())
    const host = await mount(false)
    expect(host.textContent).toContain(`${window.location.origin}/api/mcp`)
    expect(host.querySelector(`a[href="${MCP_SETUP_DOCS_URL}"]`)).not.toBeNull()
    expect(host.textContent).toContain("Sign in")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("creates a key, shows it once with a ready config, and lists it", async () => {
    let keys: (typeof KEY)[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        keys = [KEY]
        return Response.json({ key: "dai_secret1234", summary: KEY })
      }
      return Response.json({ keys })
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount(true)
    expect(host.textContent).toContain("No API keys yet.")

    const form = host.querySelector("form")!
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    await act(async () => {})
    expect(host.textContent).toContain("dai_secret1234")
    expect(host.textContent).toContain("Bearer dai_secret1234")
    expect(host.textContent).toContain("Claude Desktop")
    expect(host.textContent).toContain("…abcd")
  })

  it("revokes a key", async () => {
    let keys = [KEY]
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        expect(url).toBe("/api/mcp/keys?id=k1")
        keys = []
        return Response.json({ ok: true })
      }
      return Response.json({ keys })
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount(true)
    const revoke = host.querySelector('button[aria-label="Revoke Claude Desktop"]') as HTMLButtonElement
    await act(async () => revoke.click())
    await act(async () => {})
    expect(host.textContent).toContain("No API keys yet.")
  })
})
