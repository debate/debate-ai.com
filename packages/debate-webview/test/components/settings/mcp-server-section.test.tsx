/** @vitest-environment jsdom */
/**
 * @fileoverview Settings → MCP server & API: the endpoint, the setup-guide
 * link, and creating / listing / showing / resetting / revoking API keys
 * through /api/mcp/keys.
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

  it("creates a key, shows it with a ready config, and lists it", async () => {
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

  it("shows a listed key again and copies it", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/mcp/keys?id=k1" ? Response.json({ key: "dai_fullkey0001" }) : Response.json({ keys: [KEY] }),
    )
    const writeText = vi.fn(async () => {})
    vi.stubGlobal("fetch", fetchMock)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    const host = await mount(true)
    expect(host.textContent).not.toContain("dai_fullkey0001")
    await act(async () => (host.querySelector('button[aria-label="Show Claude Desktop"]') as HTMLButtonElement).click())
    expect(host.textContent).toContain("dai_fullkey0001")
    await act(async () => (host.querySelector('button[aria-label="Copy Claude Desktop"]') as HTMLButtonElement).click())
    expect(writeText).toHaveBeenCalledWith("dai_fullkey0001")
    await act(async () => (host.querySelector('button[aria-label="Hide Claude Desktop"]') as HTMLButtonElement).click())
    expect(host.textContent).not.toContain("dai_fullkey0001")
  })

  it("resets a key only after confirming, then shows the new one", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        expect(url).toBe("/api/mcp/keys?id=k1")
        return Response.json({ key: "dai_newkey9999", summary: { ...KEY, hint: "9999" } })
      }
      return Response.json({ keys: [KEY] })
    })
    vi.stubGlobal("fetch", fetchMock)
    const host = await mount(true)
    await act(async () => (host.querySelector('button[aria-label="Reset Claude Desktop"]') as HTMLButtonElement).click())
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false)
    expect(host.textContent).toContain("old key stops working")
    const confirm = [...host.querySelectorAll("button")].find((b) => b.textContent === "Reset key") as HTMLButtonElement
    await act(async () => confirm.click())
    await act(async () => {})
    expect(host.textContent).toContain("dai_newkey9999")
    expect(host.textContent).not.toContain("old key stops working")
  })
})
