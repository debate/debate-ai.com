"use client";

/**
 * @fileoverview Account sync for a signed-in visitor's own quest-streak
 * preferences — the "account-syncing reminder opt-ins/streak freezes across
 * devices" follow-up named under the "🎮 Gamified Quests" bullet in
 * TODO.md, plus that same follow-up's own gap: the mission-result history
 * `freezeDayKeys` is itself derived from never synced either. Wraps
 * `state/streakLapseReminders.ts`/`state/streakFreezes.ts`/`state/dailyMissionResults.ts`'s
 * existing local (per-contributor-id, localStorage) stores: local-first
 * (works fully signed out, mirroring every other synced field's hook in
 * this repo), then best-effort merges in the account's synced copy on mount
 * (via `mergeRemoteStreakFreezeDayKeys`/`mergeRemoteStreakLapseReminderEnabled`/
 * `mergeRemoteMissionResultDays`'s additive-only merge) and pushes each
 * local change back to the account one op at a time via the `/api/settings`
 * `recordStreakFreezeDayKey`/`setLapseReminderEnabled`/
 * `recordMissionResultDay` ops, mirroring `useResearchProgressGoalSync.ts`'s
 * split.
 *
 * Unlike that hook, there is no single "current value" to hold in state
 * here — `QuestStreaksPanel` already reads both preferences straight from
 * the local stores for every row in its roster (including the signed-in
 * visitor's own), so this hook's job is purely to keep that local copy in
 * sync with the account, not to hold its own copy of the data.
 *
 * `pushFreezeDayKey`/`pushLapseReminderEnabled` each push a single op,
 * resolved server-side against the account's current stored value — not a
 * whole-`questStreakSync`-value replace, which let two tabs/devices
 * silently drop each other's freeze or revert one via a reminder toggle
 * (see `quest-streak-sync.ts#applyQuestStreakFreezeOp`'s docstring).
 *
 * @module hooks/useQuestStreakSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyMissionResult } from "../lib/gamified-quests";
import {
  fetchQuestStreakSync,
  saveLapseReminderEnabledOp,
  saveMissionResultDayOp,
  saveStreakFreezeDayKeyOp,
} from "../lib/quest-streak-sync-client";
import { mergeRemoteMissionResultDays } from "../state/dailyMissionResults";
import { mergeRemoteStreakFreezeDayKeys } from "../state/streakFreezes";
import { mergeRemoteStreakLapseReminderEnabled } from "../state/streakLapseReminders";

export interface UseQuestStreakSyncResult {
  /** Whether the initial mount-time merge attempt (success, failure, or signed-out no-op) has finished. */
  loaded: boolean;
  /**
   * Pushes a single just-spent freeze `dayKey` to the account, resolved
   * server-side against the account's current stored freeze list. Best-effort
   * and a no-op when signed out or the initial account fetch hasn't resolved
   * yet — call this right after `state/streakFreezes.ts#applyPersistedStreakFreeze`
   * succeeds for this same contributor.
   */
  pushFreezeDayKey: (dayKey: string) => void;
  /**
   * Pushes the contributor's current reminder opt-in to the account,
   * resolved server-side without disturbing the account's stored freeze
   * list. Best-effort and a no-op when signed out or the initial account
   * fetch hasn't resolved yet — call this right after
   * `state/streakLapseReminders.ts#setStreakLapseReminderEnabled` for this
   * same contributor.
   */
  pushLapseReminderEnabled: (enabled: boolean) => void;
  /**
   * Pushes a single just-recorded mission-result day to the account,
   * resolved server-side against the account's current stored
   * `missionResultDays` and upserted by `dayKey`. Best-effort and a no-op
   * when signed out or the initial account fetch hasn't resolved yet — call
   * this right after `state/dailyMissionResults.ts#computeAndSavePersistedDailyMissionResult`
   * succeeds for this same contributor.
   */
  pushMissionResultDay: (entry: DailyMissionResult) => void;
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
        const missionResultChanged = mergeRemoteMissionResultDays(
          contributorId,
          remote.questStreakSync.missionResultDays ?? [],
        );
        if (freezeChanged || reminderChanged || missionResultChanged) onMergedRef.current?.();
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

  const pushFreezeDayKey = useCallback(
    (dayKey: string) => {
      if (!contributorId || !remoteAvailableRef.current) return;
      saveStreakFreezeDayKeyOp(dayKey).catch(() => {
        // Best-effort — the local change above already succeeded.
      });
    },
    [contributorId],
  );

  const pushLapseReminderEnabled = useCallback(
    (enabled: boolean) => {
      if (!contributorId || !remoteAvailableRef.current) return;
      saveLapseReminderEnabledOp(enabled).catch(() => {
        // Best-effort — the local change above already succeeded.
      });
    },
    [contributorId],
  );

  const pushMissionResultDay = useCallback(
    (entry: DailyMissionResult) => {
      if (!contributorId || !remoteAvailableRef.current) return;
      saveMissionResultDayOp(entry).catch(() => {
        // Best-effort — the local change above already succeeded.
      });
    },
    [contributorId],
  );

  return { loaded, pushFreezeDayKey, pushLapseReminderEnabled, pushMissionResultDay };
}
