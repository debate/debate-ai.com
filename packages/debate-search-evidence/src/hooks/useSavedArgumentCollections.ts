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
  normalizeSavedArgumentCollectionName,
  validateNewSavedArgumentCollection,
  validateSavedArgumentCollectionRename,
  validateSavedArgumentCollectionTagsUpdate,
  type SavedArgumentCollection,
  type SavedArgumentCollectionSaveFailure,
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
  /** Adds a collection. Returns `null` on success, or the reason the save was refused (duplicate name, empty/over-limit tags, at capacity, …). */
  addCollection: (name: string, tags: string[]) => SavedArgumentCollectionSaveFailure | null;
  removeCollection: (name: string) => void;
  /** Renames an existing collection (case-insensitive identity). Returns `null` on success. */
  renameCollection: (oldName: string, newName: string) => SavedArgumentCollectionSaveFailure | null;
  /** Replaces an existing collection's tag list in place. Returns `null` on success. */
  updateCollection: (name: string, tags: string[]) => SavedArgumentCollectionSaveFailure | null;
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
      const failure = validateNewSavedArgumentCollection(collections, name, tags);
      if (failure) return failure;
      persist([...collections, { name: name.trim(), tags }]);
      return null;
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

  const renameCollection = useCallback(
    (oldName: string, newName: string) => {
      const failure = validateSavedArgumentCollectionRename(collections, oldName, newName);
      if (failure) return failure;
      const oldNormalized = normalizeSavedArgumentCollectionName(oldName);
      persist(
        collections.map((collection) =>
          normalizeSavedArgumentCollectionName(collection.name) === oldNormalized
            ? { ...collection, name: newName.trim() }
            : collection,
        ),
      );
      return null;
    },
    [collections, persist],
  );

  const updateCollection = useCallback(
    (name: string, tags: string[]) => {
      const failure = validateSavedArgumentCollectionTagsUpdate(collections, name, tags);
      if (failure) return failure;
      const normalized = normalizeSavedArgumentCollectionName(name);
      persist(
        collections.map((collection) =>
          normalizeSavedArgumentCollectionName(collection.name) === normalized ? { ...collection, tags } : collection,
        ),
      );
      return null;
    },
    [collections, persist],
  );

  return { collections, loaded, addCollection, removeCollection, renameCollection, updateCollection };
}
