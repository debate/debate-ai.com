import { describe, expect, it, vi } from "vitest"

import { proxyTabroomBeta, tabroomBetaUpstreamUrl } from "../tabroom-beta-proxy"

const ORIGIN = "https://d.ebate.app"

describe("tabroomBetaUpstreamUrl", () => {
  it("maps the public API trees onto api.tabroom.com/v1, query included", () => {
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom-beta/pages/invite/upcoming`)?.href).toBe(
      "https://api.tabroom.com/v1/pages/invite/upcoming",
    )
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom-beta/rest/tourns/38436/invite?x=1`)?.href).toBe(
      "https://api.tabroom.com/v1/rest/tourns/38436/invite?x=1",
    )
  })

  it("refuses anything outside rest/ and pages/", () => {
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom-beta/user/login`)).toBeNull()
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom-beta/`)).toBeNull()
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom-beta/rest/%2e%2e/admin`)).toBeNull()
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom-beta/rest/a%2F..%2Fadmin`)).toBeNull()
    expect(tabroomBetaUpstreamUrl(`${ORIGIN}/api/tabroom/rest/tourns`)).toBeNull()
  })
})

describe("proxyTabroomBeta", () => {
  it("forwards a GET without the visitor's cookies and marks it cacheable", async () => {
    const fetchImpl = vi.fn(async () => new Response("[]", { headers: { "content-type": "application/json" } }))
    const res = await proxyTabroomBeta(
      new Request(`${ORIGIN}/api/tabroom-beta/pages/invite/upcoming`, { headers: { cookie: "session=secret" } }),
      fetchImpl as unknown as typeof fetch,
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(res.headers.get("cache-control")).toContain("max-age=60")
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.href).toBe("https://api.tabroom.com/v1/pages/invite/upcoming")
    expect(new Headers(init.headers).get("cookie")).toBeNull()
  })

  it("passes an upstream error status through uncached", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"nope"}', { status: 404 }))
    const res = await proxyTabroomBeta(new Request(`${ORIGIN}/api/tabroom-beta/rest/tourns/1/invite`), fetchImpl as unknown as typeof fetch)
    expect(res.status).toBe(404)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("answers 502 when Tabroom cannot be reached", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed")
    })
    const res = await proxyTabroomBeta(new Request(`${ORIGIN}/api/tabroom-beta/rest/tourns`), fetchImpl as unknown as typeof fetch)
    expect(res.status).toBe(502)
  })

  it("is read-only and refuses non-public paths without calling Tabroom", async () => {
    const fetchImpl = vi.fn()
    const post = await proxyTabroomBeta(
      new Request(`${ORIGIN}/api/tabroom-beta/rest/tourns`, { method: "POST" }),
      fetchImpl as unknown as typeof fetch,
    )
    expect(post.status).toBe(405)
    const other = await proxyTabroomBeta(new Request(`${ORIGIN}/api/tabroom-beta/user/login`), fetchImpl as unknown as typeof fetch)
    expect(other.status).toBe(404)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
