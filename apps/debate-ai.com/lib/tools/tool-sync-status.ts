/**
 * @fileoverview Pure helpers for the `/tools` account-sync status panel
 * (`components/tools/ToolSyncStatusPanel.tsx`).
 *
 * `useToolRecordSync`'s `results` are keyed by the collection's raw string
 * key, with no label or link a person would recognize. This turns them into
 * the one thing worth surfacing without asking someone to read every row: which
 * tools, if any, failed to sync and need a manual retry — closing the
 * "a collection whose merge failed has no Sync now to retry with" Known gap
 * in `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`.
 *
 * @module lib/tools/tool-sync-status
 */

import { findToolRecordCollection } from "debate-data-sync/src/state/toolRecordCollections"
import type { ToolRecordHydrationResult } from "debate-data-sync/src/state/tool-record-mirror"

export interface ToolSyncFailure {
  /** The collection's stable key, e.g. `"judgeProfiles"`. */
  key: string
  /** The tool's name, as the sidebar and `/tools` already show it. */
  label: string
  /** Where to open that tool, so a retry list is also a way back to it. */
  href: string
  /** Why the merge or the auto-sync flush didn't go through. */
  error: string
}

/**
 * The collections a merge or background flush reported an actual failure
 * for — never a collection that's merely unsynced because nobody is signed
 * in, since `ToolRecordHydrationResult.error` is only set "when `synced` is
 * false and it wasn't a sign-out" (see that type's own doc comment). A
 * result for a collection the current catalog no longer recognizes (a stale
 * entry from before a rename or removal) is dropped rather than shown with a
 * blank label.
 */
export function summarizeToolSyncFailures(
  results: readonly ToolRecordHydrationResult[],
): ToolSyncFailure[] {
  const failures: ToolSyncFailure[] = []
  for (const result of results) {
    if (result.synced || !result.error) continue
    const collection = findToolRecordCollection(result.collection)
    if (!collection) continue
    failures.push({
      key: collection.key,
      label: collection.label,
      href: collection.href,
      error: result.error,
    })
  }
  return failures.sort((a, b) => a.label.localeCompare(b.label))
}
