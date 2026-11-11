"use client"

/**
 * @fileoverview Read-only access to the app-wide tool-record sync state for
 * any panel that wants to *show* it.
 *
 * `useToolRecordSync` drives the sync and must run exactly once
 * (`ToolRecordSyncProvider`): its effect cleanups stop the global auto-sync
 * watcher, so a second caller would tear the watcher down the moment it
 * unmounted. The provider publishes its state to `lib/tools/tool-sync-store`
 * instead, and this hook subscribes to that.
 *
 * @module lib/hooks/useToolSyncSnapshot
 */

import { useSyncExternalStore } from "react"
import {
  getToolSyncSnapshot,
  subscribeToolSyncSnapshot,
  type ToolSyncSnapshot,
} from "../tools/tool-sync-store"

/** The latest published sync state; the signed-out default on the server. */
export function useToolSyncSnapshot(): ToolSyncSnapshot {
  return useSyncExternalStore(subscribeToolSyncSnapshot, getToolSyncSnapshot, getToolSyncSnapshot)
}
