"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { ResizableSidebarLayout } from "@debate/videos"
import { isGenericToolSidebarRoute } from "../../lib/sidebar-routes"
import { showsCardsOnlySidebar } from "../../lib/reason-docs/sidebar-routes"
import { AppSidebar } from "./app-sidebar/app-sidebar"
import { SidebarAccount } from "./app-sidebar/sidebar-account"

/**
 * Puts the app's one sidebar beside every page that is not in the video
 * library — the same column the `/videos` pages draw for themselves
 * (`ResizableSidebarLayout` with the dock and `VideoSidebarTree`), so the
 * sidebar is the same thing everywhere: the same width the reader last
 * dragged it to, the same hide button and Ctrl/Cmd+B, and the same tree of
 * Round Videos, Lectures and the tool sections.
 *
 * Without this, following one of the tree's links off `/videos` (into
 * `/coaching`, `/practice`, …) landed on a page with no sidebar at all.
 * Mounted once in the root layout, it wraps every page whose path matches a
 * tree entry (`isGenericToolSidebarRoute`); `/docs` passes `always`.
 *
 * What the column holds beyond the shared tree is merged in as sections of
 * it (`AppSidebar`): the REASON docs panels on `/research/cards` and
 * `/reason-editor`, the help docs' page tree on `/docs`, and the account menu
 * pinned at its foot beside the hide button. `/research/cards` is the docs
 * panels alone (`showsCardsOnlySidebar`): they fill the column, so its
 * scrolling area does not scroll as a whole — each panel scrolls inside its
 * own share.
 *
 * `/debate` and `/research/docs` are the two tree destinations this shell
 * skips (`ownsItsLayout`, in @debate/videos' `sidebar-routes`): both fill the
 * viewport with a workspace sidebar of their own. Below `md` the column is
 * not drawn at all: the bottom dock's Sidebar button opens
 * `MobileSidebarDrawer` instead, with the same tree.
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

  if (!always && !isGenericToolSidebarRoute(pathname)) return <>{children}</>

  return (
    <ResizableSidebarLayout
      appChrome
      className="bg-background"
      sidebarClassName={showsCardsOnlySidebar(pathname) ? "overflow-hidden" : undefined}
      // `relative` (from the layout) makes the column the containing block for
      // the page's absolutely positioned bits; a column flex box at least a
      // viewport high is what the pages were laid out against before.
      contentClassName="flex min-h-screen flex-col"
      sidebar={<AppSidebar />}
      footer={<SidebarAccount />}
    >
      {children}
    </ResizableSidebarLayout>
  )
}
