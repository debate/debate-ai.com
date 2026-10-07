/**
 * @fileoverview A block of the video grid that only keeps its cards mounted
 * while it is on or near the screen.
 *
 * The feed pages on its own for as long as the library has more to give, so a
 * category can end with thousands of loaded videos. Mounting a card for every
 * one of them — each with a thumbnail, a hover card and a tooltip — is what
 * used to freeze the page. The grid is therefore split into chunks of slots;
 * a chunk far from the viewport swaps its cards for an empty box of the height
 * it last measured, so the scrollbar and the scroll position stay put while
 * only a few chunks' worth of cards are ever live. The list layout uses the
 * same component as a `<tbody>` per top-level group.
 * @module components/video-grid/WindowedChunk
 */

"use client"

import React, { useEffect, useRef, useState } from "react"

/** How far beyond the viewport a chunk mounts, so cards are ready before they scroll in. */
const MOUNT_MARGIN = "1500px 0px"

interface WindowedChunkProps {
  /** Whether to mount the cards on the first render, before any measurement. */
  initiallyMounted: boolean
  /** Height to reserve before the chunk has ever been measured, in pixels. */
  estimatedHeight: number
  /** Class names for the box, which is the grid itself. */
  className?: string
  /**
   * `"tbody"` draws the chunk as a table body, for the list layout; its
   * placeholder is then one empty row spanning `colSpan` columns.
   */
  as?: "div" | "tbody"
  /** Columns the placeholder row spans when `as` is `"tbody"`. */
  colSpan?: number
  children: React.ReactNode
}

/**
 * Renders `children` while the box is within {@link MOUNT_MARGIN} of the
 * viewport and an empty box of the last measured height otherwise.
 */
export function WindowedChunk({
  initiallyMounted,
  estimatedHeight,
  className,
  as = "div",
  colSpan = 1,
  children,
}: WindowedChunkProps) {
  const ref = useRef<HTMLElement>(null)
  const [mounted, setMounted] = useState(initiallyMounted)
  const heightRef = useRef(estimatedHeight)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    // No observer (an old browser, a test DOM): keep every card, as before.
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Measured while the cards are still in it, so the placeholder that
        // replaces them is exactly as tall and nothing below it jumps.
        if (!entry.isIntersecting && element.offsetHeight > 0) {
          heightRef.current = element.offsetHeight
        }
        setMounted(entry.isIntersecting)
      },
      { root: null, rootMargin: MOUNT_MARGIN, threshold: 0 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (as === "tbody") {
    return (
      <tbody ref={ref as React.RefObject<HTMLTableSectionElement>} className={className}>
        {mounted ? (
          children
        ) : (
          <tr aria-hidden style={{ height: heightRef.current }}>
            <td colSpan={colSpan} />
          </tr>
        )}
      </tbody>
    )
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      style={mounted ? undefined : { height: heightRef.current }}
      aria-hidden={mounted ? undefined : true}
    >
      {mounted ? children : null}
    </div>
  )
}
