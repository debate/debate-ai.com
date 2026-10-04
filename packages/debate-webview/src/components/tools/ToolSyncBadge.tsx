"use client"

/**
 * @fileoverview Small "Saved to your account" badge for a tool page's header.
 *
 * Reads the shared auto-sync's module state (the same state
 * `ToolRecordSyncProvider` drives) instead of calling `useToolRecordSync`
 * again, which would start a second reconcile and watcher. It polls on a short
 * timer because that state isn't observable; each poll is a string compare per
 * collection (see `getToolRecordCollectionSyncStatus`).
 *
 * @module components/tools/ToolSyncBadge
 */

import { useEffect, useState } from "react"
import { Cloud, CloudOff, RotateCw } from "lucide-react"
import { TOOL_RECORD_COLLECTIONS } from "@debate/data-sync/src/state/toolRecordCollections"
import { isToolRecordSyncEnabled } from "@debate/data-sync/src/state/tool-record-mirror"
import { getToolRecordCollectionSyncStatus } from "@debate/data-sync/src/state/tool-record-auto-sync"
import { describeToolSaveState, type ToolSaveDisplay } from "../../lib/tools/tool-save-state"

const POLL_MS = 3000

function readDisplay(keys: readonly string[]): ToolSaveDisplay | null {
  return describeToolSaveState(
    isToolRecordSyncEnabled(),
    keys.map((key) => getToolRecordCollectionSyncStatus(key)),
  )
}

/** Renders nothing for a route with no synced collection. */
export function ToolSyncBadge({ href }: { href: string }) {
  const [display, setDisplay] = useState<ToolSaveDisplay | null>(null)

  useEffect(() => {
    const keys = TOOL_RECORD_COLLECTIONS.filter((c) => c.href === href).map((c) => c.key)
    if (keys.length === 0) return
    const update = () => setDisplay(readDisplay(keys))
    update()
    const timer = setInterval(update, POLL_MS)
    return () => clearInterval(timer)
  }, [href])

  if (!display) return null
  const Icon = display.state === "local" ? CloudOff : display.state === "saved" ? Cloud : RotateCw
  return (
    <span
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground"
      title={display.title}
      data-tool-save-state={display.state}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{display.label}</span>
    </span>
  )
}
