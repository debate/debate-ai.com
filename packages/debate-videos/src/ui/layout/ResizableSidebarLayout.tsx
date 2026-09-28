"use client"

/**
 * @fileoverview The app's persistent left sidebar column, made drag-resizable
 * with `react-resizable-panels`.
 *
 * Every page that carries the tool sidebar — the app shell's generic column
 * (`AppSidebarShell` in debate-webview), the video grid and the videos
 * sidebar shell — renders it through this one component, so they share the
 * same width, the same handle and the same saved size. Crossing from `/videos`
 * to `/coach` does not change the column's shape.
 *
 * - **Width is in pixels, and persisted.** The panel keeps its pixel width
 *   when the window resizes (`preserve-pixel-size`), and the last width the
 *   user dragged to is stored under {@link SIDEBAR_WIDTH_KEY} and restored on
 *   mount. The restore happens in a layout effect rather than through
 *   `defaultSize` so the server render and the first client render agree.
 * - **Double-clicking the handle** resets the column to its default width
 *   (the library's built-in behaviour for a panel with a `defaultSize`).
 * - **The page, not the panel, scrolls.** The library's group and panels clip
 *   and scroll their own content by default; that is overridden so the column
 *   stays a sticky, viewport-high `<aside>` inside whatever scrolls the page,
 *   exactly as the fixed-width column did.
 * - **Below `md` there is no sidebar.** The panel and the handle are hidden
 *   with CSS rather than unmounted, so crossing the breakpoint never remounts
 *   the page beside them (a framed destination would reload).
 *
 * While a drag is in progress the library sets `pointer-events: none` on the
 * panels, so a same-origin frame in the content column cannot swallow the
 * pointer mid-drag.
 *
 * @module ui/layout/ResizableSidebarLayout
 */

import type React from "react"
import { useCallback, useLayoutEffect, useRef } from "react"
import { Group, Panel, Separator, usePanelRef, type PanelSize } from "react-resizable-panels"

import { cn } from "../lib/utils"

/** localStorage key for the sidebar width the user last dragged to, in px. */
export const SIDEBAR_WIDTH_KEY = "app-sidebar-width"
/** Default sidebar width, in px — also what a double-click on the handle restores. */
export const SIDEBAR_DEFAULT_WIDTH = 300
/** Narrowest the column can be dragged: the dock still fits on one row. */
export const SIDEBAR_MIN_WIDTH = 220
/** Widest the column can be dragged. */
export const SIDEBAR_MAX_WIDTH = 640

function readStoredWidth(): number | null {
  try {
    const value = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeStoredWidth(px: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(px)))
  } catch {
    // Private mode or blocked storage: the width just isn't remembered.
  }
}

export interface ResizableSidebarLayoutProps {
  /** Contents of the sidebar `<aside>`. */
  sidebar: React.ReactNode
  /** The page beside the sidebar. */
  children: React.ReactNode
  /** Classes for the outer row (e.g. its background). */
  className?: string
  /** Extra classes for the `<aside>`. */
  sidebarClassName?: string
  /** Classes for the content column. */
  contentClassName?: string
  /** Marks the `<aside>` as app chrome (`data-app-chrome`). */
  appChrome?: boolean
}

export function ResizableSidebarLayout({
  sidebar,
  children,
  className,
  sidebarClassName,
  contentClassName,
  appChrome,
}: ResizableSidebarLayoutProps) {
  const panelRef = usePanelRef()
  // Nothing is saved until the stored width has been applied: the panel
  // reports its default size on mount, which would otherwise overwrite it.
  const restored = useRef(false)

  useLayoutEffect(() => {
    const stored = readStoredWidth()
    if (stored !== null) {
      try {
        panelRef.current?.resize(stored)
      } catch {
        // The group was not registered yet; the default width stands.
      }
    }
    restored.current = true
  }, [panelRef])

  const handleResize = useCallback((size: PanelSize, _id: unknown, prev: PanelSize | undefined) => {
    if (!restored.current || !prev || size.inPixels <= 0) return
    writeStoredWidth(size.inPixels)
  }, [])

  return (
    <Group
      orientation="horizontal"
      // The library's defaults are `height: 100%` and `overflow: hidden`,
      // which would make the group its own scroll container and break the
      // sticky sidebar below.
      style={{ height: "auto", minHeight: "100vh", overflow: "visible" }}
      className={cn(
        "min-h-screen",
        // Below md: no sidebar, no handle — the content panel is then the only
        // flex item growing, so it takes the full width.
        "max-md:[&>[data-panel]:first-child]:hidden! max-md:[&>[data-separator]]:hidden!",
        className,
      )}
    >
      <Panel
        id="app-sidebar"
        panelRef={panelRef}
        defaultSize={SIDEBAR_DEFAULT_WIDTH}
        minSize={SIDEBAR_MIN_WIDTH}
        maxSize={SIDEBAR_MAX_WIDTH}
        groupResizeBehavior="preserve-pixel-size"
        onResize={handleResize}
        style={{ overflow: "visible", maxHeight: "none" }}
      >
        <aside
          data-app-chrome={appChrome || undefined}
          className={cn(
            "hidden md:flex w-full min-w-0 flex-col h-screen sticky top-0 overflow-y-auto bg-background/40 gap-4 p-3",
            sidebarClassName,
          )}
        >
          {sidebar}
        </aside>
      </Panel>
      <Separator
        aria-label="Resize sidebar"
        className={cn(
          "relative w-px shrink-0 bg-border/60 transition-colors outline-none",
          // A wider, invisible hit area either side of the 1px line.
          "after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2",
          "data-[separator=hover]:bg-primary/50 data-[separator=active]:bg-primary data-[separator=focus]:bg-primary",
        )}
      />
      <Panel id="app-content" minSize={320} style={{ overflow: "visible", maxHeight: "none" }}>
        <div className={cn("min-w-0", contentClassName)}>{children}</div>
      </Panel>
    </Group>
  )
}
