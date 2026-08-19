/**
 * @fileoverview Small clickable indicator shown on a `FlowSpreadsheet` cell
 * whose box has one or more persisted `FlowEdit`s — see `edit-cells.ts` for
 * the box-path derivation this is fed from. Also renders (as a plain "+")
 * for a box with no edits yet, so a contributor can log the box's first
 * edit from the grid itself, not just review existing ones.
 */

"use client"

import { GitCommitHorizontal, Plus } from "lucide-react"
import { sortEditsByTimestampDesc } from "./edit-cells"
import type { FlowEdit } from "./shared-flow-sync"

export interface EditBadgeProps {
  edits: FlowEdit[]
  onOpen: () => void
}

/**
 * Renders a small "+" affordance when `edits` is empty (log the box's
 * first edit), or a filled badge with the edit count when it isn't
 * (review/log another). Either way, clicking calls `onOpen` without
 * starting cell editing, mirroring `AnnotationBadge`'s `stopPropagation`
 * pattern for interactive content inside an editable cell.
 */
export function EditBadge({ edits, onOpen }: EditBadgeProps) {
  if (edits.length === 0) {
    return (
      <button
        type="button"
        className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:opacity-100 group-hover:opacity-100"
        title="Log a flow edit for this box"
        aria-label="Log a flow edit for this box"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
      >
        <Plus className="h-3 w-3" />
      </button>
    )
  }

  const title = sortEditsByTimestampDesc(edits)
    .map((edit) => `${edit.authorId}: ${edit.content || "(cleared)"}`)
    .join("\n")

  return (
    <button
      type="button"
      className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-sky-100 p-0.5 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/70"
      title={title}
      aria-label={`${edits.length} flow edit${edits.length === 1 ? "" : "s"}`}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
    >
      <GitCommitHorizontal className="h-3 w-3" />
    </button>
  )
}
