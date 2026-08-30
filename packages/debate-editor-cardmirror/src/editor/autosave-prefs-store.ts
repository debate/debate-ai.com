/**
 * Per-document autosave preference store.
 *
 * Remembers which saved files the user has turned autosave ON for,
 * keyed by absolute path, so the autosave toggle survives closing and
 * reopening a doc. Persisted to `localStorage` (survives restarts;
 * shared across same-session Electron windows).
 *
 * This is distinct from the live `autosaveEnabled` setting, which stays
 * transient/per-window (see `TRANSIENT_SETTING_KEYS` in settings.ts):
 * the setting drives the current window's behavior, and opening a known
 * doc restores its remembered state from here. Only Electron docs have
 * a stable string path; web `FileSystemFileHandle`s aren't serializable,
 * so web docs never match (autosave stays its default-off).
 *
 * Stores only paths that are ON — a path absent from the set means off
 * (the default), so the store stays small and self-pruning-ish.
 */

const STORAGE_KEY = 'pmd-autosave-paths';

function read(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((p): p is string => typeof p === 'string'));
  } catch {
    return new Set();
  }
}

function write(paths: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...paths]));
  } catch {
    // Storage disabled / quota — the live `autosaveEnabled` setting
    // still drives this window; we just lose cross-restart persistence.
  }
}

/** Whether autosave was last left ON for the file at `path`. False for
 *  a non-string path (unsaved / web handle) or an unknown path. */
export function isAutosaveOnForPath(path: unknown): boolean {
  if (typeof path !== 'string' || !path) return false;
  return read().has(path);
}

/** Remember the autosave toggle state for the file at `path`. No-op for
 *  a non-string path (unsaved docs / web — nothing stable to key on). */
export function setAutosaveForPath(path: unknown, on: boolean): void {
  if (typeof path !== 'string' || !path) return;
  const paths = read();
  if (on) {
    if (paths.has(path)) return;
    paths.add(path);
  } else {
    if (!paths.has(path)) return;
    paths.delete(path);
  }
  write(paths);
}
