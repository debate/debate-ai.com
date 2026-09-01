"use client";

/**
 * @fileoverview Account-synced round pairings — idea #12 ("Pre-Round
 * Intelligence Panel")'s "A manual pairing/room-assignment entry form as
 * the practical stand-in" follow-up in TODO.md.
 *
 * Local-first, like `useWordCountRounds`: `PreRoundBriefingsPanel` (the sole
 * consumer of `state/roundPairings.ts`) keeps reading/writing `localStorage`
 * through this hook, which stays fully usable signed out. On mount, a
 * one-time account merge (deduped across instances via a module-level
 * `remoteMergePromise`) reconciles local and remote pairings — merged by
 * `roundId`: a remote pairing with no local counterpart is adopted locally
 * (`adoptRoundPairing`), and a local-only pairing (saved before this feature
 * existed, or saved offline) is best-effort pushed up. Neither direction
 * overwrites a `roundId` both sides already have — this hook doesn't resolve
 * edit conflicts, just fills gaps, mirroring `useWordCountRounds`'s exact
 * merge rule.
 *
 * @module hooks/useRoundPairings
 */

import { useCallback, useEffect, useState } from "react";
import {
  adoptRoundPairing,
  buildRoundPairingsPanelView,
  deleteRoundPairing,
  saveRoundPairing,
  type RoundPairingRecord,
} from "../state/roundPairings";
import {
  deleteSavedRoundPairingFromAccount,
  listSavedRoundPairings,
  saveRoundPairingToAccount,
} from "../round/round-pairings-client";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced pairings into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedRoundPairings()
      .then((remoteRecords) => {
        if (remoteRecords === null) return false;
        remoteAvailable = true;

        const localRecords = buildRoundPairingsPanelView();
        const localIds = new Set(localRecords.map((record) => record.roundId));
        const remoteIds = new Set(remoteRecords.map((record) => record.roundId));

        let changed = false;
        for (const remote of remoteRecords) {
          if (!localIds.has(remote.roundId)) {
            adoptRoundPairing(remote);
            changed = true;
          }
        }
        for (const local of localRecords) {
          if (!remoteIds.has(local.roundId)) {
            saveRoundPairingToAccount(local).catch(() => {
              // Best-effort — this pairing stays local-only until a later
              // successful sync (e.g. the next save/mount).
            });
          }
        }
        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export type UseRoundPairingsResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  pairings: RoundPairingRecord[] | null;
  /** Whether this browser is signed in and syncing pairings to the account. */
  synced: boolean;
  savePairing: (record: RoundPairingRecord) => void;
  deletePairing: (roundId: string) => void;
};

/**
 * Binds the current user's round pairings: local-first state
 * (`state/roundPairings.ts`), merged with and best-effort synced to the
 * account when signed in.
 */
export function useRoundPairings(): UseRoundPairingsResult {
  const [pairings, setPairings] = useState<RoundPairingRecord[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setPairings(buildRoundPairingsPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setPairings(buildRoundPairingsPanelView());
    });
  }, []);

  const savePairing = useCallback((record: RoundPairingRecord) => {
    saveRoundPairing(record);
    setPairings(buildRoundPairingsPanelView());
    if (remoteAvailable) {
      saveRoundPairingToAccount(record).catch(() => {
        // Best-effort — the pairing is already saved locally above.
      });
    }
  }, []);

  const deletePairing = useCallback((roundId: string) => {
    deleteRoundPairing(roundId);
    setPairings(buildRoundPairingsPanelView());
    if (remoteAvailable) {
      deleteSavedRoundPairingFromAccount(roundId).catch(() => {
        // Best-effort, same as savePairing above.
      });
    }
  }, []);

  return { pairings, synced, savePairing, deletePairing };
}
