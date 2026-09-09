/**
 * @fileoverview Which routes carry the REASON docs panels in the app sidebar.
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

/** The route subtrees whose sidebar shows the docs panels, in sidebar order. */
export const REASON_DOCS_SIDEBAR_ROOTS: readonly string[] = ["/cards", REASON_EDITOR_ROUTE]

/**
 * True when `pathname` sits in one of {@link REASON_DOCS_SIDEBAR_ROOTS}.
 *
 * A query string and a trailing slash are ignored, so the dock's own
 * `/cards?...` and `/cards/` forms resolve the same as `/cards` — the dock
 * hops by `history.pushState`, so this reads whatever it last wrote.
 */
export function showsReasonDocsPanels(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? ""
  const normalized = withoutQuery.replace(/\/+$/, "") || "/"
  return REASON_DOCS_SIDEBAR_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  )
}
