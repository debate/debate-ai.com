/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest"

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast }))

import { setHostConnectQwkSearch } from "../../src/components/host-connect"
import { connectQwkSearch } from "../../src/components/connect-auth"

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => {
  setHostConnectQwkSearch()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("connectQwkSearch with a host that runs the flow (the extension)", () => {
  it("hands the flow to the host instead of navigating to /api/qwksearch/connect", async () => {
    const before = window.location.href
    const hostConnect = vi.fn(async () => ({ ok: false, cancelled: true }))
    setHostConnectQwkSearch(hostConnect)

    connectQwkSearch()
    await flush()

    expect(hostConnect).toHaveBeenCalledOnce()
    expect(window.location.href).toBe(before)
    expect(toast.info).toHaveBeenCalledWith("QwkSearch sign-in was cancelled.")
  })

  it("shows the host's error when linking fails", async () => {
    setHostConnectQwkSearch(async () => ({ ok: false, error: "Sign in to Debate AI first." }))
    connectQwkSearch()
    await flush()
    expect(toast.error).toHaveBeenCalledWith("Sign in to Debate AI first.")
  })

  it("re-reads the session after a successful link", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ connected: false }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    setHostConnectQwkSearch(async () => ({ ok: true }))

    connectQwkSearch()
    await flush()
    await flush()

    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe("/api/qwksearch/session?refresh=1")
    // The server didn't confirm the link, so this is reported, not celebrated.
    expect(toast.error).toHaveBeenCalled()
  })
})
