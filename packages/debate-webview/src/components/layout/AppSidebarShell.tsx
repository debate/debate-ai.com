"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { ResizableSidebarLayout, ToolNavTree, ToolSidebarFooter } from "debate-videos"
import { CategoryDock } from "./CategoryDock"
import { ReasonDocsSidebarPanels } from "../reason-docs/ReasonDocsSidebarPanels"
import { ChromeErrorBoundary } from "../../lib/ui/layout/chrome-error-boundary"
import { isGenericToolSidebarRoute } from "../../lib/sidebar-routes"
import { showsReasonDocsPanels } from "../../lib/reason-docs/sidebar-routes"

/**
 * Mirrors the persistent left sidebar the `/videos` pages render
 * (`LecturesVideoGridView`'s `<aside>`, dock + `ToolNavTree`) on every other
 * page that sidebar's Apps/Coaching/Research/Practice tree links to.
 *
 * Without this, following one of those links off `/videos` (e.g. into
 * `/coach` or `/practice-round`) landed on a page with no sidebar at all —
 * the nav just disappeared instead of staying available for the next hop.
 * Mounted once in the root layout, it wraps every page whose path matches a
 * tree entry in the same sidebar so the nav — and the embedded dock at its
 * top — stays on screen everywhere it points, not only on `/videos`.
 *
 * On the document routes it also carries the REASON docs panels ported from
 * quick search's REASON editor sidebar — the folder/file tree, topic starters
 * and the "Open Tabs" list. They live here rather than in `/reason-editor`'s
 * own `<aside>` — which this shell already wrapped, so that page rendered two
 * sidebars side by side. Only `/cards` and `/reason-editor` get them
 * (`showsReasonDocsPanels`): everywhere else the sidebar is that page's own
 * nav, and on `/videos` — which keeps its own sidebar and so is not wrapped by
 * this shell at all — it is the video library
 * (see `packages/debate-help-docs/content/docs/internals/reason-docs-sidebar.mdx`).
 *
 * `/debate` and `/doc` are the two tree destinations this shell deliberately
 * skips (`ownsItsLayout`, in debate-videos' `sidebar-routes`), both because
 * they already fill the viewport with a sidebar of their own and wrapping
 * them here put two sidebars side by side.
 *
 * `/debate` is the flow workspace, with its own top bar and flows/rounds
 * sidebar; it keeps `CategoryDock`'s floating instance, since there is no
 * column left to host one. `/doc` is the REASON research workspace, whose
 * sidebar is the files tree and the "Open Tabs" list — and that one *does*
 * host the dock, at the top of its own column
 * (`components/qwksearch/SidebarWithAppDock`), so the floating instance stays
 * suppressed there (`hostsOwnSidebarDock`). The docs panels below are for
 * `/cards` and `/reason-editor`, which read documents out of this app's own
 * store rather than the editor's.
 */
export function AppSidebarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (!isGenericToolSidebarRoute(pathname)) return <>{children}</>

  return (
    // The shared drag-resizable column (`ResizableSidebarLayout`, from
    // debate-videos): the same width, handle and saved size as the `/videos`
    // sidebar, so the column keeps its shape as you cross between them.
    // `min-w-0` inside it plus the dock's own `fluid` sizing keep every child
    // bound to this column: the dock is sized to the sidebar rather than to
    // its own contents, so it can't reach across the border onto the page —
    // a CardMirror editor, on `/reason-editor` and `/doc`.
    <ResizableSidebarLayout
      appChrome
      sidebar={
        <>
          {/* Each region is bounded separately. This whole `<aside>` renders
              from the root layout, so before the boundaries a throw in any one
              of these unmounted the entire document — and on the server failed
              the render, answering 500 with no shell and no page (see
              `chrome-error-boundary.tsx`). Now the sidebar loses the panel that
              broke and keeps the rest, and the page below renders either way. */}
          <ChromeErrorBoundary label="CategoryDock">
            <CategoryDock embedded />
          </ChromeErrorBoundary>
          {/* Above the nav tree rather than below it: the tree is long enough
              (a section auto-expands to show where you are) that anything under
              it starts below the fold, and on /reason-editor these panels are
              the page's primary navigation. Absent entirely on the routes that
              are about something else, so their sidebar is only their own nav. */}
          {showsReasonDocsPanels(pathname) && (
            <ChromeErrorBoundary label="ReasonDocsSidebarPanels">
              <ReasonDocsSidebarPanels className="shrink-0" />
            </ChromeErrorBoundary>
          )}
          <ChromeErrorBoundary label="ToolNavTree">
            <ToolNavTree />
            <ToolSidebarFooter />
          </ChromeErrorBoundary>
        </>
      }
    >
      {children}
    </ResizableSidebarLayout>
  )
}
