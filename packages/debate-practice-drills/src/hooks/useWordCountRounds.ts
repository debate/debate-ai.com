"use client";

/**
 * @fileoverview Word-count-round history, saved to the account.
 * `WordCountRoundsPanel` reads and writes `localStorage`
 * (`@debate-ai/round`'s `state/wordCountRounds.ts`) through this hook, which
 * works the same signed out.
 *
 * Signed in, a one-time account merge per page load (shared across hook
 * instances through the module-level `remoteMergePromise`, like
 * `useDrillSets`) reconciles local and account rounds by `roundId` with
 * `planWordCountRoundMerge`: a round only the account has is adopted
 * locally (`adoptWordCountRound`), a round only this browser has is pushed
 * up, and a `roundId` on both sides goes to whichever copy has the newer
 * `updatedAt`. Every save, delete and clear applies locally first and then
 * best-effort mirrors to `/api/word-count-rounds`; a failed request never
 * blocks the local change.
 *
 * Subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isWordCountRoundsLiveUpdateStorageEvent`, so a round saved, cleared or
 * adopted from the account in another same-origin tab refreshes this one.
 *
 * @module hooks/useWordCountRounds
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptWordCountRound,
  buildWordCountRoundsPanelView,
  buildWordCountSyncNoticeMessage,
  clearWordCountRounds,
  deleteWordCountRound,
  getWordCountRound,
  listWordCountRounds,
  planWordCountRoundMerge,
  saveWordCountRound,
  type WordCountRoundRecord,
} from "@debate-ai/round/src/state/wordCountRounds";
import {
  deleteSavedWordCountRoundFromAccount,
  listSavedWordCountRounds,
  saveWordCountRoundToAccount,
} from "../round/word-count-rounds-client";
import { isWordCountRoundsLiveUpdateStorageEvent } from "../state/live-update";

type MergeResult = { adoptedRoundIds: string[] };

// Module-level so every mount in one page load shares one account fetch and
// one "this browser is signed in" flag.
let remoteAvailable = false;
let remoteMergePromise: Promise<MergeResult> | null = null;

/** Merges the account's word-count rounds into local storage once per page load. */
function ensureRemoteMerged(): Promise<MergeResult> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedWordCountRounds()
      .then((remoteRecords): MergeResult => {
        if (remoteRecords === null) return { adoptedRoundIds: [] };
        remoteAvailable = true;

        const { adopt, pushLocal } = planWordCountRoundMerge(listWordCountRounds(), remoteRecords);
        for (const remote of adopt) adoptWordCountRound(remote);
        for (const local of pushLocal) {
          saveWordCountRoundToAccount(local).catch(() => {
            // Best-effort: the round stays local and is pushed again on the
            // next page load's merge.
          });
        }
        return { adoptedRoundIds: adopt.map((record) => record.roundId) };
      })
      .catch((): MergeResult => ({ adoptedRoundIds: [] }));
  }
  return remoteMergePromise;
}

/** Best-effort pushes the freshly stamped local copy of `roundId` to the account, when signed in. */
function pushToAccount(roundId: string): void {
  if (!remoteAvailable) return;
  const stamped = getWordCountRound(roundId);
  if (!stamped) return;
  saveWordCountRoundToAccount(stamped).catch(() => {
    // Best-effort: the round is already saved locally.
  });
}

/** Best-effort removes rounds from the account, when signed in. */
function deleteFromAccount(roundIds: string[]): void {
  if (!remoteAvailable) return;
  for (const roundId of roundIds) {
    deleteSavedWordCountRoundFromAccount(roundId).catch(() => {
      // Best-effort: the round is already gone locally.
    });
  }
}

export type UseWordCountRoundsResult = {
  /** `null` until the initial local read completes. */
  rounds: WordCountRoundRecord[] | null;
  /** Whether this browser is signed in and saving rounds to the account. */
  synced: boolean;
  /** "Synced round … from another device." after the merge adopted rounds; empty otherwise. */
  syncNotice: string;
  dismissSyncNotice: () => void;
  saveRound: (record: WordCountRoundRecord) => void;
  deleteRound: (roundId: string) => void;
  /** Clears every saved round at once, here and in the account. */
  clearAllRounds: () => void;
};

/** Binds the current user's word-count round history: local-first, merged with and saved to the account when signed in. */
export function useWordCountRounds(): UseWordCountRoundsResult {
  const [rounds, setRounds] = useState<WordCountRoundRecord[] | null>(null);
  const [synced, setSynced] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");

  useEffect(() => {
    let active = true;
    setRounds(buildWordCountRoundsPanelView());
    ensureRemoteMerged().then(({ adoptedRoundIds }) => {
      if (!active) return;
      setSynced(remoteAvailable);
      if (adoptedRoundIds.length > 0) {
        setRounds(buildWordCountRoundsPanelView());
        setSyncNotice(buildWordCountSyncNoticeMessage(adoptedRoundIds));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  /** A `storage` event never fires in the tab that made the write, only in other tabs. */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isWordCountRoundsLiveUpdateStorageEvent(event)) return;
      setRounds(buildWordCountRoundsPanelView());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveRound = useCallback((record: WordCountRoundRecord) => {
    saveWordCountRound(record);
    setRounds(buildWordCountRoundsPanelView());
    pushToAccount(record.roundId);
  }, []);

  const deleteRound = useCallback((roundId: string) => {
    deleteWordCountRound(roundId);
    setRounds(buildWordCountRoundsPanelView());
    deleteFromAccount([roundId]);
  }, []);

  const clearAllRounds = useCallback(() => {
    const removed = clearWordCountRounds();
    if (removed.length === 0) return;
    setRounds(buildWordCountRoundsPanelView());
    deleteFromAccount(removed);
  }, []);

  const dismissSyncNotice = useCallback(() => setSyncNotice(""), []);

  return { rounds, synced, syncNotice, dismissSyncNotice, saveRound, deleteRound, clearAllRounds };
}
