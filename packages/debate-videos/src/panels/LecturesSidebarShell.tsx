"use client"

/**
 * @fileoverview The videos sidebar — the app dock, the nav tree and the site
 * footer — wrapped around a `/videos` page that is not the video grid.
 *
 * `LecturesVideoGridView` renders that column itself, with the search
 * controls in it. The glossary (`/videos/dictionary`) and the rankings
 * (`/videos/rankings`) are separate branches of {@link LecturesPage} that
 * returned their content on its own, so following either link *out of* the
 * sidebar left a page with no sidebar to follow the next one from — and no
 * dock either, because `hasEmbeddedDock` reports every `/videos` path as
 * already carrying a sidebar-hosted dock, which is what tells the app's
 * `CategoryDock` to keep its fixed top-left instance hidden. The result was
 * two destinations in the tree that, on a desktop, answered with no
 * navigation at all beyond a "Back" link.
 *
 * The search controls are not here, and are not in the grid's `<aside>`
 * either: they float over the results panel (`FloatingVideoSearch`). So this
 * column and that one now hold the same things, at the same widths, and the
 * sidebar does not change shape when you cross into one of these pages.
 *
 * The `md:hidden` block below it is the other half of the same problem. The
 * `<aside>` is `md+` only, and `hasEmbeddedDock` reports every `/videos` path
 * as already carrying a sidebar-hosted dock — which keeps `CategoryDock`'s
 * mobile bottom bar hidden too. On a phone that left these two pages with no
 * navigation whatsoever. It carries what the grid's own mobile block carries:
 * the quick-link tiles, the tool tree (collapsed), and the footer.
 *
 * @module panels/LecturesSidebarShell
 */

import type React from "react"

import { QuickLinksGrid } from "../components/category-gallery/QuickLinksGrid"
import { ToolNavTree } from "../components/category-gallery/ToolNavTree"
import { VideoSidebarTree } from "../components/category-gallery/VideoSidebarTree"
import { Footer } from "../ui/layout/footer"
import type { LectureCategoryFacet } from "../types/videos"

export interface LecturesSidebarShellProps {
  /** App-owned navigation dock, rendered at the top of the column. */
  dockSlot?: React.ReactNode
  /** Per-category video counts, keyed by quick-link id. */
  counts?: Record<string, number>
  lectureCategories: LectureCategoryFacet[]
  selectedCategory?: string
  /** Quick-link id of the page inside this shell, for highlighting. */
  activeId?: string
  lecturesExpanded: boolean
  onToggleLectures: () => void
  children: React.ReactNode
}

export function LecturesSidebarShell({
  dockSlot,
  counts,
  lectureCategories,
  selectedCategory,
  activeId,
  lecturesExpanded,
  onToggleLectures,
  children,
}: LecturesSidebarShellProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Same widths and `min-w-0` as the grid view's own `<aside>`: the dock
          arrives already sized to this column, so it cannot reach across the
          border onto the page beside it. */}
      <aside
        data-app-chrome
        className="hidden md:flex md:w-[300px] lg:w-[320px] md:shrink-0 md:min-w-0 md:flex-col md:h-screen md:sticky md:top-0 md:overflow-y-auto md:border-r md:border-border/60 md:bg-background/40 gap-4 p-3"
      >
        {dockSlot}

        <VideoSidebarTree
          counts={counts}
          lectureCategories={lectureCategories}
          selectedCategory={selectedCategory}
          activeId={activeId}
          lecturesExpanded={lecturesExpanded}
          onToggleLectures={onToggleLectures}
        />

        <Footer />
      </aside>

      <div className="min-w-0 flex-1">
        {/* Below md the `<aside>` above is gone and the app dock's fixed
            instance stays hidden, so without this the page answers with no
            way out of it but the browser's Back button. */}
        <div className="md:hidden p-3">
          <QuickLinksGrid counts={counts} activeId={activeId} />

          <nav className="mb-6 flex flex-col gap-3 text-sm" aria-label="Tools">
            <ToolNavTree defaultExpanded={false} />
          </nav>

          <Footer />
        </div>

        {children}
      </div>
    </div>
  )
}
