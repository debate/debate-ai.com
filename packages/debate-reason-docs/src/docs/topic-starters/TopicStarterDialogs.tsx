"use client"

/**
 * The two dialogs the Topic Starters sidebar section opens: naming a new
 * catalogue folder, and reviewing the AI's "organize by argument" proposal
 * before it is sent. Both only collect a decision — the section sends the
 * change, which is applied for moderators and queued for everyone else.
 *
 * @module components/reason-docs/topic-starters/TopicStarterDialogs
 */

import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@debate-ai/ui/primitives/button"
import { Input } from "@debate-ai/ui/primitives/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@debate-ai/ui/primitives/dialog"

/** Asks for a folder name; `parentId` null means the top level. */
export function NewTopicFolderDialog({
  parentId,
  canEdit,
  onClose,
  onCreate,
}: {
  /** The folder to create in, `null` for the top level, `undefined` when closed. */
  parentId: number | null | undefined
  /** Whether the edit applies at once (moderators) — only changes the wording. */
  canEdit: boolean
  onClose: () => void
  onCreate: (title: string, parentId: number | null) => void
}) {
  const [title, setTitle] = useState("")
  const open = parentId !== undefined
  useEffect(() => {
    if (open) setTitle("")
  }, [open])

  const submit = () => {
    const name = title.trim()
    if (!name || parentId === undefined) return
    onCreate(name, parentId)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Topic Starters folder</DialogTitle>
          <DialogDescription>
            {canEdit ? "The folder is added to the public catalogue." : "A moderator reviews the folder before it appears."}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Folder name"
          placeholder="Folder name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            {canEdit ? "Create" : "Suggest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** What the organize dialog is showing. */
export type OrganizeState =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "error"; error: string }
  | { phase: "ready"; summary: string; moves: number; hasChange: boolean }

/**
 * Shows the AI's proposed reorganization — Aff cases under `Aff`, DAs, CPs,
 * T and Ks under `Neg` — and sends it on confirm.
 */
export function OrganizeTopicsDialog({
  state,
  canEdit,
  sending,
  onClose,
  onConfirm,
}: {
  state: OrganizeState
  canEdit: boolean
  sending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={state.phase !== "closed"} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Organize by argument
          </DialogTitle>
          <DialogDescription>
            The AI files every public topic starter under Aff (cases) or Neg (DA, CP, T, K), by side and argument type.
          </DialogDescription>
        </DialogHeader>
        {state.phase === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sorting the files…
          </p>
        )}
        {state.phase === "error" && <p className="text-sm text-destructive">{state.error}</p>}
        {state.phase === "ready" && (
          <div className="space-y-2 text-sm">
            <p>{state.summary}</p>
            {state.hasChange && (
              <p className="text-muted-foreground">
                {canEdit
                  ? "Applying moves the files now and removes the folders the moves empty."
                  : "Moderators review the reorganization before anything moves."}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {state.phase === "ready" && state.hasChange ? "Cancel" : "Close"}
          </Button>
          {state.phase === "ready" && state.hasChange && (
            <Button onClick={onConfirm} disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {canEdit ? `Move ${state.moves} file${state.moves === 1 ? "" : "s"}` : "Send for approval"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
