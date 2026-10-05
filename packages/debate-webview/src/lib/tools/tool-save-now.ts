/**
 * @fileoverview "Save now" for one tool: pushes that tool's pending local
 * changes to the account immediately instead of waiting for the next
 * auto-sync tick (`TOOL_RECORD_AUTO_SYNC_INTERVAL_MS`).
 *
 * Backs the button `ToolSyncBadge` shows in a tool page's header while the
 * tool has unsaved changes. Pure over an injected `flush`, so it is testable
 * without a network.
 *
 * @module lib/tools/tool-save-now
 */

import type { ToolRecordFlushResult } from "@debate/data-sync/src/state/tool-record-auto-sync"

export interface SaveToolNowResult {
  /** True when every collection flushed without an error. */
  ok: boolean
  /** Records pushed plus records deleted across the tool's collections. */
  changed: number
  /** The first error a collection reported, for the button's tooltip. */
  error?: string
}

/**
 * Flushes each collection in turn (sequentially, like `flushToolRecords`) and
 * keeps going after a failure so one bad collection doesn't hold back the
 * rest of the tool's data.
 *
 * @param keys - `TOOL_RECORD_COLLECTIONS` keys belonging to the tool.
 * @param flush - Pushes one collection; `flushToolRecordCollection` in the app.
 */
export async function saveToolNow(
  keys: readonly string[],
  flush: (key: string) => Promise<ToolRecordFlushResult>,
): Promise<SaveToolNowResult> {
  let changed = 0
  let error: string | undefined
  for (const key of keys) {
    try {
      const result = await flush(key)
      changed += result.pushed + result.deleted
      if (result.error && !error) error = result.error
    } catch (err) {
      if (!error) error = err instanceof Error ? err.message : "Save failed."
    }
  }
  return error ? { ok: false, changed, error } : { ok: true, changed }
}
