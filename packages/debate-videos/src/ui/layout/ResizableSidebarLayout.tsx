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
 * - **A hidden column peeks.** While collapsed, moving the pointer to within
 *   {@link SIDEBAR_PEEK_EDGE_PX} of the window's left edge slides the column
 *   out *over* the page — fixed, slightly translucent, at the user's width —
 *   without expanding the panel, so the content beside it never reflows. It
 *   slides away again {@link SIDEBAR_PEEK_HIDE_DELAY_MS} after the pointer
 *   leaves it (or on Escape), and the collapsed choice is left as it was. A
 *   menu opened from inside it (the account menu) keeps it out while open.
 *
 * While a drag is in progress the library sets `pointer-events: none` on the
 * panels, so a same-origin frame in the content column cannot swallow the
 * pointer mid-drag.
 *
 * @module ui/layout/ResizableSidebarLayout
 */

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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

/** How close to the left edge, in px, the pointer must come to peek a hidden sidebar. */
export const SIDEBAR_PEEK_EDGE_PX = 8
/** How long a peeked sidebar lingers after the pointer leaves it. */
export const SIDEBAR_PEEK_HIDE_DELAY_MS = 300

/** Whether a pointer at `x` is close enough to the left edge to peek the hidden sidebar. */
export function isNearSidebarEdge(x: number): boolean {
  return x >= 0 && x <= SIDEBAR_PEEK_EDGE_PX
}

/**
 * Whether a popup menu opened from inside the sidebar (the account menu) is
 * still open. Only popup triggers count: an expanded tree section also
 * carries `aria-expanded="true"`, and counting those kept a peeked column out
 * for good.
 */
export function isSidebarMenuOpen(aside: ParentNode | null | undefined): boolean {
  return aside?.querySelector('[aria-haspopup]:not([aria-haspopup="false"])[aria-expanded="true"]') != null
}

/** The width a peeked sidebar opens at: the user's stored width, clamped, or the default. */
export function sidebarPeekWidth(stored: number | null): number {
  if (stored === null) return SIDEBAR_DEFAULT_WIDTH
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, stored))
}

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
  const asideRef = useRef<HTMLElement>(null)
  // Peeking: the collapsed column shown as an overlay while the pointer is
  // near the edge or over it. Never set while the column is open.
  const [peeking, setPeeking] = useState(false)
  const [peekWidth, setPeekWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const peek = collapsed && peeking

  useEffect(() => {
    if (!collapsed) {
      setPeeking(false)
      return
    }
    let hideTimer: ReturnType<typeof setTimeout> | null = null
    let open = false
    const cancelHide = () => {
      if (hideTimer !== null) clearTimeout(hideTimer)
      hideTimer = null
    }
    const show = () => {
      cancelHide()
      if (open) return
      open = true
      setPeekWidth(sidebarPeekWidth(readStoredWidth()))
      setPeeking(true)
    }
    const hide = () => {
      cancelHide()
      open = false
      setPeeking(false)
    }
    // A menu opened from inside the column renders outside it; the column
    // stays out until that menu closes, then goes as soon as it does.
    const scheduleHide = () => {
      if (!open || hideTimer !== null) return
      hideTimer = setTimeout(() => {
        hideTimer = null
        if (isSidebarMenuOpen(asideRef.current)) scheduleHide()
        else hide()
      }, SIDEBAR_PEEK_HIDE_DELAY_MS)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      if (!open) {
        if (isNearSidebarEdge(event.clientX)) show()
        return
      }
      const right = asideRef.current?.getBoundingClientRect().right ?? 0
      if (event.clientX <= right) cancelHide()
      else scheduleHide()
    }
    // `pointerleave` on the column itself also fires when the pointer goes
    // straight into a framed page, where the document sees no more moves.
    const aside = asideRef.current
    const onAsideLeave = (event: PointerEvent) => {
      if (event.pointerType !== "touch") scheduleHide()
    }
    const onAsideEnter = () => {
      if (open) cancelHide()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) hide()
    }
    // The pointer leaving the window (onto another screen, into the browser
    // chrome) or focus moving into a frame is leaving the column too.
    const onPointerLeaveWindow = (event: MouseEvent) => {
      if (event.relatedTarget === null) scheduleHide()
    }
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("keydown", onKeyDown)
    document.documentElement.addEventListener("mouseleave", onPointerLeaveWindow)
    window.addEventListener("blur", scheduleHide)
    aside?.addEventListener("pointerleave", onAsideLeave)
    aside?.addEventListener("pointerenter", onAsideEnter)
    return () => {
      cancelHide()
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("keydown", onKeyDown)
      document.documentElement.removeEventListener("mouseleave", onPointerLeaveWindow)
      window.removeEventListener("blur", scheduleHide)
      aside?.removeEventListener("pointerleave", onAsideLeave)
      aside?.removeEventListener("pointerenter", onAsideEnter)
      setPeeking(false)
    }
  }, [collapsed])

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
          ref={asideRef}
          data-app-chrome={appChrome || undefined}
          data-collapsed={(collapsed && !peek) || undefined}
          data-peek={peek || undefined}
          style={peek ? { width: peekWidth } : undefined}
          className={cn(
            "hidden md:flex min-w-0 flex-col h-screen top-0 overflow-hidden data-[collapsed]:invisible",
            peek
              ? // Over the page, not beside it: the content column keeps its width.
                "fixed left-0 z-50 border-r border-border bg-background/85 shadow-2xl backdrop-blur-md animate-in slide-in-from-left duration-200"
              : "sticky w-full bg-background/40",
          )}
        >
          <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3", sidebarClassName)}>
            {sidebar}
          </div>
          <div className="flex shrink-0 items-center gap-1 border-t border-border/60 px-2 py-1.5">
            <div className="min-w-0 flex-1">{footer}</div>
            {/* While peeking, the same spot pins the column open instead. */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!peek)}
              aria-label={peek ? "Keep sidebar open" : "Hide sidebar"}
              title={peek ? "Keep sidebar open (Ctrl+B)" : "Hide sidebar (Ctrl+B)"}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {peek ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
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
      {collapsed && !peek && (
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
