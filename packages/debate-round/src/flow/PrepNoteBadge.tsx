/**
 * @fileoverview Small clickable indicator shown on every `FlowSpreadsheet`
 * cell for creating or reviewing that box's `PrepNote`s — closes the
 * "no note-creation UI" gap noted in `docs/features/prep-notes.md`: a note
 * previously had to be created elsewhere, against a box the author had to
 * address by hand. Mirrors `EditBadge`'s always-visible affordance pattern
 * (unlike `AnnotationBadge`, which renders nothing for an empty box) since a
 * box with zero notes is exactly when a contributor most wants to add one.
 */

"use client"

import type React from "react"
import { StickyNote } from "lucide-react"
import { sortNotesByCreatedAt } from "./strategy-sync-notes"
import type { PrepNote } from "./strategy-sync-notes"

export interface PrepNoteBadgeProps {
  notes: PrepNote[]
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Renders a small badge: a filled pill with the note count when the box
 * already has one or more persisted `PrepNote`s (hovering lists each
 * author/text, oldest first), or a faint, unlabeled affordance when it
 * doesn't. Clicking either state calls `onOpen` with the click event so the
 * caller (`FlowSpreadsheet`) can position a `PrepNotePopover` at the click
 * point, mirroring `EditBadge`'s `stopPropagation`-before-cell-edit pattern.
 */
export function PrepNoteBadge({ notes, onOpen }: PrepNoteBadgeProps) {
  const hasNotes = notes.length > 0

  const title = hasNotes
    ? sortNotesByCreatedAt(notes)
        .map((note) => `${note.authorId}: ${note.text}`)
        .join("\n")
    : "Add a prep note for this box"

  return (
    <button
      type="button"
      className={
        hasNotes
          ? "ml-1 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1 py-0.5 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/70"
          : "ml-1 inline-flex shrink-0 items-center justify-center rounded-full p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted"
      }
      title={title}
      aria-label={hasNotes ? `${notes.length} prep note${notes.length === 1 ? "" : "s"}` : "Add a prep note for this box"}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(e)
      }}
    >
      <StickyNote className="h-3 w-3" />
      {hasNotes ? <span className="text-[10px] leading-none">{notes.length}</span> : null}
    </button>
  )
}
