/**
 * @fileoverview Small clickable indicator shown on every `FlowSpreadsheet`
 * cell for logging or reviewing that box's `FlowEdit`s — see
 * `edit-cells.ts` for the ordering helper this is fed from. Unlike
 * `AnnotationBadge` (which renders nothing for a box with no annotations),
 * this always renders: a box with zero edits is exactly when a
 * contributor most wants to log a new one, and the badge is that grid-level
 * entry point.
 */

"use client"

import type React from "react"
import { GitCommitHorizontal } from "lucide-react"
import { sortEditsNewestFirst } from "./edit-cells"
import type { FlowEdit } from "./shared-flow-sync"

export interface EditBadgeProps {
  edits: FlowEdit[]
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Renders a small badge: a filled pill with the pending-edit count when the
 * box already has one or more logged `FlowEdit`s (hovering lists each
 * author/content), or a faint, unlabeled affordance when it doesn't.
 * Clicking either state calls `onOpen` with the click event so the caller
 * (`FlowSpreadsheet`) can position an `EditReviewPopover` at the click
 * point, mirroring `AnnotationBadge`'s `stopPropagation`-before-cell-edit
 * pattern.
 */
export function EditBadge({ edits, onOpen }: EditBadgeProps) {
  const hasPending = edits.length > 0

  const title = hasPending
    ? sortEditsNewestFirst(edits)
        .map((edit) => `${edit.authorId}: ${edit.content || "(cleared)"}`)
        .join("\n")
    : "Log an edit for this box"

  return (
    <button
      type="button"
      className={
        hasPending
          ? "ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-100 px-1 py-0.5 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/70"
          : "ml-1 inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
      }
      title={title}
      aria-label={hasPending ? `${edits.length} pending edit${edits.length === 1 ? "" : "s"}` : "Log an edit for this box"}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(e)
      }}
    >
      <GitCommitHorizontal className="h-3 w-3" />
      {hasPending ? <span className="text-[10px] leading-none">{edits.length}</span> : null}
    </button>
  )
}
