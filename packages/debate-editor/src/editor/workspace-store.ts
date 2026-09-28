/**
 * Workspace store — "reopen the documents I had open last time."
 *
 * Two localStorage records, both host-agnostic in shape but only
 * useful where handles are serializable (Electron paths; the web
 * edition's `FileSystemFileHandle` can't be stored, exactly as in
 * `recents-store.ts`, so web docs are skipped):
 *
 *  - LIVE (`pmd-live-workspace`): a map of windowId → the docs that
 *    window currently has open. Every window rewrites its OWN entry
 *    whenever its open set changes (single-doc: on handle change;
 *    three-pane: on every slot composition change). A window that
 *    closes on its own drops its entry (`installWindowCloseForget`),
 *    so what the next session is offered is what was open at the
 *    QUIT; a quit — or a killed app — leaves entries exactly as they
 *    were, which is the point.
 *
 *  - LAST (`pmd-last-workspace`): the snapshot offered to the user.
 *    The first window of an app session calls `rolloverLastWorkspace()`
 *    at boot, which folds the LIVE map (i.e. the previous session's
 *    survivors) into LAST and empties LIVE so this session starts
 *    accumulating from scratch. `saveWorkspaceNow()` does the same
 *    fold mid-session for the explicit Save Workspace command.
 *
 * Closing every document before quitting is taken at face value: the
 * roll-over finds nothing and CLEARS the snapshot, so the next launch
 * offers nothing to reopen. The exception is a snapshot the user saved
 * deliberately (`pinned`, written by Save Workspace) — that survives an
 * empty quit, which is the whole reason to reach for the command. A
 * session that ends WITH documents open always replaces the snapshot,
 * pinned or not; pinning protects against erasure, it doesn't freeze
 * the row.
 *
 * The mode (`panes` / `windows`) is recorded so a restore can honour
 * slot assignments when the user is still in three-pane mode, and
 * ignore them when they've since switched.
 *
 * `excluded` is the user's standing "don't bother reopening this one"
 * list, edited by the home screen's checklist and honoured every time
 * the set is reopened (the home-screen button or the Reopen Last
 * Workspace command) — so one untick is durable rather than a
 * per-click filter. It carries across
 * roll-overs for paths still in the set, and is pruned of everything
 * else so a long-gone document can't silently suppress itself years
 * later if it comes back.
 */

import { settings } from './settings.js';

const LIVE_KEY = 'pmd-live-workspace';
const LAST_KEY = 'pmd-last-workspace';

/** Cap on a snapshot's size — a workspace bigger than this is
 *  almost certainly stale entries from windows that never got
 *  pruned, and reopening 40 documents would be hostile anyway. */
const MAX_DOCS = 24;

/** Live entries older than this are dropped on read. Bounds the map
 *  against windowIds that vanished without a rollover (a crash on a
 *  machine where the next launch never happened, say). */
const LIVE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type WorkspaceSlotId = 'slot1' | 'slot2' | 'slot3';

export interface WorkspaceDoc {
  /** Absolute path (Electron). Docs without a serializable handle
   *  are never recorded, so this is always a non-empty string. */
  path: string;
  filename: string;
  format: 'cmir' | 'docx' | null;
  /** Three-pane only: which slot held the doc. Null in single-doc
   *  mode, and ignored by a restore running in the other mode. */
  slot: WorkspaceSlotId | null;
}

export interface WorkspaceSnapshot {
  savedAt: number;
  mode: 'panes' | 'windows';
  docs: WorkspaceDoc[];
  /** True when the user saved this set deliberately (Save Workspace)
   *  rather than it being the automatic end-of-session capture. Only
   *  effect: an empty quit doesn't clear it. */
  pinned: boolean;
  /** Paths the user unticked. Always a subset of `docs`'s paths. */
  excluded: string[];
}

interface LiveEntry {
  updatedAt: number;
  mode: 'panes' | 'windows';
  docs: WorkspaceDoc[];
}

/** Identity for THIS window inside the LIVE map, minted per load.
 *  Deliberately NOT persisted: a reloaded window is a new window as
 *  far as the map is concerned, and its old entry is swept by the
 *  next rollover. */
const WINDOW_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `w${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

type Listener = (snapshot: WorkspaceSnapshot | null) => void;
const listeners = new Set<Listener>();

function isDoc(d: unknown): d is WorkspaceDoc {
  if (!d || typeof d !== 'object') return false;
  const doc = d as WorkspaceDoc;
  return typeof doc.path === 'string' && !!doc.path && typeof doc.filename === 'string';
}

function normalizeDoc(d: WorkspaceDoc): WorkspaceDoc {
  return {
    path: d.path,
    filename: d.filename,
    format: d.format === 'cmir' || d.format === 'docx' ? d.format : null,
    slot: d.slot === 'slot1' || d.slot === 'slot2' || d.slot === 'slot3' ? d.slot : null,
  };
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage disabled / quota — the feature degrades to "no
    // snapshot", which every caller already handles.
  }
}

function readLive(): Record<string, LiveEntry> {
  const parsed = readJson(LIVE_KEY);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, LiveEntry> = {};
  const cutoff = Date.now() - LIVE_MAX_AGE_MS;
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const e = value as LiveEntry;
    if (typeof e.updatedAt !== 'number' || e.updatedAt < cutoff) continue;
    if (!Array.isArray(e.docs)) continue;
    out[id] = {
      updatedAt: e.updatedAt,
      mode: e.mode === 'panes' ? 'panes' : 'windows',
      docs: e.docs.filter(isDoc).map(normalizeDoc),
    };
  }
  return out;
}

/** Fold the LIVE map into one snapshot: oldest window first (so the
 *  set reads in the order the user built it), de-duplicated by path.
 *  Mode comes from the newest contributing entry — every window in a
 *  session runs the same mode, so this only matters after a toggle. */
function foldLive(live: Record<string, LiveEntry>): WorkspaceSnapshot | null {
  const entries = Object.values(live)
    .filter((e) => e.docs.length > 0)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  if (entries.length === 0) return null;
  const seen = new Set<string>();
  const docs: WorkspaceDoc[] = [];
  for (const entry of entries) {
    for (const doc of entry.docs) {
      if (seen.has(doc.path)) continue;
      seen.add(doc.path);
      docs.push(doc);
      if (docs.length >= MAX_DOCS) break;
    }
    if (docs.length >= MAX_DOCS) break;
  }
  const newest = entries.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return { savedAt: Date.now(), mode: newest.mode, docs, pinned: false, excluded: [] };
}

/** Carry the standing unticks onto a freshly folded snapshot, keeping
 *  only the paths that are actually in it. A document the user unticked
 *  stays unticked as sessions roll over; one that has left the set
 *  drops its exclusion rather than lying in wait. */
function carryExclusions(next: WorkspaceSnapshot): WorkspaceSnapshot {
  const standing = lastWorkspace()?.excluded ?? [];
  if (standing.length === 0) return next;
  const paths = new Set(next.docs.map((d) => d.path));
  return { ...next, excluded: standing.filter((p) => paths.has(p)) };
}

/** The documents a reopen should actually open: everything still
 *  ticked. The home-screen button and the Reopen Last Workspace
 *  command both go through this, so they can't drift apart. */
export function selectedDocs(snapshot: WorkspaceSnapshot): WorkspaceDoc[] {
  if (snapshot.excluded.length === 0) return snapshot.docs;
  const excluded = new Set(snapshot.excluded);
  return snapshot.docs.filter((d) => !excluded.has(d.path));
}

/** Record what THIS window currently has open. Docs without a string
 *  path (unsaved, or a web handle) are dropped — they can't be
 *  reopened, and recording them would render dead rows. Cheap enough
 *  to call from every open / close / Save As. */
export function reportWindowWorkspace(
  mode: 'panes' | 'windows',
  docs: Array<{ path: unknown; filename: string | null; format: 'cmir' | 'docx' | null; slot?: WorkspaceSlotId | null }>,
): void {
  if (!settings.get('lastWorkspaceEnabled')) return; // off: nothing is recorded
  const kept: WorkspaceDoc[] = [];
  for (const d of docs) {
    if (typeof d.path !== 'string' || !d.path || !d.filename) continue;
    kept.push({ path: d.path, filename: d.filename, format: d.format, slot: d.slot ?? null });
  }
  const live = readLive();
  if (kept.length === 0) delete live[WINDOW_ID];
  else live[WINDOW_ID] = { updatedAt: Date.now(), mode, docs: kept };
  writeJson(LIVE_KEY, live);
}

/** Drop THIS window's live entry: it closed on its own, so it is not
 *  part of what the next session should be offered. */
export function forgetWindowWorkspace(): void {
  const live = readLive();
  if (!(WINDOW_ID in live)) return;
  delete live[WINDOW_ID];
  writeJson(LIVE_KEY, live);
}

/** Forget this window's entry when the window goes away WITHOUT the
 *  app quitting — an ordinary close, a reload, a mode-switch close.
 *  `isAppQuitting` is asked synchronously from `pagehide`, where
 *  nothing can be awaited; when it says the app is quitting (or it
 *  cannot tell), the entry stays, which is the whole feature. */
export function installWindowCloseForget(isAppQuitting: () => boolean): () => void {
  const onHide = (): void => {
    let quitting = true;
    try {
      quitting = isAppQuitting();
    } catch {
      quitting = true;
    }
    if (!quitting) forgetWindowWorkspace();
  };
  window.addEventListener('pagehide', onHide);
  return () => window.removeEventListener('pagehide', onHide);
}

/** The snapshot the user can reopen, or null when there is none (or
 *  the feature is off — the section then never renders). */
export function lastWorkspace(): WorkspaceSnapshot | null {
  if (!settings.get('lastWorkspaceEnabled')) return null;
  const parsed = readJson(LAST_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  const s = parsed as WorkspaceSnapshot;
  if (typeof s.savedAt !== 'number' || !Array.isArray(s.docs)) return null;
  const docs = s.docs.filter(isDoc).map(normalizeDoc).slice(0, MAX_DOCS);
  if (docs.length === 0) return null;
  const paths = new Set(docs.map((d) => d.path));
  return {
    savedAt: s.savedAt,
    mode: s.mode === 'panes' ? 'panes' : 'windows',
    docs,
    pinned: s.pinned === true,
    excluded: Array.isArray(s.excluded)
      ? s.excluded.filter((p): p is string => typeof p === 'string' && paths.has(p))
      : [],
  };
}

function publish(snapshot: WorkspaceSnapshot | null): void {
  for (const fn of listeners) fn(snapshot);
}

/** Boot-time roll-over, run ONCE per app session by the first window:
 *  the LIVE map still holds the previous session's open docs, so fold
 *  it into LAST and empty it. A session that ended with nothing open
 *  clears LAST — unless the standing snapshot was pinned by Save
 *  Workspace, which is exactly the set the user asked to keep.
 *  Returns the resulting snapshot. */
export function rolloverLastWorkspace(): WorkspaceSnapshot | null {
  if (!settings.get('lastWorkspaceEnabled')) return null; // off: leave storage alone
  const folded = foldLive(readLive());
  writeJson(LIVE_KEY, {});
  let snapshot: WorkspaceSnapshot | null;
  if (folded) {
    const carried = carryExclusions(folded);
    writeJson(LAST_KEY, carried);
    snapshot = carried;
  } else {
    const standing = lastWorkspace();
    snapshot = standing?.pinned ? standing : null;
    if (!snapshot) writeJson(LAST_KEY, null);
  }
  publish(snapshot);
  return snapshot;
}

/** Explicit "Save Workspace": fold what every live window reports
 *  RIGHT NOW into LAST, without disturbing the live map. Returns the
 *  saved snapshot, or null when nothing reopenable is open. */
export function saveWorkspaceNow(): WorkspaceSnapshot | null {
  if (!settings.get('lastWorkspaceEnabled')) return null;
  const folded = foldLive(readLive());
  if (!folded) return null;
  const pinned: WorkspaceSnapshot = { ...carryExclusions(folded), pinned: true };
  writeJson(LAST_KEY, pinned);
  publish(pinned);
  return pinned;
}

/** Replace the standing untick list (home-screen checklist edits).
 *  No-op when there's no snapshot to attach it to. Paths outside the
 *  snapshot are dropped, so the invariant `excluded ⊆ docs` holds. */
export function setWorkspaceExcluded(paths: Iterable<string>): void {
  const snapshot = lastWorkspace();
  if (!snapshot) return;
  const inSet = new Set(snapshot.docs.map((d) => d.path));
  const excluded = [...new Set(paths)].filter((p) => inSet.has(p));
  const next: WorkspaceSnapshot = { ...snapshot, excluded };
  writeJson(LAST_KEY, next);
  publish(next);
}

export function clearLastWorkspace(): void {
  writeJson(LAST_KEY, null);
  publish(null);
}

export function subscribeLastWorkspace(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Cross-window sync, same mechanism recents use: a write from ANOTHER
// window arrives as a `storage` event (never fired in the writing
// window, which published to its own listeners above). Keeps a home
// screen sitting visible in one window current when another saves.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LAST_KEY || e.key === null) publish(lastWorkspace());
  });
}
// The master switch flips what `lastWorkspace()` answers, so a Home
// screen sitting open shows or hides the section as soon as it changes.
let lastEnabled = settings.get('lastWorkspaceEnabled');
settings.subscribe((s) => {
  if (s.lastWorkspaceEnabled !== lastEnabled) {
    lastEnabled = s.lastWorkspaceEnabled;
    publish(lastWorkspace());
  }
});
