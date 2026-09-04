"use client";

/**
 * @fileoverview Account-synced judge-decision history — TODO.md idea #5
 * ("AI Judge Decision Modes"), "(b) a decision history log per round
 * instead of only the latest result" follow-up.
 *
 * Local-first, like `useWordCountRounds`: `JudgeDecisionPanel` (the sole
 * consumer of `state/judgeDecisions.ts`) keeps reading/writing
 * `localStorage` through this hook, which stays fully usable signed out.
 * On mount, a one-time account merge (deduped across instances via a
 * module-level `remoteMergePromise`, mirroring `useWordCountRounds`)
 * reconciles local and remote history — merged by each decision's own
 * `id` (not `roundId`, since many decisions share a round): a remote
 * decision with no local counterpart is adopted locally
 * (`adoptJudgeDecision`), and a local-only decision (saved before this
 * feature existed, or saved offline) is best-effort pushed up. Neither
 * direction ever overwrites an `id` both sides already have — a judge
 * decision is generated once and never edited afterward, so there's
 * nothing to reconcile beyond filling gaps.
 *
 * `appendDecision` also enforces `state/judgeDecisions.ts`'s
 * `MAX_JUDGE_DECISIONS_PER_ROUND` cap, best-effort deleting any ids trimmed
 * locally from the account too. That cap isn't re-checked during the merge
 * above, so a remote copy of an already-trimmed decision (only possible if
 * its account delete failed) can still be adopted back on a later mount —
 * an accepted edge case for this slice, not actively defended against.
 *
 * @module hooks/useJudgeDecisions
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptJudgeDecision,
  appendJudgeDecision,
  buildJudgeDecisionsPanelView,
  deleteJudgeDecision,
  deleteJudgeDecisionsForRound,
  listJudgeDecisions,
  type JudgeDecisionRecord,
  type JudgeDecisionRoundGroup,
} from "../state/judgeDecisions";
import {
  deleteSavedJudgeDecisionFromAccount,
  listSavedJudgeDecisions,
  saveJudgeDecisionToAccount,
} from "../round/judge-decisions-client";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced decisions into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedJudgeDecisions()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listJudgeDecisions();
        const localIds = new Set(localRecords.map((record) => record.id));
        const remoteIds = new Set(remoteRecords.map((record) => record.id));

        let changed = false;
        for (const remote of remoteRecords) {
          if (!localIds.has(remote.id)) {
            adoptJudgeDecision(remote);
            changed = true;
          }
        }
        for (const local of localRecords) {
          if (!remoteIds.has(local.id)) {
            saveJudgeDecisionToAccount(local).catch(() => {
              // Best-effort — this decision stays local-only until a later
              // successful sync (e.g. the next append/mount).
            });
          }
        }
        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export type UseJudgeDecisionsResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  groups: JudgeDecisionRoundGroup[] | null;
  /** Whether this browser is signed in and syncing decision history to the account. */
  synced: boolean;
  appendDecision: (input: Omit<JudgeDecisionRecord, "id">) => void;
  deleteDecision: (id: string) => void;
  /** Clears every decision for one round at once ("Clear all history for this round"). */
  deleteRoundHistory: (roundId: string) => void;
};

/**
 * Binds the current user's judge-decision history: local-first state
 * (`state/judgeDecisions.ts`), merged with and best-effort synced to the
 * account when signed in.
 */
export function useJudgeDecisions(): UseJudgeDecisionsResult {
  const [groups, setGroups] = useState<JudgeDecisionRoundGroup[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setGroups(buildJudgeDecisionsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setGroups(buildJudgeDecisionsPanelView());
    });
  }, []);

  const appendDecision = useCallback((input: Omit<JudgeDecisionRecord, "id">) => {
    const { record, trimmedIds } = appendJudgeDecision(input);
    setGroups(buildJudgeDecisionsPanelView());
    if (remoteAvailable) {
      saveJudgeDecisionToAccount(record).catch(() => {
        // Best-effort — the decision is already saved locally above, matching
        // useWordCountRounds's "local apply is never blocked by a sync
        // failure" convention.
      });
      for (const id of trimmedIds) {
        deleteSavedJudgeDecisionFromAccount(id).catch(() => {
          // Best-effort, same as deleteRoundHistory below — the id is
          // already trimmed locally either way.
        });
      }
    }
  }, []);

  const deleteDecision = useCallback((id: string) => {
    deleteJudgeDecision(id);
    setGroups(buildJudgeDecisionsPanelView());
    if (remoteAvailable) {
      deleteSavedJudgeDecisionFromAccount(id).catch(() => {
        // Best-effort, same as appendDecision above.
      });
    }
  }, []);

  const deleteRoundHistory = useCallback((roundId: string) => {
    const removedIds = deleteJudgeDecisionsForRound(roundId);
    if (removedIds.length === 0) return;
    setGroups(buildJudgeDecisionsPanelView());
    if (remoteAvailable) {
      for (const id of removedIds) {
        deleteSavedJudgeDecisionFromAccount(id).catch(() => {
          // Best-effort, same as deleteDecision above — the id is already
          // gone locally either way.
        });
      }
    }
  }, []);

  return { groups, synced, appendDecision, deleteDecision, deleteRoundHistory };
}
