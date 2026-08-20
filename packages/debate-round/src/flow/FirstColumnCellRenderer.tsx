/**
 * @fileoverview Custom cell renderer for first column cells in Flow spreadsheet
 */

"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { listFlowAnnotationsForBox } from "../state/flowAnnotations"
import { listFlowEditsForBox } from "../state/flowEdits"
import { listPrepNotesForBox } from "../state/prepNotes"
import { AnnotationBadge } from "./AnnotationBadge"
import { EditBadge } from "./EditBadge"
import { PrepNoteBadge } from "./PrepNoteBadge"
import { formatArgumentTags } from "./argument-tagging"
import { boxPathForCell } from "./annotation-cells"
import type { FirstColumnCellRendererProps } from "./types"

/**
 * Custom cell renderer for first column cells that are section headings.
 * Shows a chevron toggle and bold text for heading rows, plus an
 * `AnnotationBadge` when the cell's box (column index 0) has a persisted
 * `FlowAnnotation`, an `EditBadge` for logging or reviewing that box's
 * `FlowEdit`s, a `PrepNoteBadge` for creating or reviewing that box's
 * `PrepNote`s, and a plain label for whichever
 * `argumentType`/`evidenceStatus`/`authorId` tags the row carries.
 */
export const FirstColumnCellRenderer = (props: FirstColumnCellRendererProps) => {
  const {
    data,
    value,
    collapsedHeadings,
    onToggleCollapse,
    flowId,
    onJumpToAnnotation,
    onOpenEditReview,
    onOpenPrepNote,
  } = props
  if (!data) return <span>{value}</span>

  const boxPath = boxPathForCell(data.originalIndex, 0)
  const annotations =
    typeof localStorage === "undefined" ? [] : listFlowAnnotationsForBox(flowId, boxPath)
  const edits = typeof localStorage === "undefined" ? [] : listFlowEditsForBox(flowId, boxPath)
  const notes = typeof localStorage === "undefined" ? [] : listPrepNotesForBox(flowId, boxPath)
  const tagLabel = formatArgumentTags(data)
  const badge = (
    <>
      {tagLabel ? (
        <span
          className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground"
          title="Argument tags (right-click → Tag Argument…)"
        >
          {tagLabel}
        </span>
      ) : null}
      <AnnotationBadge annotations={annotations} onJump={onJumpToAnnotation} />
      <EditBadge
        edits={edits}
        onOpen={(e) =>
          onOpenEditReview({ x: e.clientX, y: e.clientY, boxPath, currentContent: String(value ?? "") })
        }
      />
      <PrepNoteBadge notes={notes} onOpen={(e) => onOpenPrepNote({ x: e.clientX, y: e.clientY, boxPath })} />
    </>
  )

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
