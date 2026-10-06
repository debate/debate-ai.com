"use client"

import type React from "react"
import { useLayoutEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_WIDTH_KEY } from "@debate/videos"
import { SidebarProvider } from "../../lib/ui/primitives/sidebar"
import { isGenericToolSidebarRoute } from "../../lib/sidebar-routes"
import { AppSidebar } from "./app-sidebar/app-sidebar"

/**
 * Mirrors the persistent left sidebar the `/videos` pages render
 * (`LecturesVideoGridView`'s `<aside>`, dock + `ToolNavTree`) on every other
 * page that sidebar's Apps/Coaching/Research/Practice tree links to.
 *
 * Without this, following one of those links off `/videos` (e.g. into
 * `/coaching` or `/practice`) landed on a page with no sidebar at all —
 * the nav just disappeared instead of staying available for the next hop.
 * Mounted once in the root layout, it wraps every page whose path matches a
 * tree entry in the same sidebar so the nav — and the embedded dock at its
 * top — stays on screen everywhere it points, not only on `/videos`.
 *
 * On the document routes it also carries the REASON docs panels ported from
 * quick search's REASON editor sidebar — the folder/file tree, topic starters
 * and the "Open Tabs" list. They live here rather than in `/reason-editor`'s
 * own `<aside>` — which this shell already wrapped, so that page rendered two
 * sidebars side by side. Only `/research/cards` and `/reason-editor` get them
 * (`showsReasonDocsPanels`): everywhere else the sidebar is that page's own
 * nav, and on `/videos` — which keeps its own sidebar and so is not wrapped by
 * this shell at all — it is the video library
 * (see `packages/debate-help-docs/content/docs/internals/reason-docs-sidebar.mdx`).
 *
 * The column itself is shadcn's `sidebar-07` block (`app-sidebar/`): it
 * collapses to a 3rem icon rail from its edge rail, the trigger in its header
 * or Ctrl/Cmd+B, and remembers that choice in the `sidebar_state` cookie. Its
 * width is the one the reader last dragged the `/videos` column to
 * (`SIDEBAR_WIDTH_KEY`, which `ResizableSidebarLayout` writes), so crossing
 * between the two keeps the column's shape. Below `md` it is not drawn at
 * all: the bottom dock's Sidebar button opens `MobileSidebarDrawer` instead,
 * as it always has.
 *
 * `/research/cards` is the docs panels alone (`showsCardsOnlySidebar`): no nav tree, no
 * glossary or rankings links, no site footer. Those are all about somewhere
 * else, and stacking them under a file tree made the column a scroll rather
 * than a place. With nothing below them the panels take the column's own height
 * instead of a fixed slice of it (`fill`), which is what lets the reader drag
 * the split between the file tree and the open tabs — so the column does not
 * scroll as a whole, each panel scrolls inside its own share. The dock stays:
 * it is the control you clicked "Shared" in, and the way back to videos.
 *
 * `/debate` and `/doc` are the two tree destinations this shell deliberately
 * skips (`ownsItsLayout`, in @debate/videos' `sidebar-routes`), both because
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
 * `/research/cards` and `/reason-editor`, which read documents out of this app's own
 * store rather than the editor's.
 */
export function AppSidebarShell({
  children,
  always = false,
}: {
  children: React.ReactNode
  /** Wrap whatever the route — for /docs, which is no tool-tree destination (`DocsAppChrome`). */
  always?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const [widthPx, setWidthPx] = useState(SIDEBAR_DEFAULT_WIDTH)

  // Read after mount, not during render, so the server's markup and the
  // first client render agree; a layout effect so the column never paints
  // at the wrong width or state first.
  useLayoutEffect(() => {
    setOpen(readCollapsedCookie() !== false)
    const stored = readStoredWidth()
    if (stored !== null) setWidthPx(stored)
  }, [])

  if (!always && !isGenericToolSidebarRoute(pathname)) return <>{children}</>

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      // The dock needs ~220px to sit on one row; the stock 16rem is close,
      // but the reader's own width wins wherever they have set one.
      style={{ "--sidebar-width": `${widthPx}px` } as React.CSSProperties}
      className="min-h-screen"
    >
      <AppSidebar />
      {/* Not `SidebarInset`: that is a `<main>`, and the pages render their
          own. `relative` makes the column the containing block for the
          page's absolutely positioned bits (an `sr-only` label in a wide
          table used to escape to the viewport and widen the mobile layout);
          `min-w-0` keeps a wide page from pushing the sidebar off screen. */}
      <div className="relative flex w-full min-w-0 flex-1 flex-col">{children}</div>
    </SidebarProvider>
  )
}

/** The collapsed/expanded choice shadcn's provider writes, or null if unset. */
function readCollapsedCookie(): boolean | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/)
    return match ? match[1] === "true" : null
  } catch {
    return null
  }
}

/** The width last dragged on `/videos` (`ResizableSidebarLayout`), clamped to its range. */
function readStoredWidth(): number | null {
  try {
    const value = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    if (!Number.isFinite(value) || value <= 0) return null
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value))
  } catch {
    return null
  }
}
