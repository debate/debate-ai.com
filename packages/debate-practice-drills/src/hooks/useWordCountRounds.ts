"use client";

/**
 * @fileoverview Word-count-round history, saved to the account.
 * `WordCountRoundsPanel` reads and writes `localStorage`
 * (`@debate-ai/round`'s `state/wordCountRounds.ts`) through this hook, which
 * works the same signed out.
 *
 * Signed in, an account merge on the first mount of each page load (shared across hook
 * instances through the module-level `remoteMergePromise`, like
 * `useDrillSets`) reconciles local and account rounds by `roundId` with
 * `planWordCountRoundMerge`: a round only the account has is adopted
 * locally (`adoptWordCountRound`), a round only this browser has is pushed
 * up, and a `roundId` on both sides goes to whichever copy has the newer
 * `updatedAt`. Every save, delete and clear applies locally first and then
 * best-effort mirrors to `/api/word-count-rounds`; a failed request never
 * blocks the local change.
 *
 * The merge runs again when a signed-in tab returns to the foreground
 * (`visibilitychange`) more than `WORD_COUNT_REMERGE_TTL_MS` after the last
 * one settled — the same 10-minute rule as the generic tool-record sync
 * (`useToolRecordSync`) — so a round saved on another device appears without
 * a reload, and a failed merge or account write is retried then. A signed-out
 * tab is never re-merged.
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

/** How long after a merge settles before refocusing the tab merges again (matches `useToolRecordSync`). */
export const WORD_COUNT_REMERGE_TTL_MS = 10 * 60 * 1000;

type MergeOutcome = "pending" | "synced" | "signed-out" | "failed";

// Module-level so every mount in one page load shares one account fetch and
// one "this browser is signed in" flag.
let remoteAvailable = false;
let remoteMergePromise: Promise<MergeResult> | null = null;
let mergeOutcome: MergeOutcome = "pending";
let mergeSettledAt = 0;

/** Merges the account's word-count rounds into local storage, once until `refreshRemoteMergeIfStale` starts another. */
function ensureRemoteMerged(): Promise<MergeResult> {
  if (!remoteMergePromise) {
    mergeOutcome = "pending";
    remoteMergePromise = listSavedWordCountRounds()
      .then((remoteRecords): MergeResult => {
        if (remoteRecords === null) {
          remoteAvailable = false;
          mergeOutcome = "signed-out";
          return { adoptedRoundIds: [] };
        }
        remoteAvailable = true;

        const { adopt, pushLocal } = planWordCountRoundMerge(listWordCountRounds(), remoteRecords);
        for (const remote of adopt) adoptWordCountRound(remote);
        for (const local of pushLocal) {
          saveWordCountRoundToAccount(local).catch(() => {
            // Best-effort: the round stays local and is pushed again by the
            // next merge (a refocus past the TTL, or the next page load).
          });
        }
        mergeOutcome = "synced";
        return { adoptedRoundIds: adopt.map((record) => record.roundId) };
      })
      .catch((): MergeResult => {
        mergeOutcome = "failed";
        return { adoptedRoundIds: [] };
      })
      .finally(() => {
        mergeSettledAt = Date.now();
      });
  }
  return remoteMergePromise;
}

/**
 * The merge to apply when the tab comes back to the foreground at `now`: the
 * in-flight one if a merge is still running, a fresh one if the last merge
 * settled at least `WORD_COUNT_REMERGE_TTL_MS` ago, or `null` when there is
 * nothing to do (no merge yet, merged recently, or signed out).
 */
function refreshRemoteMergeIfStale(now: number): Promise<MergeResult> | null {
  if (!remoteMergePromise || mergeOutcome === "signed-out") return null;
  if (mergeOutcome === "pending") return remoteMergePromise;
  if (now - mergeSettledAt < WORD_COUNT_REMERGE_TTL_MS) return null;
  remoteMergePromise = null;
  return ensureRemoteMerged();
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
    const applyMerge = (merge: Promise<MergeResult>) => {
      merge.then(({ adoptedRoundIds }) => {
        if (!active) return;
        setSynced(remoteAvailable);
        if (adoptedRoundIds.length > 0) {
          setRounds(buildWordCountRoundsPanelView());
          setSyncNotice(buildWordCountSyncNoticeMessage(adoptedRoundIds));
        }
      });
    };

    setRounds(buildWordCountRoundsPanelView());
    applyMerge(ensureRemoteMerged());

    // Pull in rounds other devices saved while this tab sat in the background.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const merge = refreshRemoteMergeIfStale(Date.now());
      if (merge) applyMerge(merge);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
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
