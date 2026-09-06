/**
 * @fileoverview Shared predicate for which routes get the videos sidebar's
 * persistent Apps/Coaching/Research/Practice nav tree (`debate-videos`'s
 * `ToolNavTree`) alongside an embedded `CategoryDock`, derived straight from
 * the same link data the tree itself renders so the two can never drift.
 *
 * Used by `CategoryDock` (to suppress its own fixed dock wherever an embedded
 * one is already on screen) and `AppSidebarShell` (to decide whether to wrap
 * a page in the generic sidebar) — see `AppSidebarShell`'s file comment for
 * why this exists.
 */

import { APP_DOCK_LINKS, SIDEBAR_TOOL_SECTIONS } from "debate-videos"

const TOOL_SIDEBAR_HREFS = new Set<string>([
  ...APP_DOCK_LINKS.map((link) => link.href),
  ...SIDEBAR_TOOL_SECTIONS.flatMap((section) => [
    section.href,
    ...section.tools.map((tool) => tool.href),
  ]),
])

/**
 * True on `/videos` (which renders its own full sidebar, dock included) and
 * on every page the tool-nav tree links to (which `AppSidebarShell` wraps in
 * the generic sidebar) — i.e. every route with an embedded dock already on
 * screen, so `CategoryDock`'s fixed top-left/bottom instance should stay
 * hidden rather than show twice.
 */
export function hasEmbeddedDock(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname.startsWith("/videos") || TOOL_SIDEBAR_HREFS.has(pathname)
}

/**
 * True only for the generic tool pages — not `/videos` itself, which already
 * renders its own sidebar and would otherwise get two.
 */
export function isGenericToolSidebarRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname.startsWith("/videos")) return false
  return TOOL_SIDEBAR_HREFS.has(pathname)
}
