"use client"

/**
 * @fileoverview The app's sidebar — dock and tool tree — beside the help docs.
 *
 * /docs is rendered by `debate-help-docs` (Fumadocs), which brings its own
 * header, sidebar and search. It used to render with none of the app's chrome
 * at all, so a reader in the docs had no app navigation on screen. This puts
 * the same drag-resizable column every tool page has (`AppSidebarShell`)
 * to the left of the Fumadocs layout, which then lays out in the column that
 * remains: its sidebar and header are sticky within the page, not fixed to
 * the viewport, so both sidebars show side by side.
 *
 * Below `md` the app column is hidden, as it is on every other page, and
 * Fumadocs' own drawer is the navigation; the app's floating mobile dock is
 * left out because it would sit over the docs' content.
 *
 * The app's stylesheet sets `overflow: hidden` on `<body>`, so the window
 * never scrolls: every app page scrolls inside `AppShell`'s viewport-high
 * `overflow-auto` wrapper. The docs get the same wrapper here, or their
 * content could not scroll at all (only Fumadocs' sidebar, which scrolls
 * itself). The sticky sidebars and header stick within it.
 *
 * Leaving /docs is always a full page load (see `docsExitTarget` in
 * `frame-navigation.ts`): the docs' stylesheet is not something an app page
 * can have applied. The dock and tree navigate with the client router, so
 * clicks on links out of /docs are taken here, in the capture phase before
 * their own handlers run, and loaded for real. `AppShell` backs this up for
 * the navigations that are not anchor clicks (the dock's menus, Alt+<n>).
 */

import type React from "react"
import { useCallback } from "react"

import { CategoryDockProvider } from "debate-videos"
import { AppSidebarShell } from "./AppSidebarShell"
import { docsExitTarget, opensElsewhere } from "../../lib/layout/frame-navigation"

export function DocsAppChrome({ children }: { children: React.ReactNode }) {
  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || opensElsewhere(event)) return
    const anchor = (event.target as Element | null)?.closest?.("a")
    if (!anchor) return
    const target = docsExitTarget(
      {
        href: anchor.href,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
      },
      window.location.origin,
    )
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    window.location.assign(target)
  }, [])

  return (
    <CategoryDockProvider>
      <div className="h-screen w-full overflow-y-auto" onClickCapture={handleClickCapture}>
        <AppSidebarShell always>{children}</AppSidebarShell>
      </div>
    </CategoryDockProvider>
  )
}
