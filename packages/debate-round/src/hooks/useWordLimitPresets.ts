"use client";

/**
 * @fileoverview Shared custom word-limit-preset state — TODO.md idea #2
 * ("Word-Count-Only Speech Format"), "a per-style word-limit preset manager
 * (add/edit/remove custom limits instead of only the built-in registry)"
 * follow-up. Local-first (works fully signed out, like
 * `lib/hooks/useFavoriteTools.ts`'s app-level counterpart), best-effort
 * synced to the account via the same `/api/settings` `wordLimitPresets`
 * field `WordLimitPresetsPanel` writes.
 *
 * Every consumer — `WordLimitPresetsPanel`'s manager UI, the standalone
 * `/word-count` form (`WordCountRoundsPanel`), and the live in-round meter
 * (`useWordCountSpeechMode`) — mounts this hook independently. A change in
 * one instance writes `localStorage` and dispatches a same-tab
 * `word-limit-presets-changed` window event so every other mounted instance
 * re-reads it and stays in sync, the same trick `useFavoriteTools` already
 * uses. The one-time account fetch on mount is deduped across instances via
 * a module-level `remoteLoadPromise`, mirroring `useFavoriteTools`'s dedup
 * for the same reason: several consumers can mount on one page.
 *
 * @module hooks/useWordLimitPresets
 */

import { useCallback, useEffect, useState } from "react";
import { fetchUserSettings, saveUserSettings } from "../round/user-settings-client";
import {
  isValidWordLimitPresetsList,
  MAX_WORD_LIMIT_PRESETS,
  normalizePresetName,
  type WordLimitPreset,
} from "../state/wordLimitPresets";

const STORAGE_KEY = "word-limit-presets";
const CHANGE_EVENT = "word-limit-presets-changed";

function readLocal(): WordLimitPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return isValidWordLimitPresetsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(list: WordLimitPreset[]) {
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
    remoteLoadPromise = fetchUserSettings()
      .then((remote) => {
        if (!remote) return;
        remoteAvailable = true;
        if (Array.isArray(remote.wordLimitPresets)) {
          writeLocal(remote.wordLimitPresets);
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

export type UseWordLimitPresetsResult = {
  presets: WordLimitPreset[];
  loaded: boolean;
  /** Adds a preset. Fails (returns `false`) if the name is a duplicate or the list is already at capacity. */
  addPreset: (name: string, wordLimit: number) => boolean;
  /** Replaces one preset's word limit. No-op if `name` doesn't match an existing preset. */
  updatePreset: (name: string, wordLimit: number) => void;
  removePreset: (name: string) => void;
};

/**
 * Binds the current user's custom word-limit presets: local-first state,
 * synced to the account when signed in.
 */
export function useWordLimitPresets(): UseWordLimitPresetsResult {
  const [presets, setPresets] = useState<WordLimitPreset[]>([]);
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

  const persist = useCallback((next: WordLimitPreset[]) => {
    setPresets(next);
    writeLocal(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    if (remoteAvailable) {
      saveUserSettings({ wordLimitPresets: next }).catch(() => {
        // Best-effort — the change already applied locally above, matching
        // useFavoriteTools's/UserSettingsPanel's "local apply is never
        // blocked by a sync failure" convention.
      });
    }
  }, []);

  const addPreset = useCallback(
    (name: string, wordLimit: number) => {
      const normalized = normalizePresetName(name);
      if (presets.some((preset) => normalizePresetName(preset.name) === normalized)) return false;
      if (presets.length >= MAX_WORD_LIMIT_PRESETS) return false;
      persist([...presets, { name: name.trim(), wordLimit }]);
      return true;
    },
    [presets, persist],
  );

  const updatePreset = useCallback(
    (name: string, wordLimit: number) => {
      const normalized = normalizePresetName(name);
      if (!presets.some((preset) => normalizePresetName(preset.name) === normalized)) return;
      persist(
        presets.map((preset) =>
          normalizePresetName(preset.name) === normalized ? { ...preset, wordLimit } : preset,
        ),
      );
    },
    [presets, persist],
  );

  const removePreset = useCallback(
    (name: string) => {
      const normalized = normalizePresetName(name);
      persist(presets.filter((preset) => normalizePresetName(preset.name) !== normalized));
    },
    [presets, persist],
  );

  return { presets, loaded, addPreset, updatePreset, removePreset };
}
