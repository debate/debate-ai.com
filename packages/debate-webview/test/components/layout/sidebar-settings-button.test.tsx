/**
 * @fileoverview The sidebar's Settings button: an icon link beside the
 * hide-sidebar button that opens the settings tab for the current page, and
 * no Docs link pinned next to it (docs are a section of the tree now).
 */

import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const nav = vi.hoisted(() => ({ pathname: "/videos" }))

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}))

import { SidebarSettingsButton } from "../../../src/components/layout/app-sidebar/sidebar-settings-button"
import { SETTINGS_ROUTE, settingsHrefForPath } from "@debate-ai/qwksearch/lib/settings-paths"

describe("SidebarSettingsButton", () => {
  it("is an icon-only Settings link with no pinned Docs link", () => {
    nav.pathname = "/videos"
    const html = renderToStaticMarkup(<SidebarSettingsButton />)
    expect(html).toContain(`href="${SETTINGS_ROUTE}"`)
    expect(html).toContain('aria-label="Settings"')
    expect(html).not.toContain(">Settings<")
    expect(html).not.toContain('href="/docs"')
  })

  it("spells the word out with label", () => {
    const html = renderToStaticMarkup(<SidebarSettingsButton label />)
    expect(html).toContain(">Settings</a>")
  })

  it("points Settings at the tab for the current page", () => {
    nav.pathname = "/research"
    const html = renderToStaticMarkup(<SidebarSettingsButton />)
    expect(html).toContain(`href="${settingsHrefForPath("/research").replace(/&/g, "&amp;")}"`)
  })
})
