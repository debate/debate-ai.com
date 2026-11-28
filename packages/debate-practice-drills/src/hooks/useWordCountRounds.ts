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
 * A delete is the one write whose failure the user has to hear about: the
 * account would still hold the round, so the next merge (here or on another
 * device) brings it back. Every deleted `roundId` waits in
 * `pendingAccountDeletes` (persisted in `localStorage`, so it survives a tab
 * close) until the account confirms it. The merge leaves
 * those ids out of the account's list before planning (so a delete made
 * while the first merge is still in flight isn't undone by it) and deletes
 * them from the account; whatever still fails comes back as
 * `accountDeleteError`, with `retryAccountDeletes` to try again. Saving a
 * round under a pending id cancels its delete.
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

import { useCallback, useEffect, useRef, useState } from "react";
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
import { createPendingWordCountDeletes } from "../state/pendingWordCountDeletes";
import { buildWordCountDeleteFailureMessage } from "../state/savedWordCountRounds";

/** `attemptedDeleteIds`: the pending deletes this merge sent; `failedDeleteIds`: the ones the account refused. */
type MergeResult = { adoptedRoundIds: string[]; attemptedDeleteIds: string[]; failedDeleteIds: string[] };

/** How long after a merge settles before refocusing the tab merges again (matches `useToolRecordSync`). */
export const WORD_COUNT_REMERGE_TTL_MS = 10 * 60 * 1000;

type MergeOutcome = "pending" | "synced" | "signed-out" | "failed";

// Module-level so every mount in one page load shares one account fetch and
// one "this browser is signed in" flag.
let remoteAvailable = false;
let remoteMergePromise: Promise<MergeResult> | null = null;
let mergeOutcome: MergeOutcome = "pending";
let mergeSettledAt = 0;
/**
 * Rounds deleted in this browser that the account hasn't confirmed removing
 * yet. Kept in `localStorage` (`state/pendingWordCountDeletes.ts`), so a
 * delete that failed before the tab closed is still sent by the next page
 * load's merge instead of the round being adopted back.
 */
const pendingAccountDeletes = createPendingWordCountDeletes();

/**
 * Deletes `roundIds` from the account and resolves with the ones that failed.
 * A confirmed id leaves `pendingAccountDeletes`; a failed one stays for the
 * next merge or a retry. Never rejects.
 */
async function sendAccountDeletes(roundIds: readonly string[]): Promise<string[]> {
  const results = await Promise.all(
    roundIds.map((roundId) =>
      deleteSavedWordCountRoundFromAccount(roundId).then(
        () => {
          pendingAccountDeletes.delete(roundId);
          return null;
        },
        () => roundId,
      ),
    ),
  );
  return results.filter((roundId): roundId is string => roundId !== null);
}

/** Merges the account's word-count rounds into local storage, once until `refreshRemoteMergeIfStale` starts another. */
function ensureRemoteMerged(): Promise<MergeResult> {
  if (!remoteMergePromise) {
    mergeOutcome = "pending";
    remoteMergePromise = listSavedWordCountRounds()
      .then((remoteRecords): MergeResult | Promise<MergeResult> => {
        if (remoteRecords === null) {
          remoteAvailable = false;
          mergeOutcome = "signed-out";
          // Signed out there is no account copy to remove.
          pendingAccountDeletes.clear();
          return { adoptedRoundIds: [], attemptedDeleteIds: [], failedDeleteIds: [] };
        }
        remoteAvailable = true;

        // A round deleted here is never adopted back; it is deleted from the account instead.
        const deleting = pendingAccountDeletes.values();
        const kept = remoteRecords.filter((record) => !deleting.includes(record.roundId));
        const { adopt, pushLocal } = planWordCountRoundMerge(listWordCountRounds(), kept);
        for (const remote of adopt) adoptWordCountRound(remote);
        for (const local of pushLocal) {
          saveWordCountRoundToAccount(local).catch(() => {
            // Best-effort: the round stays local and is pushed again by the
            // next merge (a refocus past the TTL, or the next page load).
          });
        }
        mergeOutcome = "synced";
        return sendAccountDeletes(deleting).then((failedDeleteIds) => ({
          adoptedRoundIds: adopt.map((record) => record.roundId),
          attemptedDeleteIds: deleting,
          failedDeleteIds,
        }));
      })
      .catch((): MergeResult => {
        mergeOutcome = "failed";
        return { adoptedRoundIds: [], attemptedDeleteIds: [], failedDeleteIds: [] };
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
  // Saving under an id that was waiting to be deleted keeps the round after all.
  pendingAccountDeletes.delete(roundId);
  if (!remoteAvailable) return;
  const stamped = getWordCountRound(roundId);
  if (!stamped) return;
  saveWordCountRoundToAccount(stamped).catch(() => {
    // Best-effort: the round is already saved locally.
  });
}

/**
 * Removes rounds from the account and resolves with the ids that failed.
 * Signed out nothing is sent. Before the first merge has said whether this
 * browser is signed in, the ids wait for that merge, which deletes them.
 */
function deleteFromAccount(roundIds: readonly string[]): Promise<string[]> {
  if (mergeOutcome === "signed-out") return Promise.resolve([]);
  for (const roundId of roundIds) pendingAccountDeletes.add(roundId);
  if (!remoteAvailable) return Promise.resolve([]);
  return sendAccountDeletes(roundIds);
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
  /** Says which deleted rounds the account still has; empty when every delete went through. */
  accountDeleteError: string;
  /** Sends the failed account deletes again. */
  retryAccountDeletes: () => void;
  dismissAccountDeleteError: () => void;
};

/** Binds the current user's word-count round history: local-first, merged with and saved to the account when signed in. */
export function useWordCountRounds(): UseWordCountRoundsResult {
  const [rounds, setRounds] = useState<WordCountRoundRecord[] | null>(null);
  const [synced, setSynced] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [failedDeleteIds, setFailedDeleteIds] = useState<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Records the outcome of account deletes for `attempted`: drops those that went through, adds those that failed. */
  const settleDeletes = useCallback((attempted: readonly string[], failed: readonly string[]) => {
    if (!mounted.current) return;
    setFailedDeleteIds((current) => {
      const next = current.filter((roundId) => !attempted.includes(roundId));
      for (const roundId of failed) if (!next.includes(roundId)) next.push(roundId);
      return next.length === current.length && next.every((id, i) => id === current[i]) ? current : next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    const applyMerge = (merge: Promise<MergeResult>) => {
      merge.then(({ adoptedRoundIds, attemptedDeleteIds, failedDeleteIds: failed }) => {
        if (!active) return;
        setSynced(remoteAvailable);
        settleDeletes(attemptedDeleteIds, failed);
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
  }, [settleDeletes]);

  /** A `storage` event never fires in the tab that made the write, only in other tabs. */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isWordCountRoundsLiveUpdateStorageEvent(event)) return;
      setRounds(buildWordCountRoundsPanelView());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveRound = useCallback(
    (record: WordCountRoundRecord) => {
      saveWordCountRound(record);
      setRounds(buildWordCountRoundsPanelView());
      pushToAccount(record.roundId);
      settleDeletes([record.roundId], []);
    },
    [settleDeletes],
  );

  const removeFromAccount = useCallback(
    (roundIds: string[]) => {
      deleteFromAccount(roundIds).then((failed) => settleDeletes(roundIds, failed));
    },
    [settleDeletes],
  );

  const deleteRound = useCallback(
    (roundId: string) => {
      deleteWordCountRound(roundId);
      setRounds(buildWordCountRoundsPanelView());
      removeFromAccount([roundId]);
    },
    [removeFromAccount],
  );

  const clearAllRounds = useCallback(() => {
    const removed = clearWordCountRounds();
    if (removed.length === 0) return;
    setRounds(buildWordCountRoundsPanelView());
    removeFromAccount(removed);
  }, [removeFromAccount]);

  const retryAccountDeletes = useCallback(() => {
    // Only ids still waiting: one saved again since, or deleted by a merge, is no longer failed.
    const retry = failedDeleteIds.filter((roundId) => pendingAccountDeletes.has(roundId));
    settleDeletes(failedDeleteIds.filter((roundId) => !retry.includes(roundId)), []);
    if (retry.length > 0) removeFromAccount(retry);
  }, [failedDeleteIds, removeFromAccount, settleDeletes]);

  const dismissSyncNotice = useCallback(() => setSyncNotice(""), []);
  const dismissAccountDeleteError = useCallback(() => setFailedDeleteIds([]), []);

  return {
    rounds,
    synced,
    syncNotice,
    dismissSyncNotice,
    saveRound,
    deleteRound,
    clearAllRounds,
    accountDeleteError: buildWordCountDeleteFailureMessage(failedDeleteIds),
    retryAccountDeletes,
    dismissAccountDeleteError,
  };
}
