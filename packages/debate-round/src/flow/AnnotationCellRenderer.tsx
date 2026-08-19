/**
 * @fileoverview Custom cell renderer for non-first `FlowSpreadsheet` columns
 * that shows the cell's text plus an `AnnotationBadge` when its box carries
 * one or more persisted `FlowAnnotation`s, and an `EditBadge` for its
 * persisted `FlowEdit`s. The first column keeps its own
 * `FirstColumnCellRenderer` (heading/indent UI); this covers every other
 * column.
 */

"use client"

import { listFlowAnnotationsForBox } from "../state/flowAnnotations"
import { listFlowEditsForFlow } from "../state/flowEdits"
import { AnnotationBadge } from "./AnnotationBadge"
import { boxPathForCell, columnIndexFromField } from "./annotation-cells"
import { EditBadge } from "./EditBadge"
import { filterEditsForBox } from "./edit-cells"
import type { AnnotationCellRendererProps } from "./types"

export function AnnotationCellRenderer(props: AnnotationCellRendererProps) {
  const { data, value, flowId, onJumpToAnnotation, onOpenEditLog, colDef } = props
  if (!data) return <span>{value}</span>

  const columnIndex = columnIndexFromField(colDef?.field)
  const boxPath = boxPathForCell(data.originalIndex, columnIndex)
  const hasStorage = typeof localStorage !== "undefined"
  const annotations = hasStorage ? listFlowAnnotationsForBox(flowId, boxPath) : []
  const edits = hasStorage ? filterEditsForBox(listFlowEditsForFlow(flowId), boxPath) : []

  return (
    <span className="group flex w-full items-start gap-1">
      <span className="flex-1 whitespace-normal break-words">{value}</span>
      <AnnotationBadge annotations={annotations} onJump={onJumpToAnnotation} />
      <EditBadge edits={edits} onOpen={() => onOpenEditLog(boxPath)} />
    </span>
  )
}
