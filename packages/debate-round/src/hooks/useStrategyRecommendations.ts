"use client";

/**
 * @fileoverview Account-synced strategy-recommendation history — the
 * "🧭 Scout-to-Strategy Workflow" bullet's "a history log of past strategy
 * recommendations per matchup" follow-up.
 *
 * Local-first, like `useJudgeDecisions`: `StrategyPanel` (the sole consumer
 * of `state/strategyRecommendations.ts`) keeps reading/writing
 * `localStorage` through this hook, which stays fully usable signed out. On
 * mount, a one-time account merge (deduped across instances via a
 * module-level `remoteMergePromise`, mirroring `useJudgeDecisions`)
 * reconciles local and remote history — merged by each recommendation's own
 * `id` (not `matchupId`, since many recommendations can share a matchup): a
 * remote recommendation with no local counterpart is adopted locally
 * (`adoptStrategyRecommendation`), and a local-only recommendation (saved
 * before this feature existed, or saved offline) is best-effort pushed up.
 *
 * `appendRecommendation` also enforces `state/strategyRecommendations.ts`'s
 * `MAX_STRATEGY_RECOMMENDATIONS_PER_MATCHUP` cap, best-effort deleting any
 * ids trimmed locally from the account too — mirrors
 * `useJudgeDecisions.ts#appendDecision`.
 *
 * `setAiCaseChoice` updates an already-persisted recommendation in place
 * (unlike an append, this record's `id` is unchanged), then re-pushes the
 * whole updated record to the account when signed in — the account route is
 * a plain upsert-by-`id`, so this "just works" the same way a fresh append
 * does.
 *
 * Also subscribes to the browser's `storage` event via `flow/live-update.ts`'s
 * `isStrategyLiveUpdateStorageEvent`, preserving `StrategyPanel`'s prior
 * cross-tab live-update behavior (a recommendation built or cleared in
 * another same-origin tab refreshes this one) now that the panel reads
 * through this hook instead of `state/strategyRecommendations.ts` directly.
 *
 * @module hooks/useStrategyRecommendations
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptStrategyRecommendation,
  appendStrategyRecommendation,
  buildStrategyRecommendationsPanelView,
  deleteStrategyRecommendation,
  deleteStrategyRecommendationsForMatchup,
  listStrategyRecommendations,
  updateStrategyRecommendationAiCaseChoice,
  type StrategyRecommendationMatchupGroup,
  type StrategyRecommendationRecord,
} from "../state/strategyRecommendations";
import type { CaseChoiceAiResult } from "../round/case-choice-ai";
import {
  deleteSavedStrategyRecommendationFromAccount,
  listSavedStrategyRecommendations,
  saveStrategyRecommendationToAccount,
} from "../round/strategy-recommendations-client";
import { isStrategyLiveUpdateStorageEvent } from "../flow/live-update";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced recommendations into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedStrategyRecommendations()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listStrategyRecommendations();
        const localIds = new Set(localRecords.map((record) => record.id));
        const remoteIds = new Set(remoteRecords.map((record) => record.id));

        let changed = false;
        for (const remote of remoteRecords) {
          if (!localIds.has(remote.id)) {
            adoptStrategyRecommendation(remote);
            changed = true;
          }
        }
        for (const local of localRecords) {
          if (!remoteIds.has(local.id)) {
            saveStrategyRecommendationToAccount(local).catch(() => {
              // Best-effort — this recommendation stays local-only until a
              // later successful sync (e.g. the next append/mount).
            });
          }
        }
        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export type UseStrategyRecommendationsResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  groups: StrategyRecommendationMatchupGroup[] | null;
  /** Whether this browser is signed in and syncing recommendation history to the account. */
  synced: boolean;
  appendRecommendation: (input: Omit<StrategyRecommendationRecord, "id">) => void;
  deleteRecommendation: (id: string) => void;
  /** Clears every recommendation for one matchup at once ("Clear all history for this matchup"). */
  deleteMatchupHistory: (matchupId: string) => void;
  /** Sets an already-persisted recommendation's `aiCaseChoice`, then re-syncs it to the account when signed in. */
  setAiCaseChoice: (id: string, aiCaseChoice: CaseChoiceAiResult) => void;
};

/**
 * Binds the current user's strategy-recommendation history: local-first
 * state (`state/strategyRecommendations.ts`), merged with and best-effort
 * synced to the account when signed in.
 */
export function useStrategyRecommendations(): UseStrategyRecommendationsResult {
  const [groups, setGroups] = useState<StrategyRecommendationMatchupGroup[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setGroups(buildStrategyRecommendationsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setGroups(buildStrategyRecommendationsPanelView());
    });
  }, []);

  /**
   * Live-update the recommendation history when another browser tab builds
   * or clears a recommendation. A `storage` event never fires in the tab
   * that made the write, only in other tabs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isStrategyLiveUpdateStorageEvent(event)) return;
      setGroups(buildStrategyRecommendationsPanelView());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const appendRecommendation = useCallback((input: Omit<StrategyRecommendationRecord, "id">) => {
    const { record, trimmedIds } = appendStrategyRecommendation(input);
    setGroups(buildStrategyRecommendationsPanelView());
    if (remoteAvailable) {
      saveStrategyRecommendationToAccount(record).catch(() => {
        // Best-effort — the recommendation is already saved locally above,
        // matching useJudgeDecisions's "local apply is never blocked by a
        // sync failure" convention.
      });
      for (const id of trimmedIds) {
        deleteSavedStrategyRecommendationFromAccount(id).catch(() => {
          // Best-effort, same as deleteMatchupHistory below — the id is
          // already trimmed locally either way.
        });
      }
    }
  }, []);

  const deleteRecommendation = useCallback((id: string) => {
    deleteStrategyRecommendation(id);
    setGroups(buildStrategyRecommendationsPanelView());
    if (remoteAvailable) {
      deleteSavedStrategyRecommendationFromAccount(id).catch(() => {
        // Best-effort, same as appendRecommendation above.
      });
    }
  }, []);

  const deleteMatchupHistory = useCallback((matchupId: string) => {
    const removedIds = deleteStrategyRecommendationsForMatchup(matchupId);
    if (removedIds.length === 0) return;
    setGroups(buildStrategyRecommendationsPanelView());
    if (remoteAvailable) {
      for (const id of removedIds) {
        deleteSavedStrategyRecommendationFromAccount(id).catch(() => {
          // Best-effort, same as deleteRecommendation above — the id is
          // already gone locally either way.
        });
      }
    }
  }, []);

  const setAiCaseChoice = useCallback((id: string, aiCaseChoice: CaseChoiceAiResult) => {
    const updated = updateStrategyRecommendationAiCaseChoice(id, aiCaseChoice);
    if (!updated) return;
    setGroups(buildStrategyRecommendationsPanelView());
    if (remoteAvailable) {
      saveStrategyRecommendationToAccount(updated).catch(() => {
        // Best-effort, same as appendRecommendation above.
      });
    }
  }, []);

  return { groups, synced, appendRecommendation, deleteRecommendation, deleteMatchupHistory, setAiCaseChoice };
}
