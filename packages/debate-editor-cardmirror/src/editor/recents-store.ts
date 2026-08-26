/**
 * Recently-opened files store for the home screen.
 *
 * Persisted to `localStorage` (survives restarts; shared across
 * same-session Electron windows). Each entry records the file's
 * path handle (a string path on Electron), filename, format, and
 * last-opened timestamp.
 *
 * Reopen support is host-dependent:
 *   - Electron: `handle` is an absolute path string → the home
 *     screen reads it back via `host.readFileAtPath`.
 *   - Web: the File System Access API hands back a
 *     `FileSystemFileHandle` that can't be JSON-serialized, so web
 *     entries are recorded with `handle: null` — they show in the
 *     list (filename + timestamp) but can't be reopened directly.
 *     (A future pass could persist handles via IndexedDB.)
 *
 * The store is deliberately tiny — capped at MAX_RECENTS, newest
 * first, de-duplicated by handle (or by filename when handle is
 * null).
 */

const STORAGE_KEY = 'pmd-recent-files';
const MAX_RECENTS = 10;

export interface RecentFile {
  /** Absolute path on Electron; null on web (unserializable
   *  FileSystemFileHandle). */
  handle: string | null;
  filename: string;
  format: 'cmir' | 'docx' | null;
  lastOpenedAt: number;
}

type Listener = (items: RecentFile[]) => void;

const listeners = new Set<Listener>();

function read(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentFile =>
        e &&
        typeof e === 'object' &&
        typeof e.filename === 'string' &&
        typeof e.lastOpenedAt === 'number',
    );
  } catch {
    return [];
  }
}

function write(items: RecentFile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage disabled / quota — the in-memory list still drives
    // the current window; we just lose cross-restart persistence.
  }
  for (const fn of listeners) fn(items);
}

/** Current recents, newest first. */
export function listRecents(): RecentFile[] {
  return read();
}

/** Record a file as recently opened. De-dups by handle (falling
 *  back to filename when handle is null), moves the entry to the
 *  front, and trims to MAX_RECENTS. No-op for unsaved docs
 *  (filename empty). */
export function recordRecent(file: {
  handle: string | null;
  filename: string | null;
  format: 'cmir' | 'docx' | null;
}): void {
  if (!file.filename) return;
  const entry: RecentFile = {
    handle: file.handle,
    filename: file.filename,
    format: file.format,
    lastOpenedAt: Date.now(),
  };
  const sameKey = (a: RecentFile, b: RecentFile): boolean =>
    a.handle != null && b.handle != null
      ? a.handle === b.handle
      : a.handle == null && b.handle == null && a.filename === b.filename;
  const next = [entry, ...read().filter((e) => !sameKey(e, entry))].slice(
    0,
    MAX_RECENTS,
  );
  write(next);
}

/** Drop a recent entry by handle (used to prune a stale entry the
 *  home screen failed to reopen). */
export function removeRecent(handle: string | null): void {
  if (handle == null) return;
  write(read().filter((e) => e.handle !== handle));
}

export function clearRecents(): void {
  write([]);
}

export function subscribeRecents(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Cross-window sync: a write from ANOTHER window arrives as a DOM
// `storage` event (it never fires in the writing window, which already
// notified its own listeners in write()) — the same mechanism settings
// rely on to sync across windows. Without this, a home screen sitting
// visible while a second window opens files shows a stale list until
// re-shown. A null key is a wholesale localStorage.clear(): recents
// were part of it, so re-read then too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      const items = read();
      for (const fn of listeners) fn(items);
    }
  });
}
