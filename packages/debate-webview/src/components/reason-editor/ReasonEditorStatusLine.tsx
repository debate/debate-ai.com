/**
 * @fileoverview Status row above the REASON editor: the document's save state
 * plus the shared account-sync badge (with "Save now") for the editor's own
 * synced stores, which `/reason-editor` has no `ToolPageHeader` to carry.
 *
 * @module components/reason-editor/ReasonEditorStatusLine
 */

import { ToolSyncBadge } from "../tools/ToolSyncBadge"

export interface ReasonEditorStatusLineProps {
  /** A public topic starter is open (read-only, never saved). */
  topicDocument: boolean
  /** The open document is being written to the account. */
  saving: boolean
}

export function ReasonEditorStatusLine({ topicDocument, saving }: ReasonEditorStatusLineProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b">
      {topicDocument ? (
        <span className="text-xs text-muted-foreground">Public topic starter</span>
      ) : (
        saving && <span className="text-xs text-muted-foreground">Saving…</span>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <ToolSyncBadge href="/reason-editor" />
      </div>
    </div>
  )
}
