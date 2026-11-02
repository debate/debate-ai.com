/**
 * @fileoverview Which routes carry the REASON docs panels, and which of them
 * open the panels as a column inside the page instead of in the app sidebar.
 *
 * The Files / Topics / Tabs panels used to ride in every sidebar, `/videos`
 * included. That put a document tree above the video library's own nav, where
 * it has nothing to do with the page: on `/videos` the sidebar should be the
 * videos. The panels now show only where the documents are the point —
 * `/research/cards`, the dock's "Shared" destination, and `/reason-editor`, whose
 * desktop file navigation *is* this sidebar (the editor route has no `<aside>`
 * of its own; see `AppSidebarShell`).
 *
 * Prefix-matched, so a page one level down (`/research/cards/library`) is the same
 * destination and keeps the panels. Kept next to `route-selection.ts` — the
 * other pure module the docs sidebar is built on — so it can be unit-tested
 * without rendering the sidebar.
 *
 * @module lib/reason-docs/sidebar-routes
 */

import { REASON_EDITOR_ROUTE } from "./route-selection"
import { isTopicDocsPath } from "./topic-doc-paths"

/** The dock's "Shared" destination — the cards subtree. */
export const CARDS_ROUTE = "/research/cards"

/** The route subtrees whose sidebar shows the docs panels, in sidebar order. */
export const REASON_DOCS_SIDEBAR_ROOTS: readonly string[] = [CARDS_ROUTE, REASON_EDITOR_ROUTE]

/**
 * Normalizes a pathname for prefix matching: a query string, a hash and a
 * trailing slash are ignored, so the dock's own `/research/cards?...` and `/research/cards/`
 * forms resolve the same as `/research/cards` — the dock hops by `history.pushState`,
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
  // A topic starter's `/docs/<topic code>/...` address is the editor too.
  return REASON_DOCS_SIDEBAR_ROOTS.some((root) => isUnder(normalized, root)) || isTopicDocsPath(normalized)
}

/**
 * True in the `/research/cards` subtree (the Research Workspace), where the
 * docs panels are the whole app sidebar — the same as `/reason-editor` — and
 * the sidebar is opened on arrival even if the reader had hidden it, so the
 * workspace always starts with Topic Starters and My Personal Documents on
 * screen (`AppSidebarShell`).
 *
 * The panels used to open as a second column inside the page, beside the
 * full Videos / tool tree; two sidebars side by side crowded the search, so
 * the tree now gives way to the documents here.
 */
export function isCardsWorkspacePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return isUnder(normalize(pathname), CARDS_ROUTE)
}
