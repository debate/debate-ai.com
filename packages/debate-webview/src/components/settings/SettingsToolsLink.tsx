/**
 * @fileoverview A small link from `/settings` back to `/tools`, where
 * account tool-data sync status now lives.
 *
 * `/settings` used to have its own "Tool data" list (per-collection sync
 * state, a manual "Sync now" button) before it was gutted down to
 * CardMirror-editor-only settings — see `CardMirrorSettingsPanel`'s own doc
 * comment. That status now renders on `/tools` instead
 * (`ToolSyncStatusPanel`), but nothing on `/settings` pointed a visitor
 * looking for it there. This is that pointer: it duplicates no state and
 * renders no sync data itself, it only links across.
 *
 * @module components/settings/SettingsToolsLink
 */

import Link from "next/link"
import { LayoutGrid } from "lucide-react"

export function SettingsToolsLink() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
      <Link
        href="/tools"
        className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:bg-accent"
      >
        <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-foreground">
          Looking for tool preferences, favorites, or account sync status?{" "}
          <span className="font-medium">Find them on the Tools page.</span>
        </span>
      </Link>
    </div>
  )
}
