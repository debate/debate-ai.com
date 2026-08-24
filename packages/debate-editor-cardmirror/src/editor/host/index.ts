/**
 * Host singleton.
 *
 * This build (debate-editor-cardmirror, embedded in debate-ai.com) is
 * web-only: `getHost()` always resolves to `BrowserHost`, so
 * `getElectronHost()` always returns `null` and `isWindowsHost()` always
 * returns `false` at runtime — the Electron branch of `getHost()` that
 * would construct one is gone.
 *
 * `ElectronHost` (electron-host.ts) itself stays in the tree as a
 * TYPE-ONLY artifact: dozens of call sites across this codebase narrow on
 * it (`const eh = getElectronHost(); if (eh) { eh.pickDirectory(...) }`),
 * which needs `getElectronHost()`'s return type to be the real
 * `ElectronHost | null` — narrowing a bare `null` type inside `if (eh)`
 * collapses to `never` and breaks every one of those call sites (that's
 * `import type` below: erased at compile time, so it costs nothing at
 * runtime, and since nothing ever imports `ElectronHost` as a VALUE
 * anymore, bundlers tree-shake the class itself out of the shipped web
 * bundle too). */

import { BrowserHost } from './browser-host.js';
import type { ElectronHost } from './electron-host.js';
import type { Host } from './types.js';

export type {
  Host,
  OpenedFile,
  SaveResult,
  FileFilter,
  OpenFileOptions,
  SaveAsOptions,
  JournalEntry,
  SpawnWindowPayload,
} from './types.js';

let cached: Host | null = null;

export function getHost(): Host {
  if (cached) return cached;
  cached = new BrowserHost();
  return cached;
}

/** Always `null` in this web-only build — `getHost()` never constructs an
 *  `ElectronHost`. Typed as `ElectronHost | null` (not bare `null`) so
 *  `if (getElectronHost()) { ... }` call sites keep narrowing to a real
 *  method set instead of `never`. */
export function getElectronHost(): ElectronHost | null {
  const h = getHost();
  return h.kind === 'electron' ? (h as ElectronHost) : null;
}

/** Always `false` in this web-only build — see `getElectronHost`. */
export function isWindowsHost(): boolean {
  return (
    getElectronHost() !== null &&
    typeof navigator !== 'undefined' &&
    /Windows/.test(navigator.userAgent)
  );
}

/** Compare two file handles for identity — used by the
 *  duplicate-open guard so we can refuse a second open of a doc
 *  that's already loaded into the workspace. Electron handles are
 *  absolute path strings (cheap `===`); browser handles are
 *  `FileSystemFileHandle`s and need `isSameEntry` (async). Returns
 *  false when either side is null/undefined or types are mixed. */
export async function isSameOpenHandle(a: unknown, b: unknown): Promise<boolean> {
  if (a == null || b == null) return false;
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  const isSameEntry = (a as { isSameEntry?: (other: unknown) => Promise<boolean> }).isSameEntry;
  if (typeof isSameEntry === 'function') {
    try {
      return await isSameEntry.call(a, b);
    } catch {
      return false;
    }
  }
  return false;
}
