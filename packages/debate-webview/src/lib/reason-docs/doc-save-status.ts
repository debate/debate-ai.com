/**
 * @fileoverview Pure helper behind the status line above the REASON editor
 * (`components/reason-editor/ReasonEditorScreen.tsx`).
 *
 * `ReasonDocsProvider` already tracks whether an autosave is in flight, queued,
 * or failing, but the editor only ever showed "Saving…". This turns those three
 * flags into the one label a writer needs: is this document on my account yet?
 *
 * @module lib/reason-docs/doc-save-status
 */

export type DocSaveState = "saved" | "saving" | "unsaved" | "failed" | "public"

export interface DocSaveStatus {
  state: DocSaveState
  /** Short text for the status line. */
  label: string
  /** Longer explanation for the tooltip. */
  title: string
}

export interface DocSaveFlags {
  /** A public topic starter is open instead of an owned document. */
  isTopicDocument: boolean
  /** An autosave request is in flight. */
  saving: boolean
  /** An edit is queued but not yet acknowledged by the server. */
  unsaved: boolean
  /** The last write for some document failed and is being retried. */
  saveFailed: boolean
}

const STATUSES: Record<DocSaveState, DocSaveStatus> = {
  public: {
    state: "public",
    label: "Public topic starter",
    title: "Read-only. Copy it into your own file to edit.",
  },
  failed: {
    state: "failed",
    label: "Couldn't save — retrying",
    title: "The last save didn't reach your account. Your edits stay in this tab and the save is retried automatically.",
  },
  saving: {
    state: "saving",
    label: "Saving…",
    title: "Sending your latest edits to your account.",
  },
  unsaved: {
    state: "unsaved",
    label: "Unsaved changes",
    title: "Edits are queued and save to your account in a moment.",
  },
  saved: {
    state: "saved",
    label: "Saved to your account",
    title: "This document is saved to your account and available on your other devices.",
  },
}

/** A failure outranks in-flight work, which outranks queued work, which outranks "saved". */
export function describeDocSaveStatus({ isTopicDocument, saving, unsaved, saveFailed }: DocSaveFlags): DocSaveStatus {
  if (isTopicDocument) return STATUSES.public
  if (saveFailed) return STATUSES.failed
  if (saving) return STATUSES.saving
  if (unsaved) return STATUSES.unsaved
  return STATUSES.saved
}
