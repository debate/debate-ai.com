/**
 * @fileoverview Custom cell renderer for first column cells in Flow spreadsheet
 */

"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { listFlowAnnotationsForBox } from "../state/flowAnnotations"
import { AnnotationBadge } from "./AnnotationBadge"
import { boxPathForCell } from "./annotation-cells"
import type { FirstColumnCellRendererProps } from "./types"

/**
 * Custom cell renderer for first column cells that are section headings.
 * Shows a chevron toggle and bold text for heading rows, plus an
 * `AnnotationBadge` when the cell's box (column index 0) has a persisted
 * `FlowAnnotation`.
 */
export const FirstColumnCellRenderer = (props: FirstColumnCellRendererProps) => {
  const { data, value, collapsedHeadings, onToggleCollapse, flowId, onJumpToAnnotation } = props
  if (!data) return <span>{value}</span>

  const annotations =
    typeof localStorage === "undefined"
      ? []
      : listFlowAnnotationsForBox(flowId, boxPathForCell(data.originalIndex, 0))
  const badge = <AnnotationBadge annotations={annotations} onJump={onJumpToAnnotation} />

  if (data.isHeading) {
    const isCollapsed = collapsedHeadings.has(data.id)
    return (
      <div className="flex items-center gap-1 w-full h-full">
        <button
          className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(data.id)
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <span className="font-bold">{value}</span>
        {badge}
      </div>
    )
  }

  // Indent child rows under headings
  if (data.parentHeadingId) {
    return (
      <div className="flex items-center w-full h-full" style={{ paddingLeft: 24 }}>
        <span>{value}</span>
        {badge}
      </div>
    )
  }

  return (
    <span className="flex items-center gap-1">
      {value}
      {badge}
    </span>
  )
}
