"use client";

/**
 * @fileoverview Account sync for a signed-in visitor's own quest-streak
 * preferences — the "account-syncing reminder opt-ins/streak freezes across
 * devices" follow-up named under the "🎮 Gamified Quests" bullet in
 * TODO.md. Wraps `state/streakLapseReminders.ts`/`state/streakFreezes.ts`'s
 * existing local (per-contributor-id, localStorage) stores: local-first
 * (works fully signed out, mirroring every other synced field's hook in
 * this repo), then best-effort merges in the account's synced copy on mount
 * (via `mergeRemoteStreakFreezeDayKeys`/`mergeRemoteStreakLapseReminderEnabled`'s
 * additive-only merge) and pushes the contributor's current local state back
 * to the account after every local change, via the `/api/settings`
 * `questStreakSync` field — mirroring `useResearchProgressGoalSync.ts`'s
 * split.
 *
 * Unlike that hook, there is no single "current value" to hold in state
 * here — `QuestStreaksPanel` already reads both preferences straight from
 * the local stores for every row in its roster (including the signed-in
 * visitor's own), so this hook's job is purely to keep that local copy in
 * sync with the account, not to hold its own copy of the data.
 *
 * @module hooks/useQuestStreakSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchQuestStreakSync, saveQuestStreakSync } from "../lib/quest-streak-sync-client";
import { listStreakFreezeDayKeysForContributor, mergeRemoteStreakFreezeDayKeys } from "../state/streakFreezes";
import { isStreakLapseReminderEnabled, mergeRemoteStreakLapseReminderEnabled } from "../state/streakLapseReminders";

export interface UseQuestStreakSyncResult {
  /** Whether the initial mount-time merge attempt (success, failure, or signed-out no-op) has finished. */
  loaded: boolean;
  /**
   * Pushes `contributorId`'s current local reminder opt-in and freeze
   * dayKeys to the account. Best-effort and a no-op when signed out or the
   * initial account fetch hasn't resolved yet — call this after any local
   * change made through `state/streakFreezes.ts`/`state/streakLapseReminders.ts`
   * for this same contributor.
   */
  pushLocalState: () => void;
}

/**
 * Binds `contributorId`'s personal quest-streak preferences: local-first
 * state, synced to the account when signed in. Returns a no-op result when
 * `contributorId` is unset, matching `QuestStreaksPanel`'s "sync only the
 * signed-in visitor's own row" behavior.
 *
 * `onMerged` fires once, at most, if the mount-time account fetch actually
 * changed something locally (e.g. a freeze applied on another device) —
 * callers use it to re-render whatever's already reading the local store.
 */
export function useQuestStreakSync(contributorId: string | undefined, onMerged?: () => void): UseQuestStreakSyncResult {
  const [loaded, setLoaded] = useState(false);
  const remoteAvailableRef = useRef(false);
  const onMergedRef = useRef(onMerged);
  onMergedRef.current = onMerged;

  useEffect(() => {
    remoteAvailableRef.current = false;
    setLoaded(false);
    if (!contributorId) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    fetchQuestStreakSync()
      .then((remote) => {
        if (cancelled || remote === null) return;
        remoteAvailableRef.current = true;
        if (!remote.questStreakSync) return;

        const freezeChanged = mergeRemoteStreakFreezeDayKeys(contributorId, remote.questStreakSync.freezeDayKeys);
        const reminderChanged = mergeRemoteStreakLapseReminderEnabled(
          contributorId,
          remote.questStreakSync.lapseReminderEnabled,
        );
        if (freezeChanged || reminderChanged) onMergedRef.current?.();
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep
        // whatever's already local rather than blocking, mirroring
        // useResearchProgressGoalSync's same catch.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contributorId]);

  const pushLocalState = useCallback(() => {
    if (!contributorId || !remoteAvailableRef.current) return;
    saveQuestStreakSync({
      lapseReminderEnabled: isStreakLapseReminderEnabled(contributorId),
      freezeDayKeys: listStreakFreezeDayKeysForContributor(contributorId),
    }).catch(() => {
      // Best-effort — the local change above already succeeded.
    });
  }, [contributorId]);

  return { loaded, pushLocalState };
}
