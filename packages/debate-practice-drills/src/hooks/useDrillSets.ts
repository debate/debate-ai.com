"use client";

/**
 * @fileoverview Account-synced drill sets — the "sharing the 'Practice
 * tier' status across devices for a signed-in user" follow-up named under
 * the "📚 AI Drill Generator" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features, and `docs/features/drill-sets.md`'s Known gaps.
 *
 * Local-first, like `useWordCountRounds`: `DrillSetsPanel` (the sole
 * consumer of `state/drillSets.ts`) keeps reading/writing `localStorage`
 * through this hook, which stays fully usable signed out. On mount, a
 * one-time account merge (deduped across instances via a module-level
 * `remoteMergePromise`, mirroring `useWordCountRounds`) reconciles local and
 * remote drill sets by `roundId`: a remote record with no local counterpart
 * is adopted locally (`adoptDrillSet`), a local-only record is best-effort
 * pushed up, and a `roundId` present on both sides is resolved via
 * `resolveDrillSetConflict` — the newer `updatedAt` wins (adopted locally if
 * remote is newer, pushed to the account if local is newer). Every
 * interactive mutation (`saveDrillSet`, `buildAndSaveDrillSet`,
 * `saveDrillAiScript`, `toggleDrillCompletion`, `scheduleDrillReview`,
 * `deleteDrillSet`) applies locally first, then best-effort pushes the
 * freshly-stamped record (or delete) to the account when signed in — the
 * local apply is never blocked by a sync failure, matching every other
 * synced-history hook's convention.
 *
 * @module hooks/useDrillSets
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptDrillSet,
  buildAndSaveDrillSet as buildAndSaveDrillSetLocal,
  buildDrillSetsPanelView,
  deleteDrillSet as deleteDrillSetLocal,
  getDrillSet,
  listDrillSets,
  planDrillSetMerge,
  saveDrillAiScript as saveDrillAiScriptLocal,
  saveDrillSet as saveDrillSetLocal,
  scheduleDrillReview as scheduleDrillReviewLocal,
  toggleDrillCompletion as toggleDrillCompletionLocal,
  type DrillSetRecord,
} from "../state/drillSets";
import {
  deleteSavedDrillSetFromAccount,
  listSavedDrillSets,
  saveDrillSetToAccount,
} from "../round/drill-sets-client";
import type { Flow } from "debate-round/src/types/flow";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced drill sets into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedDrillSets()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listDrillSets();
        const { adopt, pushLocal } = planDrillSetMerge(localRecords, remoteRecords);

        for (const remote of adopt) adoptDrillSet(remote);
        for (const local of pushLocal) {
          saveDrillSetToAccount(local).catch(() => {
            // Best-effort — this drill set stays queued to sync again on a
            // later successful attempt (e.g. the next mutation/mount).
          });
        }
        return adopt.length > 0;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

/** Best-effort pushes the current (freshly stamped) local copy of `roundId` to the account, if signed in. */
function pushToAccount(roundId: string): void {
  if (!remoteAvailable) return;
  const stamped = getDrillSet(roundId);
  if (!stamped) return;
  saveDrillSetToAccount(stamped).catch(() => {
    // Best-effort — the drill set is already saved locally, matching
    // useWordCountRounds's "local apply is never blocked by a sync failure"
    // convention.
  });
}

export type UseDrillSetsResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  drillSets: DrillSetRecord[] | null;
  /** Whether this browser is signed in and syncing drill sets to the account. */
  synced: boolean;
  saveDrillSet: (record: DrillSetRecord) => void;
  buildAndSaveDrillSet: (
    flow: Pick<Flow, "children" | "columns">,
    roundId: string,
    sideKey: string,
    options?: { collapseLimit?: number },
  ) => DrillSetRecord;
  deleteDrillSet: (roundId: string) => void;
  saveDrillAiScript: (roundId: string, drillIndex: number, aiScript: string) => void;
  toggleDrillCompletion: (roundId: string, drillIndex: number) => void;
  scheduleDrillReview: (roundId: string, drillIndex: number, dayKey: string | null) => void;
};

/**
 * Binds the current user's drill sets: local-first state
 * (`state/drillSets.ts`), merged with and best-effort synced to the account
 * when signed in.
 */
export function useDrillSets(): UseDrillSetsResult {
  const [drillSets, setDrillSets] = useState<DrillSetRecord[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setDrillSets(buildDrillSetsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setDrillSets(buildDrillSetsPanelView());
    });
  }, []);

  const saveDrillSet = useCallback((record: DrillSetRecord) => {
    saveDrillSetLocal(record);
    setDrillSets(buildDrillSetsPanelView());
    pushToAccount(record.roundId);
  }, []);

  const buildAndSaveDrillSet = useCallback(
    (
      flow: Pick<Flow, "children" | "columns">,
      roundId: string,
      sideKey: string,
      options: { collapseLimit?: number } = {},
    ) => {
      const record = buildAndSaveDrillSetLocal(flow, roundId, sideKey, options);
      setDrillSets(buildDrillSetsPanelView());
      pushToAccount(roundId);
      return record;
    },
    [],
  );

  const deleteDrillSet = useCallback((roundId: string) => {
    deleteDrillSetLocal(roundId);
    setDrillSets(buildDrillSetsPanelView());
    if (remoteAvailable) {
      deleteSavedDrillSetFromAccount(roundId).catch(() => {
        // Best-effort — the drill set is already gone locally either way.
      });
    }
  }, []);

  const saveDrillAiScript = useCallback((roundId: string, drillIndex: number, aiScript: string) => {
    saveDrillAiScriptLocal(roundId, drillIndex, aiScript);
    setDrillSets(buildDrillSetsPanelView());
    pushToAccount(roundId);
  }, []);

  const toggleDrillCompletion = useCallback((roundId: string, drillIndex: number) => {
    toggleDrillCompletionLocal(roundId, drillIndex);
    setDrillSets(buildDrillSetsPanelView());
    pushToAccount(roundId);
  }, []);

  const scheduleDrillReview = useCallback((roundId: string, drillIndex: number, dayKey: string | null) => {
    scheduleDrillReviewLocal(roundId, drillIndex, dayKey);
    setDrillSets(buildDrillSetsPanelView());
    pushToAccount(roundId);
  }, []);

  return {
    drillSets,
    synced,
    saveDrillSet,
    buildAndSaveDrillSet,
    deleteDrillSet,
    saveDrillAiScript,
    toggleDrillCompletion,
    scheduleDrillReview,
  };
}
