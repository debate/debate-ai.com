/**
 * @fileoverview The nav sections the app dock's Settings menu shows, derived
 * from the same data the desktop sidebar renders.
 *
 * The sidebar (`AppSidebarShell`'s `<aside>`, and `/videos`'s own) is `md+`
 * only, so on a phone the dock's Settings menu is the whole navigation. It
 * used to carry the `/tools` catalog and the footer links but not the
 * sidebar's Videos section or its glossary/rankings pair, which left those
 * destinations reachable on a desktop and nowhere on a phone. Building the
 * menu out of `debate-videos`' sidebar data instead of a hand-kept copy is
 * what keeps that from happening again — a link added to the tree is in the
 * mobile menu the same day.
 *
 * There is no "Apps" section any more. It was the menu's one catalog — the
 * dock's own five destinations as plain rows, then every surface in
 * `feature-catalog.ts` as a nested submenu per category — which made the
 * Settings menu a second, deeper copy of `/features`. The catalog is reached
 * by the `/features` row in the Site Links submenu instead (see
 * `debate-videos`' `footer-links.ts`), and the dock's five destinations are
 * the dock's five icons, sitting directly beside the menu that listed them.
 *
 * Plain data in `lib/` rather than JSX in the component so
 * `__tests__/dock-menu-sections.test.ts` can assert the coverage directly.
 *
 * @module lib/nav/dock-menu-sections
 */

import { Clapperboard, type LucideIcon } from "lucide-react"
// Deep imports rather than the package root: these three modules are plain
// data (no React, no image assets), which is what lets the Vitest project for
// `lib/` load them in a Node environment.
import { SIDEBAR_TOOL_SECTIONS } from "debate-videos/src/components/category-gallery/sidebar-tool-sections"
import { SIDEBAR_VIDEO_LINKS } from "debate-videos/src/components/category-gallery/sidebar-video-links"
import {
  SITE_FOOTER_LINKS,
  DEBATE_FOOTER_LINKS,
  type FooterLink,
} from "debate-videos/src/ui/layout/footer-links"

export interface DockMenuLink {
  href: string
  title: string
}

export interface DockMenuSection {
  /** Stable id, used as the submenu's React key. */
  id: string
  /** Submenu label — the sidebar heading this section mirrors. */
  title: string
  icon: LucideIcon
  links: DockMenuLink[]
}

/**
 * One submenu per sidebar section, in tree order: Videos, then the
 * Coaching / Research / Practice tool sections.
 */
export const SIDEBAR_MENU_SECTIONS: DockMenuSection[] = [
  {
    id: "videos",
    title: "Videos",
    icon: Clapperboard,
    links: SIDEBAR_VIDEO_LINKS.map(({ href, title }) => ({ href, title })),
  },
  ...SIDEBAR_TOOL_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    icon: section.icon,
    links: section.tools.map(({ href, title }) => ({ href, title })),
  })),
]

/** The footer's own links, split into the menu's two external submenus. */
export const SITE_LINKS: FooterLink[] = SITE_FOOTER_LINKS
export const DEBATE_LINKS: FooterLink[] = DEBATE_FOOTER_LINKS

/** Every destination the Settings menu's sidebar submenus reach. */
export const DOCK_MENU_HREFS: ReadonlySet<string> = new Set<string>([
  ...SIDEBAR_MENU_SECTIONS.flatMap((section) => section.links.map((link) => link.href)),
  ...SITE_LINKS.map((link) => link.url),
  ...DEBATE_LINKS.map((link) => link.url),
])
