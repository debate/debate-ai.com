"use client";

/**
 * @fileoverview Shared saved-evidence-search state — the "saved searches
 * with alerts on new matches" follow-up named under the "📋 Shared Evidence
 * Library" bullet (Research Crowdsourcing Organizer Features) in
 * `TODO.md`. Local-first (works fully signed out), best-effort synced to the
 * account via the `/api/settings` `savedEvidenceSearches` field, mirroring
 * `useSavedArgumentCollections.ts` exactly.
 *
 * `EvidenceLibraryPanel` mounts this hook to render a "Saved searches" list:
 * saving stores the panel's current filter-field values under a name
 * (seeded with the filter's current result ids, so a freshly saved search
 * doesn't immediately claim every one of its own matches as "new"); running
 * a saved search sets the panel's filter state back to its `filters` and
 * marks its current results seen (clearing its "new matches" badge);
 * deleting removes it.
 *
 * @module hooks/useSavedEvidenceSearches
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchSavedEvidenceSearches,
  saveSavedEvidenceSearches,
} from "../lib/saved-evidence-searches-client";
import {
  isValidSavedEvidenceSearchesList,
  MAX_SAVED_EVIDENCE_SEARCHES,
  normalizeSavedEvidenceSearchName,
  type SavedEvidenceSearch,
} from "../lib/saved-evidence-searches";
import type { EvidenceSearchFormFilters } from "../lib/shared-evidence-library";

const STORAGE_KEY = "saved-evidence-searches";
const CHANGE_EVENT = "saved-evidence-searches-changed";

function readLocal(): SavedEvidenceSearch[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return isValidSavedEvidenceSearchesList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: SavedEvidenceSearch[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function buildSearchId(): string {
  return `evidence-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Module-level (not per-hook-instance) so every mounted instance shares one
// in-flight account fetch and one "is this browser signed in" flag, rather
// than each firing its own GET /api/settings on mount.
let remoteAvailable = false;
let remoteLoadPromise: Promise<void> | null = null;

function ensureRemoteLoaded(): Promise<void> {
  if (!remoteLoadPromise) {
    remoteLoadPromise = fetchSavedEvidenceSearches()
      .then((remote) => {
        if (remote === null) return;
        remoteAvailable = true;
        writeLocal(remote);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local searches already set above rather than blocking. Left as a
        // resolved (not rejected) promise so a later mount doesn't retry
        // within the same page load; a full reload tries again.
      });
  }
  return remoteLoadPromise;
}

export type UseSavedEvidenceSearchesResult = {
  searches: SavedEvidenceSearch[];
  loaded: boolean;
  /** Saves the given filters under a name, seeded with `currentEntryIds` as the initial "seen" baseline. Fails (returns `false`) if the name is a duplicate or the list is already at capacity. */
  saveSearch: (name: string, filters: EvidenceSearchFormFilters, currentEntryIds: string[]) => boolean;
  removeSearch: (id: string) => void;
  /** Replaces a saved search's "seen" baseline — call after re-running it so its "new matches" badge clears. */
  markSearchSeen: (id: string, currentEntryIds: string[]) => void;
};

/**
 * Binds the current user's saved evidence searches: local-first state,
 * synced to the account when signed in.
 */
export function useSavedEvidenceSearches(): UseSavedEvidenceSearchesResult {
  const [searches, setSearches] = useState<SavedEvidenceSearch[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSearches(readLocal());
    setLoaded(true);

    ensureRemoteLoaded().then(() => setSearches(readLocal()));

    const onExternalChange = () => setSearches(readLocal());
    window.addEventListener(CHANGE_EVENT, onExternalChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternalChange);
    };
  }, []);

  const persist = useCallback((next: SavedEvidenceSearch[]) => {
    setSearches(next);
    writeLocal(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    if (remoteAvailable) {
      saveSavedEvidenceSearches(next).catch(() => {
        // Best-effort — the change already applied locally above, matching
        // useSavedArgumentCollections's "local apply is never blocked by a
        // sync failure" convention.
      });
    }
  }, []);

  const saveSearch = useCallback(
    (name: string, filters: EvidenceSearchFormFilters, currentEntryIds: string[]) => {
      const normalized = normalizeSavedEvidenceSearchName(name);
      if (!normalized) return false;
      if (searches.some((search) => normalizeSavedEvidenceSearchName(search.name) === normalized)) {
        return false;
      }
      if (searches.length >= MAX_SAVED_EVIDENCE_SEARCHES) return false;
      persist([
        ...searches,
        {
          id: buildSearchId(),
          name: name.trim(),
          filters,
          createdAt: Date.now(),
          seenEntryIds: currentEntryIds,
        },
      ]);
      return true;
    },
    [searches, persist],
  );

  const removeSearch = useCallback(
    (id: string) => {
      persist(searches.filter((search) => search.id !== id));
    },
    [searches, persist],
  );

  const markSearchSeen = useCallback(
    (id: string, currentEntryIds: string[]) => {
      persist(searches.map((search) => (search.id === id ? { ...search, seenEntryIds: currentEntryIds } : search)));
    },
    [searches, persist],
  );

  return { searches, loaded, saveSearch, removeSearch, markSearchSeen };
}
