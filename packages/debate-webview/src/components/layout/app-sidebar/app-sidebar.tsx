"use client"

import { usePathname } from "next/navigation"
import { LibrarySidebarTree } from "@debate-ai/videos"

import { ChromeErrorBoundary } from "../../../lib/ui/layout/chrome-error-boundary"
import { showsCardsPagePanel, showsReasonDocsPanels } from "@debate-ai/reason-docs/lib/reason-docs/sidebar-routes"
import { isDocsPath } from "../../../lib/layout/frame-navigation"
import { CategoryDock } from "../CategoryDock"
import { ReasonDocsSidebarPanels } from "@debate-ai/reason-docs/docs/ReasonDocsSidebarPanels"

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
 * - **The REASON docs panels** on `/reason-editor` (`showsReasonDocsPanels`).
 *   There they are the whole column below the dock: Topic Starters and My
 *   Personal Documents fill its height and the library tree is not drawn, so
 *   the documents are all the sidebar shows. The dock above stays as the way
 *   back to every other destination, whose sidebar is the full tree again.
 *   `/research/cards` opens the panels as a second column inside the page
 *   instead (`showsCardsPagePanel`), so this column stays the same there as
 *   on every other destination.
 * - **The library tree** — Videos (Lectures is one of its rows) and the tool
 *   sections — on every route but `/reason-editor`. The site links that used to sit under it as a footer
 *   row are a submenu of the account menu now (`nav-user.tsx`).
 * - **The help docs' page tree** on `/docs` ({@link DOCS_SIDEBAR_SLOT_ID}),
 *   at the bottom of the column, below the tool sections' Insights
 *   category. Off /docs the tree ends in a collapsed "Docs" section listing
 *   every docs page instead (`DocsNavTree`); Settings is a button beside the
 *   hide-sidebar button (`SidebarSettingsButton`).
 */
export function AppSidebar() {
  const pathname = usePathname()
  const docsPanels = showsReasonDocsPanels(pathname) && !showsCardsPagePanel(pathname)

  return (
    <>
      <ChromeErrorBoundary label="CategoryDock">
        <CategoryDock embedded />
      </ChromeErrorBoundary>
      {docsPanels && (
        <ChromeErrorBoundary label="ReasonDocsSidebarPanels">
          <ReasonDocsSidebarPanels className="min-h-0 flex-1" fill />
        </ChromeErrorBoundary>
      )}
      {!docsPanels && (
        <ChromeErrorBoundary label="LibrarySidebarTree">
          <LibrarySidebarTree />
        </ChromeErrorBoundary>
      )}
      {isDocsPath(pathname) && <div id={DOCS_SIDEBAR_SLOT_ID} className="shrink-0" />}
    </>
  )
}

