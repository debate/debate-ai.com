"use client"

/**
 * @fileoverview Drives the shared tool-record sync for the whole app: turns
 * account mirroring on for a signed-in user and reconciles every collection
 * in `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS` between this browser and
 * the account.
 *
 * Closes the "per-browser localStorage, not account-synced" Known gap that ran
 * through the whole sidebar — the Practice and Coaching tools, the research and
 * team stores, and the video library's favourites and hidden list. Every one of
 * those tools still reads and writes its own `localStorage` store directly and
 * stays fully usable signed out; the account is a mirror of it, not a
 * replacement for it, matching every other synced store in this repo.
 *
 * Mounted once by `ToolRecordSyncProvider` rather than called from each panel:
 * the stores are shared between tools (a judge round record rebuilds a judge
 * profile; a speech summary becomes a prep note), so syncing them per-panel
 * would mean the same collection reconciling differently depending on which
 * page you happened to open first.
 *
 * Three things hang off the session here, in this order:
 *
 * 1. Mirroring and the guest sign-in prompt follow `isAuthenticated` directly.
 * 2. Every collection reconciles once per tab, and each is baselined for the
 *    watcher as it finishes.
 * 3. Only then does the watcher start, so it cannot race the merge's writes.
 *
 * @module lib/hooks/useToolRecordSync
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { TOOL_RECORD_COLLECTIONS } from "debate-data-sync/src/state/toolRecordCollections"
import {
  beginToolRecordPrefetch,
  endToolRecordPrefetch,
  hydrateToolRecords,
  setToolRecordSyncEnabled,
  type ToolRecordHydrationResult,
} from "debate-data-sync/src/state/tool-record-mirror"
import {
  markToolRecordsSynced,
  resetToolRecordAutoSync,
  startToolRecordAutoSync,
  stopToolRecordAutoSync,
} from "debate-data-sync/src/state/tool-record-auto-sync"
import { setSignedIn } from "debate-data-sync/src/state/sign-in-prompt"
import { useSession } from "./useSession"

/**
 * Marks a tab as having already reconciled, so the shell document and each
 * dock frame inside it don't each re-run every merge. `sessionStorage`
 * rather than a module-level flag precisely because those are separate
 * documents with separate module state but one shared per-tab store.
 */
const HYDRATED_KEY = "toolRecordSyncHydratedAt"

/** How long a tab's reconcile counts as current, in ms. */
const HYDRATION_TTL_MS = 10 * 60 * 1000

function hydratedRecently(now: number): boolean {
  if (typeof sessionStorage === "undefined") return false
  try {
    const raw = sessionStorage.getItem(HYDRATED_KEY)
    if (!raw) return false
    const at = Number(raw)
    return Number.isFinite(at) && now - at < HYDRATION_TTL_MS
  } catch {
    return false
  }
}

function markHydrated(now: number): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(HYDRATED_KEY, String(now))
  } catch {
    // A browser refusing session storage just reconciles once per document
    // instead of once per tab — wasteful, never wrong (the merge is a union).
  }
}

function clearHydrated(): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.removeItem(HYDRATED_KEY)
  } catch {
    // Nothing to do — the next sign-in re-reconciles at worst one merge late.
  }
}

export interface ToolRecordSyncState {
  /** Whether local writes are mirroring to an account right now. */
  enabled: boolean
  /** Whether the account merge has finished (or been skipped) this tab. */
  reconciled: boolean
  /** One entry per collection from the most recent merge, in catalog order. */
  results: ToolRecordHydrationResult[]
  /** Re-runs the merge for every collection, ignoring this tab's TTL. */
  resync: () => void
}

/**
 * Enables account mirroring while signed in and reconciles every synced
 * collection once per tab.
 *
 * @returns What the sync is doing, for the `/settings` status list.
 */
export function useToolRecordSync(): ToolRecordSyncState {
  const { isAuthenticated, isLoading } = useSession()
  const [reconciled, setReconciled] = useState(false)
  const [results, setResults] = useState<ToolRecordHydrationResult[]>([])
  const [resyncNonce, setResyncNonce] = useState(0)
  const runningRef = useRef(false)

  // Mirroring follows the session directly: a sign-out stops it immediately
  // rather than waiting for the next failed request to notice.
  useEffect(() => {
    setToolRecordSyncEnabled(isAuthenticated)
    // The guest prompt reads the same flag the mirror does, so the two can
    // never disagree about whether there is an account to save to.
    setSignedIn(isAuthenticated)
    if (!isAuthenticated) {
      clearHydrated()
      setReconciled(false)
      setResults([])
      stopToolRecordAutoSync()
      // Snapshots describe the *previous* account's stores. Kept around, the
      // next sign-in would treat everything already local as already synced
      // and push none of it.
      resetToolRecordAutoSync()
    }
    return () => {
      setToolRecordSyncEnabled(false)
      setSignedIn(false)
      stopToolRecordAutoSync()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isLoading || !isAuthenticated) return

    const now = Date.now()
    const forced = resyncNonce > 0
    if (!forced && hydratedRecently(now)) {
      setReconciled(true)
      return
    }
    if (runningRef.current) return
    runningRef.current = true

    let cancelled = false
    void (async () => {
      const merged: ToolRecordHydrationResult[] = []
      // One GET for the whole catalog, which every merge below then reads its
      // own slice out of.
      beginToolRecordPrefetch()
      // Sequential, not `Promise.all`: the whole catalog in flight at once is
      // dozens of D1 reads racing the page's own first paint, for data no panel
      // needs before it is mounted. The catalog is fetched in one request up
      // front (see `hydrateToolRecords`' shared prefetch), so this loop is
      // merging cached responses rather than making a request per collection.
      for (const collection of TOOL_RECORD_COLLECTIONS) {
        if (cancelled) return
        merged.push(await hydrateToolRecords(collection.key))
        // Baseline the watcher per collection, as soon as that collection is
        // reconciled: everything in the store at this moment either came from
        // the account or was just pushed to it, so the first flush sends only
        // what changes from here. Doing it after the whole loop would let a
        // save made mid-reconcile be baselined as already-synced and never go
        // up at all.
        markToolRecordsSynced(collection.key)
      }
      endToolRecordPrefetch()
      if (cancelled) return
      markHydrated(Date.now())
      setResults(merged)
      setReconciled(true)
      runningRef.current = false
    })().catch(() => {
      endToolRecordPrefetch()
      // `hydrateToolRecords` already swallows per-collection failures; this
      // only catches something unexpected, and a browser that can't reach the
      // account still has every tool working against its local store.
      runningRef.current = false
      if (!cancelled) setReconciled(true)
    })

    return () => {
      cancelled = true
      runningRef.current = false
      // A reconcile abandoned part-way must not leave its payload behind for
      // the next one to serve as if it were fresh.
      endToolRecordPrefetch()
    }
  }, [isAuthenticated, isLoading, resyncNonce])

  // Watch for local changes only once the merge has baselined every store.
  // Started here rather than alongside `setToolRecordSyncEnabled` because a
  // watcher running during hydration would race the merge's own writes and
  // push back records it had just adopted.
  useEffect(() => {
    if (!isAuthenticated || !reconciled) return
    return startToolRecordAutoSync()
  }, [isAuthenticated, reconciled])

  const resync = useCallback(() => {
    clearHydrated()
    setReconciled(false)
    setResyncNonce((nonce) => nonce + 1)
  }, [])

  return { enabled: isAuthenticated, reconciled, results, resync }
}
