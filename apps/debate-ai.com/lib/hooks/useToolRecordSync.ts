"use client"

/**
 * @fileoverview Drives the shared tool-record sync for the whole app: turns
 * account mirroring on for a signed-in user and reconciles every collection
 * in `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS` between this browser and
 * the account.
 *
 * Closes the "per-browser localStorage, not account-synced" Known gap the
 * sidebar's Coaching/Practice tools carried — Practice Round Simulator,
 * Pre-Round Briefings, Opponent Team Profiles, Judge Profiles, the Judge
 * Paradigm Picker, Speech Summaries, the Argument Tree Outline, Prep Notes,
 * Flow Annotations, AI Coach Mode and Coaching Programs. Each of those tools
 * still reads and writes its own `localStorage` store directly and stays
 * fully usable signed out; the account is a mirror of it, not a replacement
 * for it, matching every other synced store in this repo.
 *
 * Mounted once by `ToolRecordSyncProvider` rather than called from thirteen
 * panels: the stores are shared between tools (a judge round record rebuilds
 * a judge profile; a speech summary becomes a prep note), so syncing them
 * per-panel would mean the same collection reconciling differently depending
 * on which page you happened to open first.
 *
 * @module lib/hooks/useToolRecordSync
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { TOOL_RECORD_COLLECTIONS } from "debate-data-sync/src/state/toolRecordCollections"
import {
  hydrateToolRecords,
  setToolRecordSyncEnabled,
  type ToolRecordHydrationResult,
} from "debate-data-sync/src/state/tool-record-mirror"
import { useSession } from "./useSession"

/**
 * Marks a tab as having already reconciled, so the shell document and each
 * dock frame inside it don't each re-run all thirteen merges. `sessionStorage`
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
    if (!isAuthenticated) {
      clearHydrated()
      setReconciled(false)
      setResults([])
    }
    return () => setToolRecordSyncEnabled(false)
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
      // Sequential, not `Promise.all`: thirteen collections in flight at once
      // is thirteen D1 reads racing the page's own first paint, for data no
      // panel needs before it is mounted.
      for (const collection of TOOL_RECORD_COLLECTIONS) {
        if (cancelled) return
        merged.push(await hydrateToolRecords(collection.key))
      }
      if (cancelled) return
      markHydrated(Date.now())
      setResults(merged)
      setReconciled(true)
      runningRef.current = false
    })().catch(() => {
      // `hydrateToolRecords` already swallows per-collection failures; this
      // only catches something unexpected, and a browser that can't reach the
      // account still has every tool working against its local store.
      runningRef.current = false
      if (!cancelled) setReconciled(true)
    })

    return () => {
      cancelled = true
      runningRef.current = false
    }
  }, [isAuthenticated, isLoading, resyncNonce])

  const resync = useCallback(() => {
    clearHydrated()
    setReconciled(false)
    setResyncNonce((nonce) => nonce + 1)
  }, [])

  return { enabled: isAuthenticated, reconciled, results, resync }
}
