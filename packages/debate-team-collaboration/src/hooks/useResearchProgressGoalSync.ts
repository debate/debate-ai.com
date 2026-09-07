"use client";

/**
 * @fileoverview Account sync for a signed-in visitor's personal
 * research-progress goal — the "account-syncing the goal across devices"
 * follow-up named under the "📈 Research Progress Tracking" bullet in
 * TODO.md. Wraps `state/researchProgressGoals.ts`'s existing local
 * (per-contributor-id, localStorage) goal store: local-first (works fully
 * signed out, mirroring every other synced field's hook in this repo), then
 * best-effort merges in the account's synced goal on mount and pushes every
 * `saveGoal`/`clearGoal` back to the account via the `/api/settings`
 * `researchProgressGoal` field, mirroring `useSavedArgumentCollections.ts`'s
 * split.
 *
 * Unlike that hook, this one is keyed by `contributorId` (the free-form id
 * `ResearchProgressPanel` highlights as "You", derived from the real signed-in
 * session by the caller — see `lib/session-identity.ts`) rather than holding
 * its own list: the account row itself is scoped to the real signed-in user
 * via `/api/settings`'s session check, so there is nothing to key by
 * remotely, but the *local* store this hook writes into still needs a
 * contributor id to file the merged goal under.
 *
 * @module hooks/useResearchProgressGoalSync
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearGoalForContributor,
  getPersistedGoalProgressForContributor,
  setGoalForContributor,
} from "../state/researchProgressGoals";
import { fetchResearchProgressGoal, saveResearchProgressGoal } from "../lib/research-progress-goal-sync-client";
import type { GoalProgress } from "../lib/research-progress";

export type UseResearchProgressGoalSyncResult = {
  goalProgress: GoalProgress | undefined;
  loaded: boolean;
  /** Set only when the most recent `saveGoal` call failed validation. */
  error: string | null;
  /** Sets (or replaces) `contributorId`'s goal, syncing it to the account when signed in. Returns `false` (and sets `error`) on an invalid target. */
  saveGoal: (targetCompletedTaskCount: number, topic?: string, targetDate?: string) => boolean;
  /** Clears `contributorId`'s goal locally and, when signed in, on the account too. */
  clearGoal: () => void;
  /** Re-derives `goalProgress` against the latest persisted research-progress board, e.g. after a completed task changes the roster. */
  refresh: () => void;
};

/**
 * Binds `contributorId`'s personal research-progress goal: local-first
 * state (`state/researchProgressGoals.ts`), synced to the account when
 * signed in. Returns an all-`undefined`/no-op result when `contributorId`
 * is unset, matching `ResearchProgressPanel`'s "goal section only for a
 * signed-in visitor" behavior.
 */
export function useResearchProgressGoalSync(contributorId: string | undefined): UseResearchProgressGoalSyncResult {
  const [goalProgress, setGoalProgress] = useState<GoalProgress | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remoteAvailableRef = useRef(false);

  const refresh = useCallback(() => {
    setGoalProgress(contributorId ? getPersistedGoalProgressForContributor(contributorId) : undefined);
  }, [contributorId]);

  useEffect(() => {
    remoteAvailableRef.current = false;
    refresh();
    setLoaded(true);
    if (!contributorId) return;

    let cancelled = false;
    fetchResearchProgressGoal()
      .then((remote) => {
        if (cancelled || remote === null) return;
        remoteAvailableRef.current = true;
        if (remote.goal) {
          setGoalForContributor({ contributorId, ...remote.goal });
          refresh();
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep
        // whatever's already local rather than blocking, mirroring
        // useSavedArgumentCollections's same catch.
      });
    return () => {
      cancelled = true;
    };
  }, [contributorId, refresh]);

  const saveGoal = useCallback(
    (targetCompletedTaskCount: number, topic?: string, targetDate?: string) => {
      if (!contributorId) return false;
      setError(null);
      try {
        setGoalForContributor({ contributorId, targetCompletedTaskCount, topic, targetDate });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save goal.");
        return false;
      }
      refresh();
      if (remoteAvailableRef.current) {
        saveResearchProgressGoal({ targetCompletedTaskCount, topic, targetDate }).catch(() => {
          // Best-effort — the local apply above already succeeded.
        });
      }
      return true;
    },
    [contributorId, refresh],
  );

  const clearGoal = useCallback(() => {
    if (!contributorId) return;
    clearGoalForContributor(contributorId);
    refresh();
    if (remoteAvailableRef.current) {
      saveResearchProgressGoal(null).catch(() => {
        // Best-effort — the local clear above already succeeded.
      });
    }
  }, [contributorId, refresh]);

  return { goalProgress, loaded, error, saveGoal, clearGoal, refresh };
}
