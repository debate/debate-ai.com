"use client";

/**
 * @fileoverview Account-synced word-count-round history — TODO.md idea #2
 * ("Word-Count-Only Speech Format"), "account-sync round history itself
 * (today `wordCountRounds` is local-storage-only, unlike
 * `wordLimitPresets`), so the trend view follows a signed-in user across
 * devices instead of staying per-browser" follow-up.
 *
 * Local-first, like `useWordLimitPresets`: `WordCountRoundsPanel` (the sole
 * consumer of `state/wordCountRounds.ts`) keeps reading/writing
 * `localStorage` through this hook, which stays fully usable signed out.
 * On mount, a one-time account merge (deduped across instances via a
 * module-level `remoteMergePromise`, mirroring `useWordLimitPresets`'s
 * `remoteLoadPromise`) reconciles local and remote history — unlike
 * `useWordLimitPresets`'s "whole list, remote wins" merge (a small, bounded
 * settings list), round history is a growing, independently-addressable
 * set of records, so this merges by `roundId` instead: a remote record with
 * no local counterpart is adopted locally (`adoptWordCountRound`,
 * preserving its original `createdAt`), and a local-only record (saved
 * before this feature existed, or saved offline) is best-effort pushed up.
 * Neither direction ever overwrites a `roundId` both sides already have —
 * this hook doesn't resolve edit conflicts, just fills gaps — since a
 * word-count round is edited once and saved, not iteratively revised like a
 * flow or a settings row.
 *
 * @module hooks/useWordCountRounds
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptWordCountRound,
  buildWordCountRoundsPanelView,
  clearWordCountRounds,
  deleteWordCountRound,
  getWordCountRound,
  listWordCountRounds,
  saveWordCountRound,
  type WordCountRoundRecord,
} from "../state/wordCountRounds";
import {
  deleteAllSavedWordCountRoundsFromAccount,
  deleteSavedWordCountRoundFromAccount,
  listSavedWordCountRounds,
  saveWordCountRoundToAccount,
} from "../round/word-count-rounds-client";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced rounds into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedWordCountRounds()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listWordCountRounds();
        const localIds = new Set(localRecords.map((record) => record.roundId));
        const remoteIds = new Set(remoteRecords.map((record) => record.roundId));

        let changed = false;
        for (const remote of remoteRecords) {
          if (!localIds.has(remote.roundId)) {
            adoptWordCountRound(remote);
            changed = true;
          }
        }
        for (const local of localRecords) {
          if (!remoteIds.has(local.roundId)) {
            saveWordCountRoundToAccount(local).catch(() => {
              // Best-effort — this round stays local-only until a later
              // successful sync (e.g. the next save/mount).
            });
          }
        }
        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export type UseWordCountRoundsResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  rounds: WordCountRoundRecord[] | null;
  /** Whether this browser is signed in and syncing round history to the account — mirrors `UserSettingsPanel`'s own `remoteAvailable` state. */
  synced: boolean;
  saveRound: (record: WordCountRoundRecord) => void;
  deleteRound: (roundId: string) => void;
  /** Clears every persisted round at once ("delete all my synced history"). */
  clearAllRounds: () => void;
};

/**
 * Binds the current user's word-count round history: local-first state
 * (`state/wordCountRounds.ts`), merged with and best-effort synced to the
 * account when signed in.
 */
export function useWordCountRounds(): UseWordCountRoundsResult {
  const [rounds, setRounds] = useState<WordCountRoundRecord[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setRounds(buildWordCountRoundsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setRounds(buildWordCountRoundsPanelView());
    });
  }, []);

  const saveRound = useCallback((record: WordCountRoundRecord) => {
    saveWordCountRound(record);
    setRounds(buildWordCountRoundsPanelView());
    if (remoteAvailable) {
      // Re-read rather than pushing `record` as-is: `saveWordCountRound`
      // just stamped/preserved its `createdAt` locally, and the synced copy
      // needs that same timestamp so the trend view sorts consistently
      // across devices.
      const stamped = getWordCountRound(record.roundId);
      if (stamped) {
        saveWordCountRoundToAccount(stamped).catch(() => {
          // Best-effort — the round is already saved locally above, matching
          // useWordLimitPresets's "local apply is never blocked by a sync
          // failure" convention.
        });
      }
    }
  }, []);

  const deleteRound = useCallback((roundId: string) => {
    deleteWordCountRound(roundId);
    setRounds(buildWordCountRoundsPanelView());
    if (remoteAvailable) {
      deleteSavedWordCountRoundFromAccount(roundId).catch(() => {
        // Best-effort, same as saveRound above.
      });
    }
  }, []);

  const clearAllRounds = useCallback(() => {
    const removedIds = clearWordCountRounds();
    if (removedIds.length === 0) return;
    setRounds(buildWordCountRoundsPanelView());
    if (remoteAvailable) {
      deleteAllSavedWordCountRoundsFromAccount().catch(() => {
        // Best-effort, same as deleteRound above — history is already gone
        // locally either way.
      });
    }
  }, []);

  return { rounds, synced, saveRound, deleteRound, clearAllRounds };
}
