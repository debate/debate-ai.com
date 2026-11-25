/**
 * @fileoverview Pins which clicks count as a page navigation for the fade and
 * the slow-navigation loader: a plain click on a same-origin link to another
 * page does; new-tab clicks, other origins, downloads and same-page links
 * don't.
 */

import { describe, expect, it } from "vitest"

import { navigationTargetOf, type NavigationClick } from "../../../src/lib/nav/page-transition"

const here = { origin: "https://debate-ai.com", pathname: "/videos", search: "?tab=all" }

function link(href: string, attrs: Record<string, string> = {}) {
  const absolute = new URL(href, `${here.origin}${here.pathname}${here.search}`).href
  const anchor = {
    href: absolute,
    target: attrs.target ?? "",
    hasAttribute: (name: string) => name in attrs,
    getAttribute: (name: string) => (name === "href" ? href : (attrs[name] ?? null)),
  }
  return { closest: () => anchor } as unknown as EventTarget
}

function click(target: EventTarget | null, overrides: Partial<NavigationClick> = {}): NavigationClick {
  return { button: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target, ...overrides }
}

describe("navigationTargetOf", () => {
  it("returns the path and query of an in-app link to another page", () => {
    expect(navigationTargetOf(click(link("/practice?mode=drill")), here)).toBe("/practice?mode=drill")
    expect(navigationTargetOf(click(link("watch/1")), here)).toBe("/watch/1")
  })

  it("counts a query-only change as a navigation", () => {
    expect(navigationTargetOf(click(link("/videos?tab=lectures")), here)).toBe("/videos?tab=lectures")
  })

  it("ignores the page the reader is already on, and hash jumps", () => {
    expect(navigationTargetOf(click(link("/videos?tab=all")), here)).toBeNull()
    expect(navigationTargetOf(click(link("/videos?tab=all#top")), here)).toBeNull()
    expect(navigationTargetOf(click(link("#top")), here)).toBeNull()
  })

  it("ignores clicks that open a new tab or window", () => {
    for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const) {
      expect(navigationTargetOf(click(link("/practice"), { [mod]: true }), here)).toBeNull()
    }
    expect(navigationTargetOf(click(link("/practice"), { button: 1 }), here)).toBeNull()
    expect(navigationTargetOf(click(link("/practice", { target: "_blank" })), here)).toBeNull()
  })

  it("ignores other origins, downloads, non-web links and opted-out links", () => {
    expect(navigationTargetOf(click(link("https://example.com/x")), here)).toBeNull()
    expect(navigationTargetOf(click(link("/file.docx", { download: "" })), here)).toBeNull()
    expect(navigationTargetOf(click(link("mailto:a@b.c")), here)).toBeNull()
    expect(navigationTargetOf(click(link("/practice", { "data-no-page-transition": "" })), here)).toBeNull()
  })

  it("ignores clicks that aren't on a link", () => {
    expect(navigationTargetOf(click({ closest: () => null } as unknown as EventTarget), here)).toBeNull()
    expect(navigationTargetOf(click(null), here)).toBeNull()
  })
})
