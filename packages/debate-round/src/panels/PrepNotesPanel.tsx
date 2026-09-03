/**
 * @fileoverview Prep Notes panel — the UI follow-up named "(a) a prep-notes
 * panel UI" under the "🔄 Strategy Sync Notes" bullet in TODO.md.
 *
 * Reads every persisted prep note via `state/prepNotes.ts`'s
 * `buildPrepNotesPanelView` (a thin grouping of `listPrepNotes` by status,
 * follow-ups surfaced first) and renders it grouped by status. Each note
 * has a "cycle status" action (open → covered → needs-follow-up → open)
 * that calls the already-persisted `updatePersistedPrepNoteStatus`, and an
 * "assign" control that calls the already-persisted `assignPersistedPrepNote`
 * — no new mutation logic is introduced here.
 *
 * Each note also links "Jump to argument" — `strategy-sync-notes.ts`'s
 * `buildPrepNoteJumpHref` — to `/debate`, closing the "No 'jump to
 * argument' link" bullet in `docs/features/prep-notes.md`'s Known gaps.
 * See `hooks/useJumpToPrepNoteBox.ts` for the flow-select + grid-scroll
 * side of that link.
 *
 * Each note also has a "Flag high priority"/"Unflag" toggle, closing the
 * "🔄 Strategy Sync Notes" bullet's "a priority flag" follow-up — a flagged
 * note carries a "High priority" badge and sorts ahead of its status-mates
 * (`state/prepNotes.ts`'s `updatePersistedPrepNotePriority`, backed by
 * `strategy-sync-notes.ts`'s `setNotePriority`/`sortNotesByPriorityThenCreatedAt`).
 *
 * @module panels/PrepNotesPanel
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { EmptyState, PanelRow } from "../ui/panels/panel-shell"
import {
  assignPersistedPrepNote,
  buildPrepNotesPanelView,
  nextPrepNoteStatus,
  updatePersistedPrepNoteStatus,
  updatePersistedPrepNotePriority,
  type PrepNotesPanelGroup,
} from "../state/prepNotes"
import { buildPrepNoteJumpHref, type PrepNoteStatus } from "../flow/strategy-sync-notes"
import { isPrepNotesPanelLiveUpdateStorageEvent } from "../flow/live-update"

const STATUS_LABEL: Record<PrepNoteStatus, string> = {
  "needs-follow-up": "Needs follow-up",
  open: "Open",
  covered: "Covered",
}

const STATUS_VARIANT: Record<PrepNoteStatus, "default" | "secondary" | "outline"> = {
  "needs-follow-up": "default",
  open: "secondary",
  covered: "outline",
}

/**
 * Renders the Prep Notes panel: every persisted `PrepNote`, grouped by
 * status (needs follow-up first), with a "cycle status" action and an
 * "assign to" control per note.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PrepNotesPanel() {
  const [groups, setGroups] = useState<PrepNotesPanelGroup[] | null>(null)
  const [assigneeDrafts, setAssigneeDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setGroups(buildPrepNotesPanelView())
  }, [])

  const refresh = () => setGroups(buildPrepNotesPanelView())

  /**
   * Live-update this panel when another browser tab creates, cycles, or
   * (re)assigns a prep note while this tab is open — the `storage` event
   * never fires in the tab that made the write, only in other same-origin
   * tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isPrepNotesPanelLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleCycleStatus = (id: string, status: PrepNoteStatus) => {
    updatePersistedPrepNoteStatus(id, nextPrepNoteStatus(status), Date.now())
    refresh()
  }

  const handleTogglePriority = (id: string, currentPriority: "normal" | "high" | undefined) => {
    updatePersistedPrepNotePriority(id, currentPriority === "high" ? "normal" : "high", Date.now())
    refresh()
  }

  const handleAssign = (id: string) => {
    const assignedToId = (assigneeDrafts[id] ?? "").trim()
    assignPersistedPrepNote(id, assignedToId.length > 0 ? assignedToId : null, Date.now())
    setAssigneeDrafts((prev) => ({ ...prev, [id]: "" }))
    refresh()
  }

  if (groups === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading prep notes…</div>
  }

  const totalNotes = groups.reduce((sum, group) => sum + group.notes.length, 0)

  if (totalNotes === 0) {
    return (
      <EmptyState
        title="No prep notes yet."
        message="Notes fill in once teammates leave prep notes on flow arguments."
      />
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Prep Notes</h1>
        <p className="text-sm text-muted-foreground">
          Live prep notes across every flow, grouped by status. Cycle a note's status, flag it high
          priority, or assign it to a teammate as a task.
        </p>
      </div>
      {groups
        .filter((group) => group.notes.length > 0)
        .map((group) => (
          <div key={group.status} className="rounded-lg border border-border p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Badge variant={STATUS_VARIANT[group.status]}>{STATUS_LABEL[group.status]}</Badge>
              <span className="text-muted-foreground font-normal">({group.notes.length})</span>
            </h2>
            <div className="space-y-2">
              {group.notes.map((note) => (
                <PanelRow
                  key={note.id}
                  title={note.text}
                  subtitle={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>by {note.authorId}</span>
                      {note.assignedToId && (
                        <Badge variant="outline" className="whitespace-nowrap">
                          assigned to {note.assignedToId}
                        </Badge>
                      )}
                    </span>
                  }
                  trailing={
                    <>
                      {note.priority === "high" && <Badge variant="destructive">High priority</Badge>}
                      <Link
                        href={buildPrepNoteJumpHref(note)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Jump to argument
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTogglePriority(note.id, note.priority)}
                      >
                        {note.priority === "high" ? "Unflag" : "Flag high priority"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCycleStatus(note.id, note.status)}>
                        Mark {STATUS_LABEL[nextPrepNoteStatus(note.status)].toLowerCase()}
                      </Button>
                    </>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={assigneeDrafts[note.id] ?? ""}
                      onChange={(e) =>
                        setAssigneeDrafts((prev) => ({ ...prev, [note.id]: e.target.value }))
                      }
                      placeholder="Assign to…"
                      className="h-8 max-w-[220px] text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => handleAssign(note.id)}>
                      {note.assignedToId ? "Reassign" : "Assign"}
                    </Button>
                    {note.assignedToId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          assignPersistedPrepNote(note.id, null, Date.now())
                          refresh()
                        }}
                      >
                        Unassign
                      </Button>
                    )}
                  </div>
                </PanelRow>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
