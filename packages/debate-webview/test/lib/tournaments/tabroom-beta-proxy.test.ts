import { describe, expect, it, vi } from "vitest"

import { proxyTabroomBeta, tabroomBetaUpstreamUrl, tabroomSidebarTournId } from "../../../src/lib/tournaments/tabroom-beta-proxy"

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

describe("tabroom sidebar", () => {
  const page = `<div class="menu"><div class="sidenote"><h6>Circuits</h6><a href="/index/circuit/index.mhtml?circuit_id=6">NatCir &ndash; National Circuit</a>
    <a href="/index/tourn/past.mhtml?webname=heartoftx">Past Years' Editions</a></div>
    <div class="sidenote"><h4>Dates &amp; Deadlines</h4><span class="fifth explain">CDT</span>
    <div class="row flexrow"><span>Registration Closes</span><span>Thu Oct 15 at 3:00 PM</span></div></div></div><div id="footer"></div>`

  it("only matches /sidebar/<numeric id>", () => {
    expect(tabroomSidebarTournId(`${ORIGIN}/api/tabroom-beta/sidebar/40242`)).toBe(40242)
    expect(tabroomSidebarTournId(`${ORIGIN}/api/tabroom-beta/sidebar/abc`)).toBeNull()
    expect(tabroomSidebarTournId(`${ORIGIN}/api/tabroom-beta/sidebar/1/x`)).toBeNull()
  })

  it("scrapes the classic invite page into cached JSON", async () => {
    const fetchImpl = vi.fn(async () => new Response(page, { headers: { "content-type": "text/html" } }))
    const res = await proxyTabroomBeta(
      new Request(`${ORIGIN}/api/tabroom-beta/sidebar/40242`, { headers: { cookie: "session=secret" } }),
      fetchImpl as unknown as typeof fetch,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("max-age=600")
    expect(await res.json()).toEqual({
      groups: [{ title: "Circuits", links: [{ label: "NatCir – National Circuit", href: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=6" }] }],
      pastEditions: "https://www.tabroom.com/index/tourn/past.mhtml?webname=heartoftx",
      deadlines: [{ label: "Registration Closes", value: "Thu Oct 15 at 3:00 PM" }],
      tz: "CDT",
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://www.tabroom.com/index/tourn/main.mhtml?tourn_id=40242")
    expect(new Headers(init.headers).get("cookie")).toBeNull()
  })

  it("answers 502 uncached when Tabroom fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 500 }))
    const res = await proxyTabroomBeta(new Request(`${ORIGIN}/api/tabroom-beta/sidebar/40242`), fetchImpl as unknown as typeof fetch)
    expect(res.status).toBe(502)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
