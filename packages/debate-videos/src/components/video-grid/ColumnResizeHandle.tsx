/**
 * @fileoverview The drag strip on a table header's right edge that drives
 * {@link useResizableColumns}. Shared by the video list and the rankings table.
 */

"use client"

/** Drag handle for one column; place it inside a `relative` header cell. */
export function ColumnResizeHandle({ onResizeStart }: { onResizeStart: (clientX: number) => void }) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onResizeStart(e.clientX)
      }}
      onTouchStart={(e) => {
        e.stopPropagation()
        onResizeStart(e.touches[0].clientX)
      }}
      onClick={(e) => e.stopPropagation()}
      role="separator"
      aria-orientation="vertical"
      className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize touch-none select-none hover:bg-primary/40 active:bg-primary/60"
    />
  )
}
