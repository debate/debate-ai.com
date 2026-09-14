"use client"

/**
 * @fileoverview The video library's search and filter controls, collapsed to a
 * single icon that floats over the top-right corner of the results panel.
 *
 * The controls used to live in two places at once: stacked in the desktop
 * sidebar (above the nav tree) and again inside a `StickyHeader` at the top of
 * the mobile column. That cost the sidebar a third of its height on every
 * `/videos` page and pushed the nav tree below the fold, while the two
 * non-grid branches of the library — the glossary and the rankings — rendered
 * a sidebar with no search in it at all, so the column visibly changed shape
 * when you crossed into one of them.
 *
 * Here instead: one instance, `sticky` to the top of the results panel so it
 * rides the scroll, `h-0` so it costs the grid no vertical space, and
 * collapsed to a 36px button until asked for. It opens on hover (desktop),
 * on click or tap (both), and whenever focus moves inside it — so a keyboard
 * user reaches it with Tab and never needs the pointer. It stays open while
 * focus is inside or a search is active, and closes on Escape or a click
 * outside.
 *
 * The wrapper is `pointer-events-none` so the collapsed icon is the only part
 * of this layer that can intercept a click meant for a video card beneath it.
 *
 * @module components/video-search/FloatingVideoSearch
 */

import React, { useCallback, useEffect, useId, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { cn } from "../../ui/lib/utils"

export interface FloatingVideoSearchProps {
  /** The search/filter controls to reveal — normally a `VideoSearchBar`. */
  children: React.ReactNode
  /**
   * Keeps the panel open regardless of hover, because closing it would hide
   * an active filter. Pass `true` while a search term is set.
   */
  keepOpen?: boolean
  /** Accessible label for the collapsed button. */
  label?: string
}

export function FloatingVideoSearch({
  children,
  keepOpen = false,
  label = "Search and filter videos",
}: FloatingVideoSearchProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()

  const isOpen = open || keepOpen

  /** True while the keyboard focus is somewhere inside this control. */
  const holdsFocus = useCallback(() => {
    const node = containerRef.current
    if (!node || typeof document === "undefined") return false
    return node.contains(document.activeElement)
  }, [])

  // A click anywhere else closes it. `pointerdown` rather than `click` so the
  // panel is gone before the click lands on whatever is underneath.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const node = containerRef.current
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return
    setOpen(false)
    // Give focus back to the trigger, or Escape leaves it on an input that is
    // no longer on screen.
    const trigger = containerRef.current?.querySelector<HTMLButtonElement>("[data-floating-search-trigger]")
    trigger?.focus()
  }, [])

  return (
    <div className="pointer-events-none sticky top-3 z-40 flex h-0 justify-end">
      <div
        ref={containerRef}
        className="pointer-events-auto relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          // Hover-out must not yank the panel away from someone typing in it.
          if (!holdsFocus()) setOpen(false)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          data-floating-search-trigger
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpen((shown) => !shown)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full border border-border/70",
            "bg-background/80 text-muted-foreground shadow-sm backdrop-blur",
            "transition-colors hover:bg-accent hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isOpen && "bg-accent text-foreground",
          )}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>

        {/* Kept mounted so the search input holds its value (and its debounce)
            across an accidental hover-out, and hidden with `hidden` rather
            than unmounted so focus-within can reopen it. */}
        <div
          id={panelId}
          hidden={!isOpen}
          className={cn(
            "absolute right-0 top-0 w-[min(90vw,30rem)] rounded-lg border border-border",
            "bg-background/95 p-3 shadow-lg backdrop-blur",
          )}
        >
          {/* The trigger sits over this corner; the padding keeps the first
              control clear of it. */}
          <div className="pr-10">{children}</div>
        </div>
      </div>
    </div>
  )
}
