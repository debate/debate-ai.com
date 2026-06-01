/**
 * @fileoverview Shared sticky header bar used across video panel pages.
 * Wraps controls in a blurred, border-bottom container that sticks to the top
 * of the viewport on small screens and above.
 * @module components/debate/DebateVideos/components/StickyHeader
 */

import React from "react"

/** Props for the {@link StickyHeader} component. */
interface StickyHeaderProps {
  /** Controls to render inside the sticky bar. When omitted the bar is still rendered. */
  controls?: React.ReactNode
}

/**
 * Blurred sticky header bar that contains page-level navigation and filter controls.
 *
 * Sticky only on `sm` breakpoint and above; scrolls with content on mobile.
 *
 * @param props - See {@link StickyHeaderProps}.
 */
export function StickyHeader({ controls }: StickyHeaderProps) {
  return (
    <div className="sm:sticky top-0 z-40 supports-backdrop-blur:bg-background/30 bg-background/80 backdrop-blur-lg border-b border-white/10 dark:border-white/5 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 mb-4 flex flex-wrap md:flex-nowrap items-center gap-2 md:justify-end">
      {controls && (
        <div className="min-w-0 flex flex-wrap items-center gap-2">{controls}</div>
      )}
    </div>
  )
}
