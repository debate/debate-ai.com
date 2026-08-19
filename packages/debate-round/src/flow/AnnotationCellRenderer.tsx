/**
 * @fileoverview Custom cell renderer for non-first `FlowSpreadsheet` columns
 * that shows the cell's text plus an `AnnotationBadge` when its box carries
 * one or more persisted `FlowAnnotation`s, and an `EditBadge` for logging or
 * reviewing that box's `FlowEdit`s. The first column keeps its own
 * `FirstColumnCellRenderer` (heading/indent UI); this covers every other
 * column.
 */

"use client"

import { listFlowAnnotationsForBox } from "../state/flowAnnotations"
import { listFlowEditsForBox } from "../state/flowEdits"
import { AnnotationBadge } from "./AnnotationBadge"
import { EditBadge } from "./EditBadge"
import { boxPathForCell, columnIndexFromField } from "./annotation-cells"
import type { AnnotationCellRendererProps } from "./types"

export function AnnotationCellRenderer(props: AnnotationCellRendererProps) {
  const { data, value, flowId, onJumpToAnnotation, onOpenEditReview, colDef } = props
  if (!data) return <span>{value}</span>

  const columnIndex = columnIndexFromField(colDef?.field)
  const boxPath = boxPathForCell(data.originalIndex, columnIndex)
  const annotations =
    typeof localStorage === "undefined" ? [] : listFlowAnnotationsForBox(flowId, boxPath)
  const edits = typeof localStorage === "undefined" ? [] : listFlowEditsForBox(flowId, boxPath)

  return (
    <span className="flex w-full items-start gap-1">
      <span className="flex-1 whitespace-normal break-words">{value}</span>
      <AnnotationBadge annotations={annotations} onJump={onJumpToAnnotation} />
      <EditBadge
        edits={edits}
        onOpen={(e) =>
          onOpenEditReview({ x: e.clientX, y: e.clientY, boxPath, currentContent: String(value ?? "") })
        }
      />
    </span>
  )
}
