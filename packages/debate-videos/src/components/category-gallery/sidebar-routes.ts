/**
 * @fileoverview Which routes get the tool sidebar — the `ToolNavTree` above
 * plus the app dock hosted at the top of the same column — derived straight
 * from the link data the tree itself renders so the two can never drift.
 *
 * Lives in this package, next to that data, rather than in the app: the app's
 * `lib/sidebar-routes.ts` is a thin re-export, and keeping the predicates
 * here is what makes them testable (`apps/*` is outside the Vitest projects
 * glob, `packages/*` is not).
 *
 * @module components/category-gallery/sidebar-routes
 */

import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
} from "./sidebar-tool-sections";

/** Every destination the tool sidebar links to, deduplicated. */
export const TOOL_SIDEBAR_HREFS: ReadonlySet<string> = new Set<string>([
  TOOLS_ROOT_HREF,
  ...APP_DOCK_LINKS.map((link) => link.href),
  ...SIDEBAR_TOOL_SECTIONS.flatMap((section) => [
    section.href,
    ...section.tools.map((tool) => tool.href),
  ]),
]);

/**
 * True when `pathname` is one of the sidebar's destinations or sits beneath
 * one.
 *
 * The prefix half matters: a nested route under a tree entry (`/cards/awards`
 * under `/cards`, a document route under `/doc`) is the same destination one
 * level down, and matching exact paths only left those pages with the app
 * dock's fixed top-left instance floating over their content instead of a
 * dock inside a sidebar — over a CardMirror editor, in the `/doc` and
 * `/reason-editor` subtrees. The trailing `/` in the comparison keeps `/docs`
 * from matching `/doc`.
 */
export function matchesToolSidebarHref(pathname: string): boolean {
  if (TOOL_SIDEBAR_HREFS.has(pathname)) return true;
  for (const href of TOOL_SIDEBAR_HREFS) {
    if (pathname.startsWith(`${href}/`)) return true;
  }
  return false;
}

/**
 * True on `/videos` (which renders its own full sidebar, dock included) and
 * on every page the tool-nav tree links to (which the app's
 * `AppSidebarShell` wraps in the generic sidebar) — i.e. every route with a
 * sidebar-hosted dock already on screen, so `CategoryDock`'s fixed top-left/
 * bottom instance should stay hidden rather than show twice.
 */
export function hasEmbeddedDock(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/videos") || matchesToolSidebarHref(pathname);
}

/**
 * True only for the generic tool pages — not `/videos` itself, which already
 * renders its own sidebar and would otherwise get two.
 */
export function isGenericToolSidebarRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/videos")) return false;
  return matchesToolSidebarHref(pathname);
}
