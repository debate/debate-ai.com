"use client";

/**
 * @fileoverview Account sync for the Standings tab (`StandingsPanel`) —
 * closes docs/features/team-rankings.md's "Standings data (logged/imported
 * tournament results, the custom points table, and the qualification
 * cutoff) is stored in localStorage only... it doesn't yet follow a
 * signed-in user across devices the way flows/rounds/word-count rounds and
 * the other `saved_*` D1-backed records do" Known gap.
 *
 * Local-first, like `debate-practice-drills`' `useWordCountRounds`:
 * `StandingsPanel` keeps reading/writing through `debate-data-sync`'s
 * `state/tournamentResults.ts`/`qualificationPointsTable.ts`/
 * `qualificationCutoff.ts` local stores directly, which stay fully usable
 * signed out. On mount, a one-time account merge (deduped across instances
 * via module-level promises, mirroring `useWordCountRounds`) reconciles
 * local and remote state:
 *
 * - **Tournament results** — results are create/delete only (never edited
 *   in place), so the merge is a plain union by `id`: a remote result with
 *   no local counterpart is adopted locally, and a local-only result (saved
 *   before this sync existed, or saved offline) is best-effort pushed up.
 *   No conflict resolution is needed since there is nothing to conflict —
 *   two devices logging the same result under different ids just both
 *   count, like two independently-scouted rounds.
 * - **Qualification points table / cutoff** — single-value settings, so
 *   this mirrors `useWordLimitPresets`'s simpler "remote wins if present,
 *   else push local up" rule: a saved remote value overwrites the local
 *   one on merge; a local-only value (nothing saved to the account yet) is
 *   pushed up so it isn't silently lost the first time this browser signs
 *   in.
 *
 * Every write helper below applies locally first (so the UI never blocks on
 * the network) and then best-effort syncs, matching every other synced
 * store in this repo's "local apply is never blocked by a sync failure"
 * convention.
 *
 * @module hooks/useStandingsAccountSync
 */

import { useCallback, useEffect, useState } from "react";
import {
  listTournamentResults,
  saveTournamentResult as saveTournamentResultLocal,
  deleteTournamentResult as deleteTournamentResultLocal,
  bulkImportTournamentResults as bulkImportTournamentResultsLocal,
  type TournamentResultRecord,
  type TournamentResultCsvImportResult,
} from "debate-data-sync/src/state/tournamentResults";
import {
  listSavedTournamentResults,
  saveTournamentResultToAccount,
  deleteSavedTournamentResultFromAccount,
} from "debate-data-sync/src/state/tournament-results-client";
import {
  getPersistedQualificationPointsTable,
  savePersistedQualificationPointsTable,
  resetPersistedQualificationPointsTable,
  getEffectiveQualificationPointsTable,
} from "debate-data-sync/src/state/qualificationPointsTable";
import type { QualificationPointsTable } from "debate-data-sync/src/rankings/ndca-standings";
import {
  getPersistedQualificationCutoff,
  savePersistedQualificationCutoff,
  resetPersistedQualificationCutoff,
  getEffectiveQualificationCutoff,
  type QualificationCutoffSettings,
} from "debate-data-sync/src/state/qualificationCutoff";
import {
  fetchQualificationPointsTable,
  saveQualificationPointsTable as saveQualificationPointsTableRemote,
  fetchQualificationCutoff,
  saveQualificationCutoff as saveQualificationCutoffRemote,
} from "debate-data-sync/src/state/qualification-settings-sync-client";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount — mirrors
// useWordCountRounds's remoteMergePromise convention.
let remoteAvailable = false;
let remoteMergePromise: Promise<void> | null = null;

function ensureRemoteMerged(): Promise<void> {
  if (!remoteMergePromise) {
    remoteMergePromise = Promise.all([
      listSavedTournamentResults()
        .then((remoteResults) => {
          if (remoteResults === null) return;
          remoteAvailable = true;

          const localResults = listTournamentResults();
          const localIds = new Set(localResults.map((result) => result.id));
          const remoteIds = new Set(remoteResults.map((result) => result.id));

          for (const remote of remoteResults) {
            if (!localIds.has(remote.id)) saveTournamentResultLocal(remote);
          }
          for (const local of localResults) {
            if (!remoteIds.has(local.id)) {
              saveTournamentResultToAccount(local).catch(() => {
                // Best-effort — stays queued to sync again on a later
                // successful attempt (e.g. the next log/mount).
              });
            }
          }
        })
        .catch(() => {
          // Signed out, or the load failed — leave `remoteAvailable` false
          // so every write below stays local-only, matching every other
          // synced store's fallback.
        }),
      fetchQualificationPointsTable()
        .then((remote) => {
          if (remote === null) return;
          remoteAvailable = true;
          if (remote.qualificationPointsTable !== null) {
            savePersistedQualificationPointsTable(remote.qualificationPointsTable);
          } else {
            const local = getPersistedQualificationPointsTable();
            if (local !== null) {
              saveQualificationPointsTableRemote(local).catch(() => {
                // Best-effort, same as above.
              });
            }
          }
        })
        .catch(() => {}),
      fetchQualificationCutoff()
        .then((remote) => {
          if (remote === null) return;
          remoteAvailable = true;
          if (remote.qualificationCutoff !== null) {
            savePersistedQualificationCutoff(remote.qualificationCutoff);
          } else {
            const local = getPersistedQualificationCutoff();
            if (local !== null) {
              saveQualificationCutoffRemote(local).catch(() => {
                // Best-effort, same as above.
              });
            }
          }
        })
        .catch(() => {}),
    ]).then(() => undefined);
  }
  return remoteMergePromise;
}

export type UseStandingsAccountSyncResult = {
  /** Whether this browser is signed in and syncing Standings data to the account. `false` until the initial merge completes (or fails/is signed out). */
  synced: boolean;
  saveTournamentResult: (record: TournamentResultRecord) => void;
  deleteTournamentResult: (id: string) => void;
  bulkImportTournamentResults: (rawCsv: string) => TournamentResultCsvImportResult;
  saveQualificationPointsTable: (table: QualificationPointsTable) => void;
  resetQualificationPointsTable: () => QualificationPointsTable;
  saveQualificationCutoff: (cutoff: QualificationCutoffSettings) => void;
  resetQualificationCutoff: () => QualificationCutoffSettings;
};

/**
 * Binds the Standings tab's account sync: local-first writes
 * (`debate-data-sync`'s existing stores), merged with and best-effort
 * synced to the account when signed in. Callers still read state (the
 * ranked standings, the points table, the cutoff) straight from those local
 * stores — this hook only wraps the *write* path so every save also syncs,
 * plus runs the one-time merge on mount.
 */
export function useStandingsAccountSync(onChange: () => void): UseStandingsAccountSyncResult {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ensureRemoteMerged().then(() => {
      if (cancelled) return;
      setSynced(remoteAvailable);
      onChange();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveTournamentResult = useCallback((record: TournamentResultRecord) => {
    saveTournamentResultLocal(record);
    if (remoteAvailable) {
      saveTournamentResultToAccount(record).catch(() => {
        // Best-effort — the result is already saved locally above.
      });
    }
  }, []);

  const deleteTournamentResult = useCallback((id: string) => {
    deleteTournamentResultLocal(id);
    if (remoteAvailable) {
      deleteSavedTournamentResultFromAccount(id).catch(() => {
        // Best-effort, same as saveTournamentResult above.
      });
    }
  }, []);

  const bulkImportTournamentResults = useCallback((rawCsv: string) => {
    const result = bulkImportTournamentResultsLocal(rawCsv);
    if (remoteAvailable && result.importedCount > 0) {
      for (const record of listTournamentResults().slice(-result.importedCount)) {
        saveTournamentResultToAccount(record).catch(() => {
          // Best-effort, same as saveTournamentResult above.
        });
      }
    }
    return result;
  }, []);

  const saveQualificationPointsTable = useCallback((table: QualificationPointsTable) => {
    savePersistedQualificationPointsTable(table);
    if (remoteAvailable) {
      saveQualificationPointsTableRemote(table).catch(() => {
        // Best-effort, same as above.
      });
    }
  }, []);

  const resetQualificationPointsTable = useCallback((): QualificationPointsTable => {
    resetPersistedQualificationPointsTable();
    if (remoteAvailable) {
      saveQualificationPointsTableRemote(null).catch(() => {
        // Best-effort, same as above.
      });
    }
    return getEffectiveQualificationPointsTable();
  }, []);

  const saveQualificationCutoff = useCallback((cutoff: QualificationCutoffSettings) => {
    savePersistedQualificationCutoff(cutoff);
    if (remoteAvailable) {
      saveQualificationCutoffRemote(cutoff).catch(() => {
        // Best-effort, same as above.
      });
    }
  }, []);

  const resetQualificationCutoff = useCallback((): QualificationCutoffSettings => {
    resetPersistedQualificationCutoff();
    if (remoteAvailable) {
      saveQualificationCutoffRemote(null).catch(() => {
        // Best-effort, same as above.
      });
    }
    return getEffectiveQualificationCutoff();
  }, []);

  return {
    synced,
    saveTournamentResult,
    deleteTournamentResult,
    bulkImportTournamentResults,
    saveQualificationPointsTable,
    resetQualificationPointsTable,
    saveQualificationCutoff,
    resetQualificationCutoff,
  };
}
