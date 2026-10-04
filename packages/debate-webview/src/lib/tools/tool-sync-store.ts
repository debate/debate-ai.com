/**
 * @fileoverview A tiny external store carrying the app-wide tool-record sync
 * state out of `useToolRecordSync` so any tool page can read it.
 *
 * `useToolRecordSync` must run exactly once (`ToolRecordSyncProvider`): its
 * effect cleanups stop the global auto-sync watcher, so calling it again from
 * a tool's header would tear the watcher down on navigation. The provider
 * publishes its state here instead, and `ToolSyncBadge` subscribes through
 * `useSyncExternalStore`.
 *
 * @module lib/tools/tool-sync-store
 */

import type { ToolRecordHydrationResult } from "@debate/data-sync/src/state/tool-record-mirror"

export interface ToolSyncSnapshot {
  /** Whether local writes are mirroring to an account right now. */
  enabled: boolean
  /** Whether this tab's account merge has finished (or been skipped). */
  reconciled: boolean
  /** Latest per-collection merge/flush results. */
  results: readonly ToolRecordHydrationResult[]
  /** Re-runs the merge; a no-op until the provider has published one. */
  resync: () => void
}

const SIGNED_OUT: ToolSyncSnapshot = {
  enabled: false,
  reconciled: false,
  results: [],
  resync: () => {},
}

let snapshot: ToolSyncSnapshot = SIGNED_OUT
const listeners = new Set<() => void>()

/** Replaces the published state and notifies subscribers. */
export function publishToolSyncSnapshot(next: ToolSyncSnapshot): void {
  if (
    next.enabled === snapshot.enabled &&
    next.reconciled === snapshot.reconciled &&
    next.results === snapshot.results &&
    next.resync === snapshot.resync
  ) {
    return
  }
  snapshot = next
  for (const listener of listeners) listener()
}

/** Back to the signed-out default (unmount of the provider). */
export function resetToolSyncSnapshot(): void {
  publishToolSyncSnapshot(SIGNED_OUT)
}

export function getToolSyncSnapshot(): ToolSyncSnapshot {
  return snapshot
}

export function subscribeToolSyncSnapshot(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
