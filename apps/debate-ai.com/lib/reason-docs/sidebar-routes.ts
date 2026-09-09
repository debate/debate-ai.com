/**
 * @fileoverview Which routes carry the REASON docs panels in the app sidebar,
 * and which route trims that sidebar down to them.
 *
 * The Files / Topics / Tabs panels used to ride in every sidebar, `/videos`
 * included. That put a document tree above the video library's own nav, where
 * it has nothing to do with the page: on `/videos` the sidebar should be the
 * videos. The panels now show only where the documents are the point —
 * `/cards`, the dock's "Shared" destination, and `/reason-editor`, whose
 * desktop file navigation *is* this sidebar (the editor route has no `<aside>`
 * of its own; see `AppSidebarShell`).
 *
 * Prefix-matched, so a page one level down (`/cards/library`) is the same
 * destination and keeps the panels. Kept next to `route-selection.ts` — the
 * other pure module the docs sidebar is built on — so it can be unit-tested
 * without rendering the sidebar.
 *
 * @module lib/reason-docs/sidebar-routes
 */

import { REASON_EDITOR_ROUTE } from "./route-selection"

/** The dock's "Shared" destination — the cards subtree. */
export const CARDS_ROUTE = "/cards"

/** The route subtrees whose sidebar shows the docs panels, in sidebar order. */
export const REASON_DOCS_SIDEBAR_ROOTS: readonly string[] = [CARDS_ROUTE, REASON_EDITOR_ROUTE]

/**
 * Normalizes a pathname for prefix matching: a query string, a hash and a
 * trailing slash are ignored, so the dock's own `/cards?...` and `/cards/`
 * forms resolve the same as `/cards` — the dock hops by `history.pushState`,
 * so this reads whatever it last wrote.
 */
function normalize(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? ""
  return withoutQuery.replace(/\/+$/, "") || "/"
}

/** True when `normalized` is `root` or a page below it. */
function isUnder(normalized: string, root: string): boolean {
  return normalized === root || normalized.startsWith(`${root}/`)
}

/** True when `pathname` sits in one of {@link REASON_DOCS_SIDEBAR_ROOTS}. */
export function showsReasonDocsPanels(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const normalized = normalize(pathname)
  return REASON_DOCS_SIDEBAR_ROOTS.some((root) => isUnder(normalized, root))
}

/**
 * True in the `/cards` subtree, where the sidebar is *only* the document
 * panels and the Research tool list.
 *
 * Clicking Cards in the dock used to land you on a column carrying the docs
 * panels, the whole Apps/Coaching/Research/Practice tree, the glossary and
 * rankings links and the site footer — four navigations stacked on a page
 * about one of them. On this subtree the tree is narrowed to Research (the
 * section that actually lists the cards pages) and the footer is dropped; the
 * dock stays, since it is what you clicked Cards in and what takes you back to
 * videos. `/reason-editor` keeps the full tree — it is reached *from* those
 * other sections, not one of them.
 */
export function showsCardsOnlySidebar(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return isUnder(normalize(pathname), CARDS_ROUTE)
}
