/**
 * @fileoverview "Sign in with QwkSearch" in the embedded research workspace:
 * the auth client reads the link from /api/qwksearch/session, and the linked
 * key goes to qwksearch.com's API — and nowhere else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Seen = { url: string; key: string | null }

describe("connect-auth", () => {
  const seen: Seen[] = []
  let sessionBody: unknown

  beforeEach(() => {
    vi.resetModules()
    seen.length = 0
    sessionBody = { connected: false }
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      seen.push({ url, key: new Headers(init?.headers).get("x-api-key") })
      const body = url.startsWith("/api/qwksearch/session") ? sessionBody : {}
      return new Response(JSON.stringify(body), { status: 200 })
    })
    vi.stubGlobal("window", { fetch, location: { href: "https://debate-ai.com/doc", pathname: "/doc", search: "", assign: vi.fn() } })
    vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => (window.fetch as typeof fetch)(...args))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("matches only qwksearch.com API URLs", async () => {
    const { isQwkSearchApiRequest } = await import("../../../src/components/qwksearch/connect-auth")
    expect(isQwkSearchApiRequest("https://qwksearch.com/api/agent/chat")).toBe(true)
    expect(isQwkSearchApiRequest("https://qwksearch.com/connect")).toBe(false)
    expect(isQwkSearchApiRequest("https://qwksearch.com.evil.test/api/x")).toBe(false)
    expect(isQwkSearchApiRequest("/api/settings")).toBe(false)
  })

  it("stays a guest while no QwkSearch account is linked", async () => {
    const { authClient } = await import("../../../src/components/qwksearch/connect-auth")
    expect(await authClient.getSession()).toEqual({ data: null })
    await window.fetch("https://qwksearch.com/api/agent/providers")
    expect(seen.at(-1)).toEqual({ url: "https://qwksearch.com/api/agent/providers", key: null })
  })

  it("sends the linked key to qwksearch.com only, and stops after sign-out", async () => {
    sessionBody = { connected: true, user: { id: "u1", name: "Ada" }, apiKey: "qwk_abc", plan: "free" }
    const { authClient } = await import("../../../src/components/qwksearch/connect-auth")
    expect(await authClient.getSession()).toEqual({ data: { user: { id: "u1", name: "Ada" } } })

    await window.fetch("https://qwksearch.com/api/agent/chats")
    await window.fetch("/api/settings")
    expect(seen.find((r) => r.url === "https://qwksearch.com/api/agent/chats")?.key).toBe("qwk_abc")
    expect(seen.find((r) => r.url === "/api/settings")?.key).toBeNull()

    await authClient.signOut()
    expect(seen.some((r) => r.url === "/api/qwksearch/disconnect")).toBe(true)
    await window.fetch("https://qwksearch.com/api/agent/chats?after")
    expect(seen.at(-1)?.key).toBeNull()
  })

  it("starts the connect flow from the current page", async () => {
    const { authClient } = await import("../../../src/components/qwksearch/connect-auth")
    authClient.signIn.social()
    expect(window.location.assign).toHaveBeenCalledWith("/api/qwksearch/connect?returnTo=%2Fdoc")
  })
})
