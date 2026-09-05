"use client";

/**
 * @fileoverview Account-synced routed task queues — the "account-syncing
 * routed queues across devices" follow-up named under the "🧭 Research Task
 * Routing" bullet in TODO.md's Research Crowdsourcing Organizer Features.
 *
 * Local-first, like `useDrillSets`: `TaskInboxPanel` keeps reading/writing
 * `localStorage` through `state/routedTaskQueues.ts` directly for every read
 * (`buildTaskInboxView`/`buildTeamCapacityView` compose across every
 * persisted queue at once, so this hook doesn't re-shape that view — it only
 * layers account sync on top), which stays fully usable signed out. On
 * mount, a one-time account merge (deduped across instances via a
 * module-level `remoteMergePromise`, mirroring `useDrillSets`) reconciles
 * local and remote routed queues by `topicId`: a remote record with no local
 * counterpart is adopted locally (`adoptRoutedTaskQueue`), a local-only
 * record is best-effort pushed up, and a `topicId` present on both sides is
 * resolved via `resolveRoutedTaskQueueConflict` — the newer `updatedAt` wins
 * (adopted locally if remote is newer, pushed to the account if local is
 * newer).
 *
 * `pushTopicToAccount` is exposed for the panel to call after every mutating
 * action that already goes through `saveRoutedTaskQueue`
 * (`routePersistedTopicTasks`, `completePersistedRoutedTask`,
 * `reassignPersistedRoutedTask`, `setPersistedRoutedTaskPriority`) — the
 * local apply is never blocked by a sync failure, matching every other
 * synced-history hook's convention. `deleteTopicFromAccount` mirrors it for
 * `deleteRoutedTaskQueue`.
 *
 * @module hooks/useRoutedTaskQueues
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptRoutedTaskQueue,
  getRoutedTaskQueue,
  listRoutedTaskQueues,
  planRoutedTaskQueueMerge,
} from "../state/routedTaskQueues";
import {
  deleteSavedRoutedTaskQueueFromAccount,
  listSavedRoutedTaskQueues,
  saveRoutedTaskQueueToAccount,
} from "../lib/routed-task-queues-client";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced routed task queues into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedRoutedTaskQueues()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listRoutedTaskQueues();
        const { adopt, pushLocal } = planRoutedTaskQueueMerge(localRecords, remoteRecords);

        for (const remote of adopt) adoptRoutedTaskQueue(remote);
        for (const local of pushLocal) {
          saveRoutedTaskQueueToAccount(local).catch(() => {
            // Best-effort — this queue stays queued to sync again on a
            // later successful attempt (e.g. the next mutation/mount).
          });
        }
        return adopt.length > 0;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

/** Best-effort pushes the current (freshly stamped) local copy of `topicId` to the account, if signed in. */
function pushTopicToAccount(topicId: string): void {
  if (!remoteAvailable) return;
  const stamped = getRoutedTaskQueue(topicId);
  if (!stamped) return;
  saveRoutedTaskQueueToAccount(stamped).catch(() => {
    // Best-effort — the queue is already saved locally, matching
    // useDrillSets's "local apply is never blocked by a sync failure"
    // convention.
  });
}

/** Best-effort deletes `topicId` from the account, if signed in. */
function deleteTopicFromAccount(topicId: string): void {
  if (!remoteAvailable) return;
  deleteSavedRoutedTaskQueueFromAccount(topicId).catch(() => {
    // Best-effort — the queue is already gone locally either way.
  });
}

export type UseRoutedTaskQueuesResult = {
  /** Whether this browser is signed in and syncing routed task queues to the account. */
  synced: boolean;
  /** Best-effort pushes the current local copy of `topicId` to the account. Call after any local mutation. */
  pushTopicToAccount: (topicId: string) => void;
  /** Best-effort removes `topicId` from the account. Call after a local delete. */
  deleteTopicFromAccount: (topicId: string) => void;
  /** Bumps to force a re-render of callers that read `listRoutedTaskQueues()`/`buildTaskInboxView()` after the initial account merge adopts remote data. */
  mergeVersion: number;
};

/**
 * Binds cross-device account sync for `state/routedTaskQueues.ts`: on mount,
 * merges the account's synced queues into local storage, then exposes
 * `pushTopicToAccount`/`deleteTopicFromAccount` for the caller
 * (`TaskInboxPanel`) to call after each local mutation.
 */
export function useRoutedTaskQueues(): UseRoutedTaskQueuesResult {
  const [synced, setSynced] = useState(false);
  const [mergeVersion, setMergeVersion] = useState(0);

  useEffect(() => {
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setMergeVersion((version) => version + 1);
    });
  }, []);

  const push = useCallback((topicId: string) => pushTopicToAccount(topicId), []);
  const remove = useCallback((topicId: string) => deleteTopicFromAccount(topicId), []);

  return {
    synced,
    pushTopicToAccount: push,
    deleteTopicFromAccount: remove,
    mergeVersion,
  };
}
