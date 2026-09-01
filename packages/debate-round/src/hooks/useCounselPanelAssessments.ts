"use client";

/**
 * @fileoverview Account-synced counsel-panel-assessment history — TODO.md
 * idea #4 ("AI Response-Outcome Charts"), "a timeline of past AI
 * counsel-panel assessments for a round, not just the latest" follow-up.
 *
 * Local-first, like `useJudgeDecisions`: `VulnerabilityChartsPanel` (the
 * sole consumer of `state/counselPanelAssessments.ts`) keeps
 * reading/writing `localStorage` through this hook, which stays fully
 * usable signed out. On mount, a one-time account merge (deduped across
 * instances via a module-level `remoteMergePromise`) reconciles local and
 * remote history — merged by each assessment's own `id` (not `roundId`,
 * since many assessments share a round): a remote assessment with no local
 * counterpart is adopted locally (`adoptCounselPanelAssessment`), and a
 * local-only assessment (saved before this feature existed, or saved
 * offline) is best-effort pushed up. Neither direction ever overwrites an
 * `id` both sides already have — an assessment is generated once and never
 * edited afterward, so there's nothing to reconcile beyond filling gaps.
 *
 * `appendAssessment` also enforces
 * `state/counselPanelAssessments.ts`'s
 * `MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND` cap, best-effort deleting any
 * ids trimmed locally from the account too.
 *
 * @module hooks/useCounselPanelAssessments
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptCounselPanelAssessment,
  appendCounselPanelAssessment,
  buildCounselPanelAssessmentsPanelView,
  deleteCounselPanelAssessment,
  deleteCounselPanelAssessmentsForRound,
  listCounselPanelAssessments,
  type CounselPanelAssessmentRecord,
  type CounselPanelAssessmentRoundGroup,
} from "../state/counselPanelAssessments";
import {
  deleteSavedCounselPanelAssessmentFromAccount,
  listSavedCounselPanelAssessments,
  saveCounselPanelAssessmentToAccount,
} from "../flow/counsel-panel-assessments-client";
import type { CounselPanelAiResult } from "../flow/response-outcome-ai";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced assessments into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedCounselPanelAssessments()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = listCounselPanelAssessments();
        const localIds = new Set(localRecords.map((record) => record.id));
        const remoteIds = new Set(remoteRecords.map((record) => record.id));

        let changed = false;
        for (const remote of remoteRecords) {
          if (!localIds.has(remote.id)) {
            adoptCounselPanelAssessment(remote);
            changed = true;
          }
        }
        for (const local of localRecords) {
          if (!remoteIds.has(local.id)) {
            saveCounselPanelAssessmentToAccount(local).catch(() => {
              // Best-effort — this assessment stays local-only until a
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

export type UseCounselPanelAssessmentsResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  groups: CounselPanelAssessmentRoundGroup[] | null;
  /** Whether this browser is signed in and syncing assessment history to the account. */
  synced: boolean;
  appendAssessment: (roundId: string, result: CounselPanelAiResult) => CounselPanelAssessmentRecord;
  deleteAssessment: (id: string) => void;
  /** Clears every assessment for one round at once ("Clear all history for this round"). */
  deleteRoundHistory: (roundId: string) => void;
};

/**
 * Binds the current user's counsel-panel-assessment history: local-first
 * state (`state/counselPanelAssessments.ts`), merged with and best-effort
 * synced to the account when signed in.
 */
export function useCounselPanelAssessments(): UseCounselPanelAssessmentsResult {
  const [groups, setGroups] = useState<CounselPanelAssessmentRoundGroup[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setGroups(buildCounselPanelAssessmentsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setGroups(buildCounselPanelAssessmentsPanelView());
    });
  }, []);

  const appendAssessment = useCallback((roundId: string, result: CounselPanelAiResult) => {
    const { record, trimmedIds } = appendCounselPanelAssessment({ roundId, result, generatedAt: Date.now() });
    setGroups(buildCounselPanelAssessmentsPanelView());
    if (remoteAvailable) {
      saveCounselPanelAssessmentToAccount(record).catch(() => {
        // Best-effort — the assessment is already saved locally above.
      });
      for (const id of trimmedIds) {
        deleteSavedCounselPanelAssessmentFromAccount(id).catch(() => {
          // Best-effort, same as deleteRoundHistory below — the id is
          // already trimmed locally either way.
        });
      }
    }
    return record;
  }, []);

  const deleteAssessment = useCallback((id: string) => {
    deleteCounselPanelAssessment(id);
    setGroups(buildCounselPanelAssessmentsPanelView());
    if (remoteAvailable) {
      deleteSavedCounselPanelAssessmentFromAccount(id).catch(() => {
        // Best-effort, same as appendAssessment above.
      });
    }
  }, []);

  const deleteRoundHistory = useCallback((roundId: string) => {
    const removedIds = deleteCounselPanelAssessmentsForRound(roundId);
    if (removedIds.length === 0) return;
    setGroups(buildCounselPanelAssessmentsPanelView());
    if (remoteAvailable) {
      for (const id of removedIds) {
        deleteSavedCounselPanelAssessmentFromAccount(id).catch(() => {
          // Best-effort, same as deleteAssessment above — the id is already
          // gone locally either way.
        });
      }
    }
  }, []);

  return { groups, synced, appendAssessment, deleteAssessment, deleteRoundHistory };
}
