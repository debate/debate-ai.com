"use client";

/**
 * @fileoverview Shared named Outline-filter-preset state — TODO.md idea #10
 * ("Outline Filters and Argument Tree View"), "Save and reuse named filter
 * presets instead of re-picking filters each visit" follow-up. Local-first
 * (works fully signed out), best-effort synced to the account via the same
 * `/api/settings` `outlineFilterPresets` field, mirroring
 * `hooks/useWordLimitPresets.ts` exactly.
 *
 * `ArgumentTreePanel` mounts this hook to render a "Filter presets" bar
 * above each round's per-round filter controls: applying a preset writes
 * that round's existing `state/argumentTreeFilters.ts` selection (so it
 * behaves exactly like picking each dropdown by hand), and "Save current as
 * preset" reads that round's current filter back out and stores it here
 * under a new name.
 *
 * Also subscribes to the browser's `storage` event (via
 * `isOutlineFilterPresetsLiveUpdateStorageEvent`) so a *different* browser
 * tab saving or removing a preset refreshes this one too — the same-tab
 * `CHANGE_EVENT` listener below never fires for another tab's write. This
 * closes `packages/debate-help-docs/content/docs/internals/argument-tree-outline.mdx`'s "no cross-tab `storage`
 * listener yet" Known gap, and the matching one `state/live-update.ts`'s doc
 * comment named for this hook.
 *
 * @module hooks/useOutlineFilterPresets
 */

import { useCallback, useEffect, useState } from "react";
import { fetchUserSettings, saveUserSettings } from "debate-round/src/round/user-settings-client";
import {
  isValidOutlineFilterPresetsList,
  MAX_OUTLINE_FILTER_PRESETS,
  normalizeOutlineFilterPresetName,
  type OutlineFilterPreset,
} from "debate-round/src/state/outlineFilterPresets";
import type { ArgumentTreeFilter } from "debate-round/src/flow/argument-tree";

const STORAGE_KEY = "outline-filter-presets";
const CHANGE_EVENT = "outline-filter-presets-changed";

function readLocal(): OutlineFilterPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return isValidOutlineFilterPresetsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: OutlineFilterPreset[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * Whether a `storage` event should trigger `useOutlineFilterPresets` to
 * refresh its preset list. A `null` key (e.g. from `localStorage.clear()`,
 * per the `StorageEvent` spec) counts too — the safest response to
 * "everything changed" is refreshing. Any other key (an unrelated store
 * elsewhere in the app) is ignored so an unrelated cross-tab write doesn't
 * force a needless refresh.
 */
export function isOutlineFilterPresetsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return event.key === null || event.key === STORAGE_KEY;
}

// Module-level (not per-hook-instance) so every mounted instance shares one
// in-flight account fetch and one "is this browser signed in" flag, rather
// than each firing its own GET /api/settings on mount.
let remoteAvailable = false;
let remoteLoadPromise: Promise<void> | null = null;

function ensureRemoteLoaded(): Promise<void> {
  if (!remoteLoadPromise) {
    remoteLoadPromise = fetchUserSettings()
      .then((remote) => {
        if (!remote) return;
        remoteAvailable = true;
        if (Array.isArray(remote.outlineFilterPresets)) {
          writeLocal(remote.outlineFilterPresets);
          window.dispatchEvent(new Event(CHANGE_EVENT));
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local presets already set above rather than blocking. Left as a
        // resolved (not rejected) promise so a later mount doesn't retry
        // within the same page load; a full reload tries again.
      });
  }
  return remoteLoadPromise;
}

export type UseOutlineFilterPresetsResult = {
  presets: OutlineFilterPreset[];
  loaded: boolean;
  /** Adds a preset. Fails (returns `false`) if the name is a duplicate or the list is already at capacity. */
  addPreset: (name: string, filter: ArgumentTreeFilter) => boolean;
  removePreset: (name: string) => void;
};

/**
 * Binds the current user's named Outline filter presets: local-first
 * state, synced to the account when signed in.
 */
export function useOutlineFilterPresets(): UseOutlineFilterPresetsResult {
  const [presets, setPresets] = useState<OutlineFilterPreset[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPresets(readLocal());
    setLoaded(true);

    ensureRemoteLoaded().then(() => setPresets(readLocal()));

    const onExternalChange = () => setPresets(readLocal());
    window.addEventListener(CHANGE_EVENT, onExternalChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onExternalChange);
    };
  }, []);

  // A `storage` event never fires in the tab that made the write, only in
  // other same-origin tabs — the `CHANGE_EVENT` listener above only covers
  // this tab's own instances.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isOutlineFilterPresetsLiveUpdateStorageEvent(event)) return;
      setPresets(readLocal());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const persist = useCallback((next: OutlineFilterPreset[]) => {
    setPresets(next);
    writeLocal(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    if (remoteAvailable) {
      saveUserSettings({ outlineFilterPresets: next }).catch(() => {
        // Best-effort — the change already applied locally above, matching
        // useWordLimitPresets's "local apply is never blocked by a sync
        // failure" convention.
      });
    }
  }, []);

  const addPreset = useCallback(
    (name: string, filter: ArgumentTreeFilter) => {
      const normalized = normalizeOutlineFilterPresetName(name);
      if (presets.some((preset) => normalizeOutlineFilterPresetName(preset.name) === normalized)) return false;
      if (presets.length >= MAX_OUTLINE_FILTER_PRESETS) return false;
      persist([...presets, { name: name.trim(), filter }]);
      return true;
    },
    [presets, persist],
  );

  const removePreset = useCallback(
    (name: string) => {
      const normalized = normalizeOutlineFilterPresetName(name);
      persist(presets.filter((preset) => normalizeOutlineFilterPresetName(preset.name) !== normalized));
    },
    [presets, persist],
  );

  return { presets, loaded, addPreset, removePreset };
}
