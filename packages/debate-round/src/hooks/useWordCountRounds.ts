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
 * A `roundId` present on both sides is no longer skipped outright — TODO.md
 * idea #2's "resolving a same-`roundId` conflict between two devices
 * instead of only filling gaps" follow-up: `resolveWordCountRoundConflict`
 * compares each side's `updatedAt` and the newer copy wins (adopted locally
 * if remote is newer, pushed to the account if local is newer); if neither
 * side has a usable timestamp to compare, this still falls back to the
 * original safe no-op rather than guessing.
 *
 * Also surfaces a one-time "synced just now from another device" notice —
 * TODO.md idea #2's own next-named follow-up — the moment the merge
 * actually adopts a remote copy (a `roundId` new to this device, or an
 * existing one where the remote copy won `resolveWordCountRoundConflict`).
 * The merge decision itself is the pure, directly-tested
 * `planWordCountRoundMerge` in `state/wordCountRounds.ts`; this hook only
 * applies its plan and, via a module-level `consumeSyncNotice`, ensures the
 * notice is handed to exactly one hook instance's state rather than
 * re-appearing on every later mount of the same already-resolved merge.
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
  planWordCountRoundMerge,
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
// The roundIds a completed merge adopted from the account, waiting to be
// shown as a "synced from another device" notice — consumed (and cleared)
// by the first hook instance to observe the merge's completion, so a later
// mount that awaits the same cached `remoteMergePromise` doesn't re-show a
// notice for a sync that already happened.
let pendingSyncNoticeRoundIds: string[] = [];

/** Hands the pending sync notice, if any, to exactly one caller and clears it. */
function consumeSyncNotice(): string[] {
  const ids = pendingSyncNoticeRoundIds;
  pendingSyncNoticeRoundIds = [];
  return ids;
}

/** Merges the account's synced rounds into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedWordCountRounds()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listWordCountRounds();
        const { adopt, pushLocal } = planWordCountRoundMerge(localRecords, remoteRecords);

        for (const remote of adopt) adoptWordCountRound(remote);
        for (const local of pushLocal) {
          saveWordCountRoundToAccount(local).catch(() => {
            // Best-effort — this round stays queued to sync again on a
            // later successful attempt (e.g. the next save/mount).
          });
        }
        if (adopt.length > 0) {
          pendingSyncNoticeRoundIds = adopt.map((record) => record.roundId);
        }
        return adopt.length > 0;
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
  /**
   * `roundId`s the account merge just adopted from another device, if any —
   * pass to `buildWordCountSyncNoticeMessage` for a dismissible "synced from
   * another device" notice. Empty once dismissed (`dismissSyncNotice`) or
   * when nothing was adopted.
   */
  justSyncedRoundIds: string[];
  /** Dismisses the "synced from another device" notice. */
  dismissSyncNotice: () => void;
};

/**
 * Binds the current user's word-count round history: local-first state
 * (`state/wordCountRounds.ts`), merged with and best-effort synced to the
 * account when signed in.
 */
export function useWordCountRounds(): UseWordCountRoundsResult {
  const [rounds, setRounds] = useState<WordCountRoundRecord[] | null>(null);
  const [synced, setSynced] = useState(false);
  const [justSyncedRoundIds, setJustSyncedRoundIds] = useState<string[]>([]);

  useEffect(() => {
    setRounds(buildWordCountRoundsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setRounds(buildWordCountRoundsPanelView());
      const notice = consumeSyncNotice();
      if (notice.length > 0) setJustSyncedRoundIds(notice);
    });
  }, []);

  const dismissSyncNotice = useCallback(() => setJustSyncedRoundIds([]), []);

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

  return { rounds, synced, saveRound, deleteRound, clearAllRounds, justSyncedRoundIds, dismissSyncNotice };
}
