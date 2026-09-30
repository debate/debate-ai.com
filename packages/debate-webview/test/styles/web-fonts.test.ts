/** @vitest-environment jsdom */
/**
 * @fileoverview Pins that the Google webfonts stay off the render-blocking
 * path: attached as `media="print"` links that switch to `all` on load, once
 * each, by both the head script and `loadWebFonts`.
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it } from "vitest"

import { WEB_FONT_STYLESHEETS, loadWebFonts, webFontsBootstrapScript } from "../../src/styles/web-fonts"

const fontLinks = () => [...document.querySelectorAll<HTMLLinkElement>("link[data-web-font]")]

describe("web fonts", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
  })

  it("attaches each stylesheet once, non-blocking, switching to all media on load", () => {
    loadWebFonts()
    loadWebFonts()
    const links = fontLinks()
    expect(links.map((l) => l.href)).toEqual([...WEB_FONT_STYLESHEETS])
    expect(links.every((l) => l.media === "print")).toBe(true)
    links[0].dispatchEvent(new Event("load"))
    expect(links[0].media).toBe("all")
  })

  it("the head script attaches the same links, and loadWebFonts doesn't repeat them", () => {
    new Function(webFontsBootstrapScript())()
    loadWebFonts()
    const links = fontLinks()
    expect(links.map((l) => l.href)).toEqual([...WEB_FONT_STYLESHEETS])
    links[1].dispatchEvent(new Event("load"))
    expect(links[1].media).toBe("all")
  })

  it("app.css no longer imports them (a remote @import blocks first paint)", () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../src/styles/app.css"), "utf8")
    expect(css).not.toMatch(/@import\s+url\(["']?https:/)
  })
})
