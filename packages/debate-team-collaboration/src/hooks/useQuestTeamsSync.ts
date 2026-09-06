"use client";

/**
 * @fileoverview Account sync for the quest-competition team roster — the
 * "account-syncing team rosters across devices" follow-up named under the
 * "🎯 Daily Quests and Targets" bullet (Research Crowdsourcing Organizer
 * Features) in TODO.md. Wraps `state/dailyQuests.ts`'s existing
 * `"questTeams"` localStorage roster: local-first (works fully signed out,
 * mirroring every other synced field's hook in this repo), then best-effort
 * overwrites the local roster with the account's synced copy on mount (via
 * `replaceQuestTeams`) and pushes the current local roster back to the
 * account after every local change, via the `/api/settings` `questTeams`
 * field — mirroring `useQuestStreakSync.ts`'s "external local store,
 * explicit `pushLocalState` after each mutation" shape, but with a plain
 * overwrite-on-merge instead of an additive one, since a team roster is a
 * direct CRUD list (created/renamed/deleted), not per-contributor data that
 * could otherwise be lost by overwriting.
 *
 * Unlike `useQuestStreakSync`, there's no `contributorId` to scope this
 * to — the roster is the whole competition's teams, so this mounts
 * unconditionally.
 *
 * @module hooks/useQuestTeamsSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchQuestTeamsSync, saveQuestTeamsSync } from "../lib/quest-teams-sync-client";
import { listQuestTeams, replaceQuestTeams } from "../state/dailyQuests";

export interface UseQuestTeamsSyncResult {
  /** Whether the initial mount-time merge attempt (success, failure, or signed-out no-op) has finished. */
  loaded: boolean;
  /**
   * Pushes the current local team roster to the account. Best-effort and a
   * no-op when signed out or the initial account fetch hasn't resolved yet —
   * call this after any local change made through
   * `state/dailyQuests.ts`'s `saveQuestTeam`/`deleteQuestTeam`.
   */
  pushLocalState: () => void;
}

/**
 * Binds the quest-competition team roster: local-first state, synced to the
 * account when signed in.
 *
 * `onMerged` fires once, at most, if the mount-time account fetch actually
 * changed the local roster — callers use it to re-render whatever's already
 * reading the local store.
 */
export function useQuestTeamsSync(onMerged?: () => void): UseQuestTeamsSyncResult {
  const [loaded, setLoaded] = useState(false);
  const remoteAvailableRef = useRef(false);
  const onMergedRef = useRef(onMerged);
  onMergedRef.current = onMerged;

  useEffect(() => {
    let cancelled = false;
    fetchQuestTeamsSync()
      .then((remote) => {
        if (cancelled || remote === null) return;
        remoteAvailableRef.current = true;
        const local = listQuestTeams();
        const changed =
          local.length !== remote.questTeams.length || JSON.stringify(local) !== JSON.stringify(remote.questTeams);
        if (!changed) return;
        replaceQuestTeams(remote.questTeams);
        onMergedRef.current?.();
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep
        // whatever's already local rather than blocking, mirroring
        // useQuestStreakSync's same catch.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushLocalState = useCallback(() => {
    if (!remoteAvailableRef.current) return;
    saveQuestTeamsSync(listQuestTeams()).catch(() => {
      // Best-effort — the local change above already succeeded.
    });
  }, []);

  return { loaded, pushLocalState };
}
