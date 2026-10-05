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
 * While the tool has unsaved changes the badge also offers "Save now", which
 * flushes that tool's collections immediately (`saveToolNow`) instead of
 * waiting for the next auto-sync tick.
 *
 * @module components/tools/ToolSyncBadge
 */

import { useEffect, useMemo, useState } from "react"
import { Cloud, CloudOff, RotateCw, Save } from "lucide-react"
import { isToolRecordSyncEnabled } from "@debate/data-sync/src/state/tool-record-mirror"
import {
  flushToolRecordCollection,
  getToolRecordCollectionSyncStatus,
} from "@debate/data-sync/src/state/tool-record-auto-sync"
import { saveToolNow } from "../../lib/tools/tool-save-now"
import { resolveToolSyncKeys } from "../../lib/tools/tool-sync-status"
import { describeToolSaveState, type ToolSaveDisplay } from "../../lib/tools/tool-save-state"

const POLL_MS = 3000

function readDisplay(keys: readonly string[]): ToolSaveDisplay | null {
  return describeToolSaveState(
    isToolRecordSyncEnabled(),
    keys.map((key) => getToolRecordCollectionSyncStatus(key)),
  )
}

/**
 * Renders nothing for a route with no synced collection. `collectionKeys`
 * names the collections explicitly for a page whose data is filed under a
 * different route than its own (see `resolveToolSyncKeys`).
 */
export function ToolSyncBadge({ href, collectionKeys }: { href: string; collectionKeys?: readonly string[] }) {
  const [display, setDisplay] = useState<ToolSaveDisplay | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // A string signature keeps `keys` referentially stable across renders even
  // when the caller passes a fresh `collectionKeys` array each time.
  const keySignature = resolveToolSyncKeys(href, collectionKeys).join("|")
  const keys = useMemo(() => (keySignature ? keySignature.split("|") : []), [keySignature])

  useEffect(() => {
    if (keys.length === 0) return
    const update = () => setDisplay(readDisplay(keys))
    update()
    const timer = setInterval(update, POLL_MS)
    return () => clearInterval(timer)
  }, [keys])

  const saveNow = async () => {
    setSaving(true)
    setSaveError(null)
    const result = await saveToolNow(keys, flushToolRecordCollection)
    setSaving(false)
    setSaveError(result.ok ? null : (result.error ?? "Save failed."))
    setDisplay(readDisplay(keys))
  }

  if (!display) return null
  const Icon = display.state === "local" ? CloudOff : display.state === "saved" ? Cloud : RotateCw
  const canSaveNow = display.state === "saving" || saveError !== null
  return (
    <>
      <span
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground"
        title={display.title}
        data-tool-save-state={display.state}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{display.label}</span>
      </span>
      {canSaveNow ? (
        <button
          type="button"
          onClick={saveNow}
          disabled={saving}
          title={saveError ? `Couldn't save: ${saveError}. Try again.` : "Save this tool's changes to your account now."}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          data-tool-save-now
        >
          <Save className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {saving ? "Saving…" : saveError ? "Retry save" : "Save now"}
        </button>
      ) : null}
    </>
  )
}
