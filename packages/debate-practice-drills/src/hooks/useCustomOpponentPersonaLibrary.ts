"use client";

/**
 * @fileoverview Account-synced custom opponent persona library — the "🤖 AI
 * Practice Opponent" idea's "share a custom-authored persona across a team
 * instead of per-user only" Next item in TODO.md's Research Crowdsourcing
 * Organizer Features.
 *
 * Local-first, like `useDrillSets`: `OpponentPersonaPickerPanel` keeps
 * reading/writing `localStorage` through this hook, which stays fully
 * usable signed out. On mount, a one-time account merge (deduped across
 * instances via a module-level `remoteMergePromise`, mirroring
 * `useDrillSets`) reconciles local and remote library entries by `id`: a
 * remote entry with no local counterpart is adopted locally, a local-only
 * entry is best-effort pushed up, and an `id` present on both sides is
 * resolved via `resolveCustomOpponentPersonaLibraryConflict` — the newer
 * `updatedAt` wins. Every interactive mutation (`saveEntry`,
 * `deleteEntry`) applies locally first, then best-effort pushes the
 * freshly-stamped entry (or delete) to the account when signed in — the
 * local apply is never blocked by a sync failure, matching every other
 * synced-history hook's convention.
 *
 * `sharedByTeam` is a separate, read-only fetch of every other user's
 * `shared: true` entries (no session required) — it is never merged into
 * local storage, since it isn't this browser's own library to edit.
 *
 * @module hooks/useCustomOpponentPersonaLibrary
 */

import { useCallback, useEffect, useState } from "react";
import {
  buildCustomOpponentPersonaLibraryPanelView,
  createOrUpdateCustomOpponentPersonaLibraryEntry,
  deleteCustomOpponentPersonaLibraryEntry as deleteEntryLocal,
  getCustomOpponentPersonaLibraryEntry,
  listCustomOpponentPersonaLibrary,
  planCustomOpponentPersonaLibraryMerge,
  saveCustomOpponentPersonaLibraryEntry as adoptEntryLocal,
  type SavedCustomOpponentPersona,
} from "../state/customOpponentPersonaLibrary";
import {
  deleteCustomOpponentPersonaFromAccount,
  listMyCustomOpponentPersonas,
  listSharedCustomOpponentPersonas,
  saveCustomOpponentPersonaToAccount,
} from "../round/custom-opponent-persona-library-client";
import type { CustomOpponentPersonaLibraryEntryInput } from "debate-speech-writer/src/opponent/opponent-persona-library";

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced library entries into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listMyCustomOpponentPersonas()
      .then((remoteEntries) => {
        if (remoteEntries === null) return false;
        remoteAvailable = true;

        const localEntries = listCustomOpponentPersonaLibrary();
        const { adopt, pushLocal } = planCustomOpponentPersonaLibraryMerge(localEntries, remoteEntries);

        for (const remote of adopt) adoptEntryLocal(remote);
        for (const local of pushLocal) {
          saveCustomOpponentPersonaToAccount(local).catch(() => {
            // Best-effort — this entry stays queued to sync again on a
            // later successful attempt (e.g. the next mutation/mount).
          });
        }
        return adopt.length > 0;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

/** Best-effort pushes the current (freshly stamped) local copy of `id` to the account, if signed in. */
function pushToAccount(id: string): void {
  if (!remoteAvailable) return;
  const stamped = getCustomOpponentPersonaLibraryEntry(id);
  if (!stamped) return;
  saveCustomOpponentPersonaToAccount(stamped).catch(() => {
    // Best-effort — the entry is already saved locally, matching every
    // other synced-history hook's convention.
  });
}

export type UseCustomOpponentPersonaLibraryResult = {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  library: SavedCustomOpponentPersona[] | null;
  /** Whether this browser is signed in and syncing the library to the account. */
  synced: boolean;
  /** Every other user's `shared: true` entries. `null` until the first fetch resolves (or fails). */
  sharedByTeam: SavedCustomOpponentPersona[] | null;
  saveEntry: (input: CustomOpponentPersonaLibraryEntryInput) => SavedCustomOpponentPersona;
  deleteEntry: (id: string) => void;
  refreshSharedByTeam: () => void;
};

/**
 * Binds the current user's custom opponent persona library: local-first
 * state (`state/customOpponentPersonaLibrary.ts`), merged with and
 * best-effort synced to the account when signed in, plus a read-only fetch
 * of the team's shared entries.
 */
export function useCustomOpponentPersonaLibrary(): UseCustomOpponentPersonaLibraryResult {
  const [library, setLibrary] = useState<SavedCustomOpponentPersona[] | null>(null);
  const [synced, setSynced] = useState(false);
  const [sharedByTeam, setSharedByTeam] = useState<SavedCustomOpponentPersona[] | null>(null);

  const refreshSharedByTeam = useCallback(() => {
    listSharedCustomOpponentPersonas()
      .then(setSharedByTeam)
      .catch(() => setSharedByTeam([]));
  }, []);

  useEffect(() => {
    setLibrary(buildCustomOpponentPersonaLibraryPanelView());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setLibrary(buildCustomOpponentPersonaLibraryPanelView());
    });
    refreshSharedByTeam();
  }, [refreshSharedByTeam]);

  const saveEntry = useCallback((input: CustomOpponentPersonaLibraryEntryInput) => {
    const entry = createOrUpdateCustomOpponentPersonaLibraryEntry(input);
    setLibrary(buildCustomOpponentPersonaLibraryPanelView());
    pushToAccount(entry.id);
    return entry;
  }, []);

  const deleteEntry = useCallback((id: string) => {
    deleteEntryLocal(id);
    setLibrary(buildCustomOpponentPersonaLibraryPanelView());
    if (remoteAvailable) {
      deleteCustomOpponentPersonaFromAccount(id).catch(() => {
        // Best-effort — the entry is already gone locally either way.
      });
    }
  }, []);

  return { library, synced, sharedByTeam, saveEntry, deleteEntry, refreshSharedByTeam };
}
