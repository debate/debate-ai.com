"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { ToolNavTree, ToolSidebarFooter } from "debate-videos"
import { CategoryDock } from "./CategoryDock"
import { ReasonDocsSidebarPanels } from "@/components/reason-docs/ReasonDocsSidebarPanels"
import { isGenericToolSidebarRoute } from "@/lib/sidebar-routes"

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
 * Alongside the nav it also carries the REASON docs panels ported from
 * quick search's REASON editor sidebar — the folder/file tree and the
 * "Open Tabs" list. They live here rather than in `/reason-editor`'s own
 * `<aside>` — which this shell already wrapped, so that page rendered two
 * sidebars side by side — and so stay reachable from every tool page the nav
 * links to.
 */
export function AppSidebarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (!isGenericToolSidebarRoute(pathname)) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:w-[300px] lg:w-[320px] md:shrink-0 md:flex-col md:h-screen md:sticky md:top-0 md:overflow-y-auto md:border-r md:border-border/60 md:bg-background/40 gap-4 p-3">
        <CategoryDock embedded />
        {/* Above the nav tree rather than below it: the tree is long enough
            (a section auto-expands to show where you are) that anything under
            it starts below the fold, and on /reason-editor these panels are
            the page's primary navigation. Collapsed to a single header row
            everywhere else, so the cost to those pages is one line. */}
        <ReasonDocsSidebarPanels className="shrink-0" />
        <ToolNavTree />
        <ToolSidebarFooter />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
