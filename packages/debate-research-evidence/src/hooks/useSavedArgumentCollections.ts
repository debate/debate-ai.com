"use client";

/**
 * @fileoverview Shared named Argument-Library-collection state — the "saved
 * custom collections per user" follow-up named under the "📚 Common
 * Argument Library" bullet (Research Crowdsourcing Organizer Features) in
 * `TODO.md`. Local-first (works fully signed out), best-effort synced to the
 * account via the `/api/settings` `savedArgumentCollections` field, mirroring
 * `debate-round`'s `hooks/useOutlineFilterPresets.ts` exactly.
 *
 * `ArgumentLibraryPanel` mounts this hook to render a "Saved collections"
 * bar: applying a collection sets that panel's own `activeTags` state to the
 * saved tag list (behaving exactly like clicking each tag chip by hand), and
 * "Save current selection" reads `activeTags` back out and stores it here
 * under a new name.
 *
 * @module hooks/useSavedArgumentCollections
 */

import { useCallback, useEffect, useState } from "react";
import { fetchSavedArgumentCollections, saveSavedArgumentCollections } from "../lib/argument-library-collections-client";
import {
  isValidSavedArgumentCollectionsList,
  MAX_SAVED_ARGUMENT_COLLECTIONS,
  normalizeSavedArgumentCollectionName,
  type SavedArgumentCollection,
} from "../lib/argument-library-collections";

const STORAGE_KEY = "saved-argument-collections";
const CHANGE_EVENT = "saved-argument-collections-changed";

function readLocal(): SavedArgumentCollection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return isValidSavedArgumentCollectionsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: SavedArgumentCollection[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Module-level (not per-hook-instance) so every mounted instance shares one
// in-flight account fetch and one "is this browser signed in" flag, rather
// than each firing its own GET /api/settings on mount.
let remoteAvailable = false;
let remoteLoadPromise: Promise<void> | null = null;

function ensureRemoteLoaded(): Promise<void> {
  if (!remoteLoadPromise) {
    remoteLoadPromise = fetchSavedArgumentCollections()
      .then((remote) => {
        if (remote === null) return;
        remoteAvailable = true;
        writeLocal(remote);
        window.dispatchEvent(new Event(CHANGE_EVENT));
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local collections already set above rather than blocking. Left as
        // a resolved (not rejected) promise so a later mount doesn't retry
        // within the same page load; a full reload tries again.
      });
  }
  return remoteLoadPromise;
}

export type UseSavedArgumentCollectionsResult = {
  collections: SavedArgumentCollection[];
  loaded: boolean;
  /** Adds a collection. Fails (returns `false`) if the name is a duplicate, `tags` is empty, or the list is already at capacity. */
  addCollection: (name: string, tags: string[]) => boolean;
  removeCollection: (name: string) => void;
};

/**
 * Binds the current user's named Argument Library collections: local-first
 * state, synced to the account when signed in.
 */
export function useSavedArgumentCollections(): UseSavedArgumentCollectionsResult {
  const [collections, setCollections] = useState<SavedArgumentCollection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCollections(readLocal());
    setLoaded(true);

    ensureRemoteLoaded().then(() => setCollections(readLocal()));

    const onExternalChange = () => setCollections(readLocal());
    window.addEventListener(CHANGE_EVENT, onExternalChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternalChange);
    };
  }, []);

  const persist = useCallback((next: SavedArgumentCollection[]) => {
    setCollections(next);
    writeLocal(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    if (remoteAvailable) {
      saveSavedArgumentCollections(next).catch(() => {
        // Best-effort — the change already applied locally above, matching
        // useOutlineFilterPresets's "local apply is never blocked by a sync
        // failure" convention.
      });
    }
  }, []);

  const addCollection = useCallback(
    (name: string, tags: string[]) => {
      if (tags.length === 0) return false;
      const normalized = normalizeSavedArgumentCollectionName(name);
      if (collections.some((collection) => normalizeSavedArgumentCollectionName(collection.name) === normalized)) {
        return false;
      }
      if (collections.length >= MAX_SAVED_ARGUMENT_COLLECTIONS) return false;
      persist([...collections, { name: name.trim(), tags }]);
      return true;
    },
    [collections, persist],
  );

  const removeCollection = useCallback(
    (name: string) => {
      const normalized = normalizeSavedArgumentCollectionName(name);
      persist(collections.filter((collection) => normalizeSavedArgumentCollectionName(collection.name) !== normalized));
    },
    [collections, persist],
  );

  return { collections, loaded, addCollection, removeCollection };
}
