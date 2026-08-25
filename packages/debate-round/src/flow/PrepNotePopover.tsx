/**
 * @fileoverview Overlay opened from a `PrepNoteBadge` click — mirrors
 * `EditReviewPopover`'s fixed-position, click-outside/Escape-to-close
 * pattern (an AG Grid cell clips normal in-flow content, so this renders as
 * a sibling of the grid rather than inside the cell). Shows the box's
 * already-persisted `PrepNote`s plus a small form to create a new one
 * directly against `state/prepNotes.ts`, closing the "no note-creation UI"
 * gap in `docs/features/prep-notes.md` — a note can now be created right
 * from the live flow it's about, instead of requiring a separate,
 * not-yet-built flow-view affordance.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { StickyNote } from "lucide-react"
import { createPrepNote, sortNotesByCreatedAt } from "./strategy-sync-notes"
import type { PrepNote } from "./strategy-sync-notes"
import { savePrepNote } from "../state/prepNotes"

export interface PrepNotePopoverProps {
  x: number
  y: number
  flowId: number
  boxPath: number[]
  notes: PrepNote[]
  /** Called after a new note is successfully created, so the caller can refresh its own snapshot. */
  onCreated: () => void
  onClose: () => void
}

function newPrepNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const POPOVER_WIDTH = 260
const POPOVER_MAX_HEIGHT = 280

export function PrepNotePopover({ x, y, flowId, boxPath, notes, onCreated, onClose }: PrepNotePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [authorId, setAuthorId] = useState("")
  const [text, setText] = useState("")
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

  const handleCreate = () => {
    try {
      const note = createPrepNote({
        id: newPrepNoteId(),
        flowId,
        boxPath,
        authorId,
        text,
        createdAt: Date.now(),
      })
      savePrepNote(note)
      setError(null)
      setAuthorId("")
      setText("")
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this note.")
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
        <StickyNote className="h-3 w-3" />
        Box [{boxPath.join(",")}]
      </div>

      {notes.length > 0 ? (
        <ul className="flex max-h-24 flex-col gap-1 overflow-y-auto text-xs">
          {sortNotesByCreatedAt(notes).map((note) => (
            <li key={note.id} className="rounded bg-muted/50 px-1.5 py-1">
              <span className="font-medium">{note.authorId}</span>: {note.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No prep notes for this box yet.</p>
      )}

      <input
        className="rounded border border-input bg-background px-1.5 py-1 text-xs"
        value={authorId}
        onChange={(e) => setAuthorId(e.target.value)}
        placeholder="Author ID"
      />
      <textarea
        className="min-h-16 rounded border border-input bg-background px-1.5 py-1 text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Note about this argument…"
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <button
        type="button"
        className="self-end rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        onClick={handleCreate}
      >
        Add note
      </button>
    </div>
  )
}
