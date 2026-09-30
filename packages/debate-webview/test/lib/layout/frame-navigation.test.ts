/**
 * @fileoverview The shell's link rules: which clicks belong to the browser,
 * and which links out of /docs must be a real page load.
 */

import { describe, it, expect } from "vitest"

import { docsExitTarget, isDocsPath, opensElsewhere } from "../../../src/lib/layout/frame-navigation"

const ORIGIN = "https://debate-ai.com"

const plainClick = {
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  button: 0,
}

/** As the DOM reports it: `href` on an anchor resolves against the document. */
function anchor(path: string, extra: { target?: string; download?: boolean } = {}) {
  return { href: new URL(path, ORIGIN).href, ...extra }
}

describe("opensElsewhere", () => {
  it("leaves a plain primary click to be intercepted", () => {
    expect(opensElsewhere(plainClick)).toBe(false)
  })

  it("hands every modified click and middle-click back to the browser", () => {
    expect(opensElsewhere({ ...plainClick, metaKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, ctrlKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, shiftKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, altKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, button: 1 })).toBe(true)
  })
})

describe("isDocsPath", () => {
  it("matches the docs root and everything under it", () => {
    expect(isDocsPath("/docs")).toBe(true)
    expect(isDocsPath("/docs/features/timer")).toBe(true)
  })

  it("does not match a path that only starts with the same letters", () => {
    expect(isDocsPath("/docsearch")).toBe(false)
    expect(isDocsPath("/videos")).toBe(false)
    expect(isDocsPath(null)).toBe(false)
  })
})

describe("docsExitTarget", () => {
  it("turns a link from /docs to an app page into a full load", () => {
    expect(docsExitTarget(anchor("/videos?x=1"), ORIGIN)).toBe(`${ORIGIN}/videos?x=1`)
  })

  it("leaves links within /docs, off-site, new-tab and download links alone", () => {
    expect(docsExitTarget(anchor("/docs/features"), ORIGIN)).toBeNull()
    expect(docsExitTarget({ href: "https://example.com/" }, ORIGIN)).toBeNull()
    expect(docsExitTarget(anchor("/videos", { target: "_blank" }), ORIGIN)).toBeNull()
    expect(docsExitTarget(anchor("/videos", { download: true }), ORIGIN)).toBeNull()
    expect(docsExitTarget({ href: null }, ORIGIN)).toBeNull()
  })
})
