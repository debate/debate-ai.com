/**
 * @fileoverview Overlay opened from an `EditBadge` click — mirrors
 * `GridContextMenu`'s fixed-position, click-outside/Escape-to-close pattern
 * (an AG Grid cell clips normal in-flow content, so this renders as a
 * sibling of the grid rather than inside the cell). Shows the box's
 * already-logged `FlowEdit`s plus a small form to log a new one directly
 * against `state/flowEdits.ts`, closing the remaining half of follow-up
 * (b) under idea #16 ("Shared, Ai-Generated Debate Flow") in TODO.md —
 * logging or reviewing an edit no longer requires leaving the live grid
 * for the separate `FlowEditLogPanel` form.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { GitCommitHorizontal } from "lucide-react"
import { createFlowEdit } from "./shared-flow-sync"
import { saveFlowEdit } from "../state/flowEdits"
import { sortEditsNewestFirst } from "./edit-cells"
import type { FlowEdit } from "./shared-flow-sync"

export interface EditReviewPopoverProps {
  x: number
  y: number
  flowId: number
  boxPath: number[]
  currentContent: string
  edits: FlowEdit[]
  /** Called after a new edit is successfully logged, so the caller can refresh its own snapshot. */
  onLogged: () => void
  onClose: () => void
}

function newFlowEditId(): string {
  return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const POPOVER_WIDTH = 260
const POPOVER_MAX_HEIGHT = 260

export function EditReviewPopover({
  x,
  y,
  flowId,
  boxPath,
  currentContent,
  edits,
  onLogged,
  onClose,
}: EditReviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [authorId, setAuthorId] = useState("")
  const [content, setContent] = useState(currentContent)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [onClose])

  const handleLog = () => {
    try {
      const edit = createFlowEdit({
        id: newFlowEditId(),
        flowId,
        boxPath,
        authorId,
        content,
        timestampMs: Date.now(),
      })
      saveFlowEdit(edit)
      setError(null)
      setAuthorId("")
      onLogged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log this edit.")
    }
  }

  const style = {
    left: Math.min(x, window.innerWidth - POPOVER_WIDTH - 8),
    top: Math.min(y, window.innerHeight - POPOVER_MAX_HEIGHT - 8),
  }

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 flex w-[260px] flex-col gap-2 rounded-md border bg-popover p-2 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 text-xs font-medium">
        <GitCommitHorizontal className="h-3 w-3" />
        Box [{boxPath.join(",")}]
      </div>

      {edits.length > 0 ? (
        <ul className="flex max-h-24 flex-col gap-1 overflow-y-auto text-xs">
          {sortEditsNewestFirst(edits).map((edit) => (
            <li key={edit.id} className="rounded bg-muted/50 px-1.5 py-1">
              <span className="font-medium">{edit.authorId}</span>: {edit.content || "(cleared)"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No edits logged for this box yet.</p>
      )}

      <input
        className="rounded border border-input bg-background px-1.5 py-1 text-xs"
        value={authorId}
        onChange={(e) => setAuthorId(e.target.value)}
        placeholder="Author ID"
      />
      <textarea
        className="min-h-16 rounded border border-input bg-background px-1.5 py-1 text-xs"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Proposed content…"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <button
        type="button"
        className="self-end rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        onClick={handleLog}
      >
        Log edit
      </button>
    </div>
  )
}
