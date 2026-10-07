"use client"

import { usePathname } from "next/navigation"
import { LibrarySidebarTree } from "@debate/videos"

import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { showsCardsOnlySidebar, showsReasonDocsPanels } from "../../../lib/reason-docs/sidebar-routes"
import { isDocsPath } from "../../../lib/layout/frame-navigation"
import { CategoryDock } from "../CategoryDock"
import { ReasonDocsSidebarPanels } from "../../reason-docs/ReasonDocsSidebarPanels"

/**
 * Where the help docs (`debate-help-docs`' docs layout) portal their page
 * tree into this column on `/docs`, so the docs' navigation is a section of
 * the app sidebar rather than a second sidebar beside it.
 */
export const DOCS_SIDEBAR_SLOT_ID = "app-sidebar-docs-slot"

/**
 * The contents of the app's sidebar column (`AppSidebarShell`): the same
 * dock and tree the `/videos` column holds, with whatever the page needs
 * merged in as sections of it. Each region renders in its own error boundary
 * — this renders from the root layout, so a throw in any one region must
 * cost only that region, not the page (see `chrome-error-boundary.tsx`):
 *
 * - **The embedded dock** at the top, sticky as the column scrolls.
 * - **The REASON docs panels** on `/research/cards` and `/reason-editor`
 *   (`showsReasonDocsPanels`). On `/research/cards` they are the whole column
 *   (`showsCardsOnlySidebar`): no tree, and the panels
 *   `fill` the leftover height so each scrolls inside its own share.
 * - **The help docs' page tree** on `/docs` ({@link DOCS_SIDEBAR_SLOT_ID}).
 * - **The library tree** — Round Videos, Lectures and the tool sections —
 *   everywhere else. The site links that used to sit under it as a footer
 *   row are a submenu of the account menu now (`nav-user.tsx`).
 */
export function AppSidebar() {
  const pathname = usePathname()
  const cardsOnly = showsCardsOnlySidebar(pathname)

  return (
    <>
      <ChromeErrorBoundary label="CategoryDock">
        <CategoryDock embedded />
      </ChromeErrorBoundary>
      {showsReasonDocsPanels(pathname) && (
        <div className={cardsOnly ? "flex min-h-0 flex-1 flex-col" : undefined}>
          <ChromeErrorBoundary label="ReasonDocsSidebarPanels">
            <ReasonDocsSidebarPanels className={cardsOnly ? "min-h-0 flex-1" : "shrink-0"} fill={cardsOnly} />
          </ChromeErrorBoundary>
        </div>
      )}
      {isDocsPath(pathname) && <div id={DOCS_SIDEBAR_SLOT_ID} className="shrink-0" />}
      {!cardsOnly && (
        <ChromeErrorBoundary label="LibrarySidebarTree">
          <LibrarySidebarTree />
        </ChromeErrorBoundary>
      )}
    </>
  )
}
