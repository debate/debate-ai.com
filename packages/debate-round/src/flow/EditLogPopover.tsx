/**
 * @fileoverview Review/log popover for a single `FlowSpreadsheet` cell's
 * `FlowEdit`s — opened from `EditBadge`, closing the grid-affordance half
 * of follow-up (b) under idea #16 ("Shared, Ai-Generated Debate Flow") in
 * TODO.md. Shows every edit already logged for the cell's box, newest
 * first, plus a small form to log another — mirroring
 * `FlowEditLogPanel`'s form fields (author + content), minus the flow
 * ID/box path inputs since those are already known from the cell that
 * opened this popover.
 *
 * Validates and builds the `FlowEdit` itself (via `createFlowEdit`) so it
 * can show an inline error, but leaves persisting it (`saveFlowEdit`) to
 * the caller via `onLog`, since only the caller (`FlowSpreadsheet`) knows
 * how to refresh the grid's cell renderers afterward.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { GitCommitHorizontal, X } from "lucide-react"

import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Textarea } from "debate-ui/src/primitives/textarea"

import { sortEditsByTimestampDesc } from "./edit-cells"
import { createFlowEdit, type FlowEdit } from "./shared-flow-sync"

export interface EditLogPopoverProps {
  flowId: number
  boxPath: number[]
  /** Every `FlowEdit` already logged for this box, in any order. */
  edits: FlowEdit[]
  /** Called with a freshly built, validated `FlowEdit` ready to persist. */
  onLog: (edit: FlowEdit) => void
  onClose: () => void
}

function newFlowEditId(): string {
  return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function EditLogPopover({ flowId, boxPath, edits, onLog, onClose }: EditLogPopoverProps) {
  const [authorId, setAuthorId] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
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
      setError(null)
      setContent("")
      onLog(edit)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log this edit.")
    }
  }

  const sorted = sortEditsByTimestampDesc(edits)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" data-testid="edit-log-popover-backdrop">
      <div
        ref={popoverRef}
        className="w-80 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
        data-testid="edit-log-popover"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            Flow edits — box {boxPath.join(".")}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-0.5 hover:bg-muted">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">No edits logged for this box yet.</p>
        ) : (
          <ul className="mb-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto">
            {sorted.map((edit) => (
              <li key={edit.id} className="rounded border p-1.5 text-xs">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>{edit.authorId}</span>
                  <span>{new Date(edit.timestampMs).toLocaleTimeString()}</span>
                </div>
                <div>{edit.content || "(cleared)"}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1.5">
          <Input value={authorId} onChange={(e) => setAuthorId(e.target.value)} placeholder="Author ID" />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Proposed content for this box…"
            className="min-h-14 text-xs"
          />
          <Button size="sm" onClick={handleLog}>
            Log edit
          </Button>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
