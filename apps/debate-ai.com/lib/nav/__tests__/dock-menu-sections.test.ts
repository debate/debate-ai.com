/**
 * @fileoverview The mobile-coverage guard: every destination the desktop
 * sidebar links to is reachable from the app dock's Settings menu.
 *
 * Below `md` the sidebar does not render at all, so that menu is the whole
 * navigation. It used to be a hand-kept list, which is how the sidebar's
 * Videos section and its glossary/rankings pair ended up on desktop only.
 * These tests fail if a link is ever added to the sidebar tree without
 * reaching the menu.
 */

import { describe, it, expect } from "vitest"
import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
} from "debate-videos/src/components/category-gallery/sidebar-tool-sections"
import { APP_FEATURES } from "../../ui/features/feature-catalog"
import { SIDEBAR_VIDEO_LINKS } from "debate-videos/src/components/category-gallery/sidebar-video-links"
import { FOOTER_LINKS } from "debate-videos/src/ui/layout/footer-links"
import {
  DOCK_MENU_HREFS,
  SIDEBAR_MENU_SECTIONS,
  SITE_LINKS,
  DEBATE_LINKS,
} from "../dock-menu-sections"

/** The two surfaces `dock-menu-sections.ts` keeps out of the menu. */
const MENU_EXCLUDED_HREFS = new Set(["/contacts", "/notifications"])

describe("SIDEBAR_MENU_SECTIONS", () => {
  it("mirrors the sidebar's sections, in tree order", () => {
    expect(SIDEBAR_MENU_SECTIONS.map((section) => section.id)).toEqual([
      "videos",
      "apps",
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

  it("lists the dock's own destinations as text rows too", () => {
    // The dock icons label themselves on hover, which a touch device never
    // fires — so the same five destinations are spelled out in the menu.
    const apps = SIDEBAR_MENU_SECTIONS.find((section) => section.id === "apps")!
    const appsRows = apps.links.map((link) => link.href)
    for (const link of APP_DOCK_LINKS) {
      expect(appsRows).toContain(link.href)
    }
  })

  it("carries the whole feature catalog under Apps, grouped by category", () => {
    const apps = SIDEBAR_MENU_SECTIONS.find((section) => section.id === "apps")!
    expect(apps.links[0]).toEqual({ href: "/features", title: "All Features" })
    expect(apps.groups?.length).toBeGreaterThan(0)

    const grouped = new Set(apps.groups!.flatMap((group) => group.links.map((link) => link.href)))
    for (const feature of APP_FEATURES) {
      if (MENU_EXCLUDED_HREFS.has(feature.href)) continue
      expect(grouped.has(feature.href)).toBe(true)
    }
    // One entry per category, and no category listed twice.
    const ids = apps.groups!.map((group) => group.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("drops the rows the menu deliberately no longer carries", () => {
    // `/tools` and its groups, plus the contacts list and the notification
    // inbox: the menu is navigation, and every tool it used to list is
    // already under one of the Coaching / Research / Practice submenus.
    expect(DOCK_MENU_HREFS.has(TOOLS_ROOT_HREF)).toBe(false)
    for (const href of MENU_EXCLUDED_HREFS) {
      expect(DOCK_MENU_HREFS.has(href)).toBe(false)
    }
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
      for (const group of section.groups ?? []) {
        const groupHrefs = group.links.map((link) => link.href)
        expect(new Set(groupHrefs).size).toBe(groupHrefs.length)
      }
    }
  })
})
