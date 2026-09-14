/**
 * @fileoverview The mobile-coverage guard: every destination the desktop
 * sidebar links to is reachable from the app dock's Settings menu.
 *
 * Below `md` the sidebar does not render at all, so that menu is the whole
 * navigation. It used to be a hand-kept list, which is how the sidebar's
 * Videos section and its glossary/rankings pair ended up on desktop only.
 * These tests fail if a link is ever added to the sidebar tree without
 * reaching the menu.
 *
 * They also pin what the menu deliberately does *not* carry: no "Apps"
 * section restating the dock's icons and the whole feature catalog, with
 * `/features` and `/docs` reached as single rows instead.
 */

import { describe, it, expect } from "vitest"
import {
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
} from "debate-videos/src/components/category-gallery/sidebar-tool-sections"
import { SIDEBAR_VIDEO_LINKS } from "debate-videos/src/components/category-gallery/sidebar-video-links"
import { FOOTER_LINKS } from "debate-videos/src/ui/layout/footer-links"
import {
  DOCK_MENU_HREFS,
  SIDEBAR_MENU_SECTIONS,
  SITE_LINKS,
  DEBATE_LINKS,
} from "../dock-menu-sections"

describe("SIDEBAR_MENU_SECTIONS", () => {
  it("mirrors the sidebar's sections, in tree order", () => {
    expect(SIDEBAR_MENU_SECTIONS.map((section) => section.id)).toEqual([
      "videos",
      ...SIDEBAR_TOOL_SECTIONS.map((section) => section.id),
    ])
  })

  it("reaches every videos destination the sidebar links to", () => {
    for (const link of SIDEBAR_VIDEO_LINKS) {
      expect(DOCK_MENU_HREFS.has(link.href)).toBe(true)
    }
  })

  it("reaches every tool the nav tree links to", () => {
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      // The section's flagship tool is always listed inside it as well.
      expect(DOCK_MENU_HREFS.has(section.href)).toBe(true)
      for (const tool of section.tools) {
        expect(DOCK_MENU_HREFS.has(tool.href)).toBe(true)
      }
    }
  })

  it("carries no Apps section restating the dock and the feature catalog", () => {
    // The dock's own five icons sit right beside this menu, and the catalog
    // they belonged to is one `/features` row in Site Links now — not a
    // submenu of per-category submenus inside the Settings menu.
    expect(SIDEBAR_MENU_SECTIONS.some((section) => section.id === "apps")).toBe(false)
    expect(SIDEBAR_MENU_SECTIONS.some((section) => section.title === "Apps")).toBe(false)
  })

  it("still reaches the feature catalog, through the Site Links row", () => {
    expect(SITE_LINKS.map((link) => link.url)).toContain("/features")
    expect(DOCK_MENU_HREFS.has("/features")).toBe(true)
  })

  it("reaches the help docs", () => {
    // `/docs` is the statically exported help site staged at `public/docs`,
    // not a Next route — the menu reaches it as an external-style link.
    expect(SITE_LINKS.map((link) => link.url)).toContain("/docs")
    expect(DOCK_MENU_HREFS.has("/docs")).toBe(true)
  })

  it("drops the rows the menu deliberately no longer carries", () => {
    // `/tools` and its groups: the menu is navigation, and every tool it used
    // to list is already under one of the Coaching / Research / Practice
    // submenus.
    expect(DOCK_MENU_HREFS.has(TOOLS_ROOT_HREF)).toBe(false)
  })

  it("carries every footer link across its two external submenus", () => {
    const external = [...SITE_LINKS, ...DEBATE_LINKS]
    expect(external).toHaveLength(FOOTER_LINKS.length)
    for (const link of FOOTER_LINKS) {
      expect(DOCK_MENU_HREFS.has(link.url)).toBe(true)
    }
    // Each link belongs to exactly one submenu.
    expect(SITE_LINKS.some((link) => DEBATE_LINKS.includes(link))).toBe(false)
  })

  it("gives every section a title, an icon, and at least one link", () => {
    for (const section of SIDEBAR_MENU_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0)
      expect(section.icon).toBeTruthy()
      expect(section.links.length).toBeGreaterThan(0)
      for (const link of section.links) {
        expect(link.href.startsWith("/")).toBe(true)
        expect(link.title.length).toBeGreaterThan(0)
      }
    }
  })

  it("does not repeat a destination inside one section's rows", () => {
    for (const section of SIDEBAR_MENU_SECTIONS) {
      const hrefs = section.links.map((link) => link.href)
      expect(new Set(hrefs).size).toBe(hrefs.length)
    }
  })
})
