/**
 * @fileoverview Small clickable indicator shown on a `FlowSpreadsheet` cell
 * whose box has one or more persisted `FlowAnnotation`s — see
 * `annotation-cells.ts` for the box-path derivation this is fed from.
 */

"use client"

import { Clock } from "lucide-react"
import { pickJumpAnnotation } from "./annotation-cells"
import { formatAnnotationTimestamp } from "./flow-annotations"
import type { FlowAnnotation } from "./flow-annotations"

export interface AnnotationBadgeProps {
  annotations: FlowAnnotation[]
  onJump: (annotation: FlowAnnotation) => void
}

/**
 * Renders nothing when `annotations` is empty. Otherwise renders a small
 * clock badge; clicking it calls `onJump` with the earliest annotation
 * (`pickJumpAnnotation`'s choice, resolved by the caller) without starting
 * cell editing, mirroring `FirstColumnCellRenderer`'s existing
 * `stopPropagation` pattern for interactive content inside an editable cell.
 */
export function AnnotationBadge({ annotations, onJump }: AnnotationBadgeProps) {
  const jumpTarget = pickJumpAnnotation(annotations)
  if (annotations.length === 0 || !jumpTarget) return null

  const title = annotations
    .map((a) => `${formatAnnotationTimestamp(a.timestampMs)}${a.note ? ` — ${a.note}` : ""}`)
    .join("\n")

  return (
    <button
      type="button"
      className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-amber-100 p-0.5 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/70"
      title={title}
      aria-label={`${annotations.length} flow annotation${annotations.length === 1 ? "" : "s"}`}
      onClick={(e) => {
        e.stopPropagation()
        onJump(jumpTarget)
      }}
    >
      <Clock className="h-3 w-3" />
    </button>
  )
}
