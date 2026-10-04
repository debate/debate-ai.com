"use client"

/**
 * @fileoverview Compact "Saved to account" indicator for a tool's own page
 * header (`ToolPageHeader`), closing the TODO.md item "surface the tool data
 * sync status where each tool is used, not only in settings". Reads the state
 * `ToolRecordSyncProvider` publishes to `lib/tools/tool-sync-store`; renders
 * nothing for a tool with no synced collection.
 *
 * @module components/tools/ToolSyncBadge
 */

import { useSyncExternalStore } from "react"
import { AlertTriangle, Cloud, CloudOff, RotateCw } from "lucide-react"
import {
  getToolSyncSnapshot,
  subscribeToolSyncSnapshot,
} from "../../lib/tools/tool-sync-store"
import { toolSyncBadgeState } from "../../lib/tools/tool-sync-status"

const CHIP =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium"

export function ToolSyncBadge({ href }: { href: string }) {
  const sync = useSyncExternalStore(subscribeToolSyncSnapshot, getToolSyncSnapshot, getToolSyncSnapshot)
  const state = toolSyncBadgeState(href, sync)

  switch (state.kind) {
    case "none":
      return null
    case "local":
      return (
        <span className={`${CHIP} text-muted-foreground`} title="Sign in to save this tool's data to your account">
          <CloudOff className="h-4 w-4" aria-hidden="true" />
          Saved on this browser
        </span>
      )
    case "syncing":
      return (
        <span className={`${CHIP} text-muted-foreground`} role="status">
          <RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Syncing…
        </span>
      )
    case "synced":
      return (
        <span className={`${CHIP} text-muted-foreground`} title="This tool's data is saved to your account">
          <Cloud className="h-4 w-4" aria-hidden="true" />
          Saved to account
        </span>
      )
    case "failed":
      return (
        <button
          type="button"
          onClick={sync.resync}
          title={`${state.error} — click to retry`}
          className={`${CHIP} text-foreground transition-colors hover:bg-accent`}
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
          Not synced · Retry
        </button>
      )
  }
}
