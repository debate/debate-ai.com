/**
 * @fileoverview Pins the first-sign-in welcome's link rows:
 * the key links it outlines (docs, practice debates, videos),
 * the NDT 2015 Finals practice debate it suggests, and that
 * in-app routes stay router links while `/docs` — the one
 * in-app-looking URL with its own stylesheet — takes a real
 * page load.
 */

import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import {
  WELCOME_LINKS,
  WelcomeLinkList,
} from "../../../src/components/layout/FirstLoginWelcomeDialog"

describe("WELCOME_LINKS", () => {
  it("outlines the docs, practice debates and videos", () => {
    expect(WELCOME_LINKS.map((link) => link.href)).toEqual(
      expect.arrayContaining(["/docs", "/debate", "/videos"]),
    )
  })

  it("suggests the NDT 2015 Finals practice debate by its featured slug", () => {
    const ndtFinals = WELCOME_LINKS.find((link) => link.featured)
    expect(ndtFinals?.href).toBe("/debate/2015-ndt/northwestern-mv-michigan-ap")
    expect(ndtFinals?.label).toContain("NDT 2015 Finals")
  })
})

describe("WelcomeLinkList", () => {
  const html = renderToStaticMarkup(<WelcomeLinkList />)

  it("prints every key link's row", () => {
    for (const link of WELCOME_LINKS) {
      expect(html).toContain(`href="${link.href}"`)
      expect(html).toContain(link.label)
      expect(html).toContain(link.description)
    }
  })

  it("follows in-app routes in place, so the shell survives the hop", () => {
    // A router link renders a plain same-origin anchor; an absolute
    // URL would tear the app down and lose the sidebar and player.
    expect(html).toContain('href="/debate"')
    expect(html).toContain('href="/videos"')
    expect(html).not.toContain('href="http://localhost:3000/')
  })

  it("loads /docs as a real page, since the help site has its own chrome", () => {
    expect(html).toContain('href="/docs" target="_self"')
  })

  it("marks the NDT 2015 Finals row as the featured suggestion", () => {
    // The featured row carries the highlighted styling.
    expect(html).toContain("border-primary/30")
    expect(html).toContain("bg-primary/5")
  })
})
