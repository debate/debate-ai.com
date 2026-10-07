"use client"

/**
 * @fileoverview The app's persistent left sidebar column, made drag-resizable
 * with `react-resizable-panels`.
 *
 * Every page that carries the tool sidebar — the app shell's generic column
 * (`AppSidebarShell` in debate-webview), the video grid and the videos
 * sidebar shell — renders it through this one component, so they share the
 * same width, the same handle and the same saved size. Crossing from `/videos`
 * to `/coaching` does not change the column's shape.
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
 * - **It can be hidden.** The button at the foot of the column, Ctrl/Cmd+B
 *   (outside text fields, where it means bold), or dragging the handle past
 *   half the minimum width collapses the column to nothing; a tab on the left
 *   edge, the same shortcut or dragging the handle back out brings it back.
 *   The choice is one for the whole app (`sidebar-collapse.ts`), so it holds
 *   across pages, and the app dock floats while the column is hidden.
 *
 * While a drag is in progress the library sets `pointer-events: none` on the
 * panels, so a same-origin frame in the content column cannot swallow the
 * pointer mid-drag.
 *
 * @module ui/layout/ResizableSidebarLayout
 */

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Group, Panel, Separator, usePanelRef, type PanelSize } from "react-resizable-panels"

import { cn } from "../lib/utils"
import { setSidebarCollapsed, toggleSidebarCollapsed, useSidebarCollapsed } from "./sidebar-collapse"

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
  /** Contents of the sidebar `<aside>`, in its scrolling area. */
  sidebar: React.ReactNode
  /** Pinned under the scrolling area, beside the hide button (e.g. the account menu). */
  footer?: React.ReactNode
  /** The page beside the sidebar. */
  children: React.ReactNode
  /** Classes for the outer row (e.g. its background). */
  className?: string
  /** Extra classes for the `<aside>`'s scrolling area. */
  sidebarClassName?: string
  /** Classes for the content column. */
  contentClassName?: string
  /** Marks the `<aside>` as app chrome (`data-app-chrome`). */
  appChrome?: boolean
}

export function ResizableSidebarLayout({
  sidebar,
  footer,
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

  const collapsed = useSidebarCollapsed()

  // The shared choice drives the panel. `collapse()`/`expand()` are no-ops
  // when the panel is already in that state, so this is safe to repeat.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    try {
      if (collapsed) panel.collapse()
      else panel.expand()
    } catch {
      // Not registered with its group yet; the next change applies it.
    }
  }, [collapsed, panelRef])

  // Ctrl/Cmd+B, except where it already means bold (inputs, editors).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey)) return
      if (event.altKey || event.shiftKey || isEditableTarget(event.target)) return
      event.preventDefault()
      toggleSidebarCollapsed()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const handleResize = useCallback((size: PanelSize, _id: unknown, prev: PanelSize | undefined) => {
    if (!restored.current || !prev) return
    // A drag past the collapse threshold, or back out of it, is the same
    // choice as the button. Transitions only: the mount-time reports go from
    // one open width to another, so they never overwrite the stored choice.
    if (size.inPixels <= 0) {
      if (prev.inPixels > 0) setSidebarCollapsed(true)
      return
    }
    if (prev.inPixels <= 0) setSidebarCollapsed(false)
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
        collapsible
        collapsedSize={0}
        groupResizeBehavior="preserve-pixel-size"
        onResize={handleResize}
        style={{ overflow: "visible", maxHeight: "none" }}
      >
        <aside
          data-app-chrome={appChrome || undefined}
          data-collapsed={collapsed || undefined}
          className="hidden md:flex w-full min-w-0 flex-col h-screen sticky top-0 overflow-hidden bg-background/40 data-[collapsed]:invisible"
        >
          <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3", sidebarClassName)}>
            {sidebar}
          </div>
          <div className="flex shrink-0 items-center gap-1 border-t border-border/60 px-2 py-1.5">
            <div className="min-w-0 flex-1">{footer}</div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Hide sidebar"
              title="Hide sidebar (Ctrl+B)"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>
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
        {/* `relative` makes the column the containing block for the page's
            absolutely positioned bits. Without one, an `sr-only` label in the
            last column of a wide, horizontally scrolling table (the admin
            users table) was placed against the viewport instead, at the
            table's far edge: its overflow escaped every scroller, widened
            the mobile layout viewport to twice the screen, and the fixed
            bottom dock centred itself in that, off to the right. */}
        <div className={cn("relative min-w-0", contentClassName)}>{children}</div>
      </Panel>
      {collapsed && (
        <button
          type="button"
          data-app-chrome={appChrome || undefined}
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Show sidebar"
          title="Show sidebar (Ctrl+B)"
          className="fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-background py-3 pl-1 pr-1.5 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground md:flex"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
    </Group>
  )
}

/** Text fields and rich-text editors, where Ctrl/Cmd+B is bold rather than ours. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']") !== null
}
