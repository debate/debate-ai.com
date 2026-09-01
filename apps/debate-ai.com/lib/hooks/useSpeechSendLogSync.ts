"use client"

/**
 * @fileoverview Account sync for `/speech-documents`'s send-log history —
 * closes the standing "docs" gap next to `useFavoriteTools`/
 * `useJudgeDecisions`/`useWordCountRounds`: flows, rounds, word-count
 * rounds, and judge decisions were all already account-synced, but the
 * Speech Documents send log (`speechSendLogStore`, IndexedDB via
 * `debate-editor-cardmirror`) stayed per-browser. Local-first, mirroring
 * `useJudgeDecisions`'s convention: the panel keeps reading/writing the
 * local store (which already works fully signed out), and this hook layers
 * a one-time account merge plus ongoing best-effort push/delete sync on
 * top.
 *
 * Unlike `useJudgeDecisions` (synchronous localStorage), `speechSendLogStore`
 * is async (IndexedDB, cross-tab BroadcastChannel) — the merge awaits
 * `store.init()`/`store.add()`, and new entries (however they arrive: this
 * hook's own mount, another tab, or the editor's own `sendToSpeech` call)
 * are caught via `store.subscribe` and diffed against a module-level
 * `knownSyncedIds` set rather than only at explicit call sites, since the
 * store has callers this hook doesn't control (`speech-doc-send.ts`).
 *
 * A remote entry adopted during the merge is appended locally via
 * `store.add`, which places it at the end of local insertion order rather
 * than re-sorting by `sentAt` — same accepted minor ordering gap as
 * `useJudgeDecisions`'s merge (a decision/entry is generated once and never
 * edited, so this only matters for the rare adopted-out-of-order case).
 *
 * @module lib/hooks/useSpeechSendLogSync
 */

import { useCallback, useEffect, useState } from "react"
import { speechSendLogStore, type SpeechSendLogEntry } from "debate-editor-cardmirror/engine"
import {
  deleteSavedSpeechSendLogEntryFromAccount,
  listSavedSpeechSendLog,
  saveSpeechSendLogEntryToAccount,
} from "@/lib/speech-send-log-client"

// Module-level (not per-hook-instance) so multiple mounts share one account
// fetch, one "is this browser signed in" flag, and one record of which
// entry ids are already known to be synced — mirrors useJudgeDecisions.
let remoteAvailable = false
let remoteMergePromise: Promise<void> | null = null
const knownSyncedIds = new Set<string>()

function ensureRemoteMerged(): Promise<void> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedSpeechSendLog()
      .then(async (remoteEntries) => {
        if (remoteEntries === null) return
        remoteAvailable = true
        for (const entry of remoteEntries) knownSyncedIds.add(entry.id)

        await speechSendLogStore.init()
        const localEntries = speechSendLogStore.list()
        const localIds = new Set(localEntries.map((e) => e.id))
        const remoteIds = new Set(remoteEntries.map((e) => e.id))

        for (const entry of remoteEntries) {
          if (!localIds.has(entry.id)) {
            await speechSendLogStore.add(entry)
          }
        }
        for (const entry of localEntries) {
          if (!remoteIds.has(entry.id)) {
            saveSpeechSendLogEntryToAccount(entry)
              .then(() => knownSyncedIds.add(entry.id))
              .catch(() => {
                // Best-effort — this entry stays local-only until a later
                // successful sync (e.g. the next store change or mount).
              })
          }
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error), or signed
        // out — either way this browser falls back to local-only history.
      })
  }
  return remoteMergePromise
}

export type UseSpeechSendLogSyncResult = {
  /** Whether this browser is signed in and syncing speech-document history to the account. */
  synced: boolean
  /** Removes one entry both locally and (best-effort) from the account. */
  removeEntry: (id: string) => void
  /** Clears every entry both locally and (best-effort) from the account. */
  clearAll: () => void
}

/**
 * Binds account sync on top of `speechSendLogStore`'s existing local-first
 * state. Does not itself expose the entry list — `SpeechSendLogPanel`
 * already reads that straight from the store via its own subscription; this
 * hook only adds the sync side effects and the two mutators that also need
 * to touch the account.
 */
export function useSpeechSendLogSync(): UseSpeechSendLogSyncResult {
  const [synced, setSynced] = useState(remoteAvailable)

  useEffect(() => {
    let cancelled = false
    ensureRemoteMerged().then(() => {
      if (!cancelled) setSynced(remoteAvailable)
    })

    const unsubscribe = speechSendLogStore.subscribe((entries: SpeechSendLogEntry[]) => {
      if (!remoteAvailable) return
      for (const entry of entries) {
        if (knownSyncedIds.has(entry.id)) continue
        knownSyncedIds.add(entry.id)
        saveSpeechSendLogEntryToAccount(entry).catch(() => {
          // Best-effort — retry on the next store change that still
          // includes this entry (e.g. another tab's edit firing this
          // subscription again) by giving up the "known synced" claim.
          knownSyncedIds.delete(entry.id)
        })
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const removeEntry = useCallback((id: string) => {
    void speechSendLogStore.remove(id)
    knownSyncedIds.delete(id)
    if (remoteAvailable) {
      deleteSavedSpeechSendLogEntryFromAccount(id).catch(() => {
        // Best-effort — the entry is already removed locally either way.
      })
    }
  }, [])

  const clearAll = useCallback(() => {
    const ids = speechSendLogStore.list().map((e) => e.id)
    void speechSendLogStore.clear()
    for (const id of ids) knownSyncedIds.delete(id)
    if (remoteAvailable) {
      for (const id of ids) {
        deleteSavedSpeechSendLogEntryFromAccount(id).catch(() => {
          // Best-effort, same as removeEntry above.
        })
      }
    }
  }, [])

  return { synced, removeEntry, clearAll }
}
