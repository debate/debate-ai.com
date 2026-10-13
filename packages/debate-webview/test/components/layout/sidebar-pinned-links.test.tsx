/**
 * @fileoverview Pins the sidebar's always-visible foot links: Docs (a real
 * page load to `/docs`) and Settings (the tab that fits the current page),
 * rendered with no menu opened.
 */

import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const nav = vi.hoisted(() => ({ pathname: "/videos" }))

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}))

import { SidebarPinnedLinks } from "../../../src/components/layout/app-sidebar/sidebar-pinned-links"
import { SETTINGS_ROUTE, settingsHrefForPath } from "../../../src/lib/qwksearch/settings-paths"

describe("SidebarPinnedLinks", () => {
  it("shows Docs and Settings without opening a menu", () => {
    nav.pathname = "/videos"
    const html = renderToStaticMarkup(<SidebarPinnedLinks />)
    expect(html).toContain('href="/docs"')
    expect(html).toContain(">Docs<")
    expect(html).toContain(`href="${SETTINGS_ROUTE}"`)
    expect(html).toContain(">Settings<")
  })

  it("points Settings at the tab for the current page", () => {
    nav.pathname = "/research"
    const html = renderToStaticMarkup(<SidebarPinnedLinks />)
    expect(html).toContain(`href="${settingsHrefForPath("/research").replace(/&/g, "&amp;")}"`)
  })
})
