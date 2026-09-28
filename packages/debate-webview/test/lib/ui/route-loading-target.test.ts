/**
 * @fileoverview The link rules that arm the global loading overlay.
 *
 * Too eager and the overlay is armed for a click that never changes
 * `pathname`, so it hangs on until the safety timeout; too shy and a slow
 * page transition shows nothing at all.
 */

import { describe, it, expect } from "vitest"

import { isSamePage, routeLoadingTarget } from "../../../src/lib/ui/route-loading-target"

const ORIGIN = "https://debate-ai.com"
const HERE = `${ORIGIN}/coach?tab=1`

describe("routeLoadingTarget", () => {
  it("arms for another page of this app", () => {
    expect(routeLoadingTarget({ href: "/drills" }, HERE)).toBe("/drills")
    expect(routeLoadingTarget({ href: `${ORIGIN}/judges?x=1#y` }, HERE)).toBe("/judges")
    expect(routeLoadingTarget({ href: "/docs/features" }, HERE)).toBe("/docs/features")
  })

  it("arms for an explicit _self target", () => {
    expect(routeLoadingTarget({ href: "/drills", target: "_self" }, HERE)).toBe("/drills")
  })

  it("ignores the page already showing, whatever its query or hash", () => {
    expect(routeLoadingTarget({ href: "/coach" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "/coach/" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "/coach?tab=2" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "#section" }, HERE)).toBeNull()
  })

  it("ignores links that leave this document or never unload it", () => {
    expect(routeLoadingTarget({ href: "/drills", target: "_blank" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "/drills", download: true }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "https://example.com/x" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "mailto:a@b.c" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "javascript:void(0)" }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "/api/export" }, HERE)).toBeNull()
  })

  it("ignores an anchor with no href", () => {
    expect(routeLoadingTarget({ href: null }, HERE)).toBeNull()
    expect(routeLoadingTarget({ href: "" }, HERE)).toBeNull()
  })

  it("resolves a relative href against the current page", () => {
    expect(routeLoadingTarget({ href: "lectures" }, `${ORIGIN}/videos/`)).toBe("/videos/lectures")
  })

  it("does not mistake an /api-prefixed page for /api", () => {
    expect(routeLoadingTarget({ href: "/api-docs" }, HERE)).toBe("/api-docs")
  })
})

describe("isSamePage", () => {
  it("ignores a trailing slash", () => {
    expect(isSamePage("/cards/", "/cards")).toBe(true)
    expect(isSamePage("/", "/")).toBe(true)
    expect(isSamePage("/cards", "/videos")).toBe(false)
  })
})
