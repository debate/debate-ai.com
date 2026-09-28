/**
 * Favorite sections for the in-document section picker (live views /
 * linked copies). A section you mirror often should not need a search
 * through the whole outline every time (user request 2026-09-09): the
 * picker's rows carry a star, and starred sections list under a
 * Favorites block at the top of the picker.
 *
 * Favorites are a UI preference, not document content: they live
 * OUTSIDE the file, keyed by the document's on-disk path in
 * localStorage (like the per-document autosave memory), so starring
 * never dirties the document or reaches collaborators. A document
 * without a path yet (unsaved, or a web file handle) keeps its
 * favorites for the life of its editor view only. Heading ids are the
 * identity: they are stored in the file and survive edits and moves; a
 * favorite whose heading is gone simply stops showing.
 */
import type { EditorView } from 'prosemirror-view';
import { getViewDocPath } from './transclusion-doc-path.js';

const STORAGE_KEY = 'pmd-selfref-favorites';
/** Documents remembered at most — the oldest-touched entries drop first. */
const MAX_DOCS = 300;

export interface SectionFavorites {
  /** Starred heading ids, in the order they were starred. */
  list(): string[];
  has(headingId: string): boolean;
  set(headingId: string, on: boolean): void;
}

type Table = Record<string, string[]>;

function readTable(): Table {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Table = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

function writeTable(table: Table): void {
  try {
    const keys = Object.keys(table);
    if (keys.length > MAX_DOCS) for (const k of keys.slice(0, keys.length - MAX_DOCS)) delete table[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
  } catch {
    // Storage disabled / quota: favorites still work for this session's picker.
  }
}

/** Favorites persisted under `key` (a document path). */
export function persistentSectionFavorites(key: string): SectionFavorites {
  return {
    list: () => readTable()[key] ?? [],
    has: (id) => (readTable()[key] ?? []).includes(id),
    set: (id, on) => {
      const table = readTable();
      const cur = table[key] ?? [];
      const next = on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
      // Re-insert so the touched document is the newest entry (the cap
      // drops the oldest first).
      delete table[key];
      if (next.length > 0) table[key] = next;
      writeTable(table);
    },
  };
}

/** Favorites held only in memory, for a view whose document has no path. */
const sessionFavorites = new WeakMap<EditorView, string[]>();
export function sessionSectionFavorites(view: EditorView): SectionFavorites {
  const get = (): string[] => sessionFavorites.get(view) ?? [];
  return {
    list: get,
    has: (id) => get().includes(id),
    set: (id, on) => {
      const cur = get();
      sessionFavorites.set(view, on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id));
    },
  };
}

/** The favorites store for `view`'s document: persistent when the
 *  document has a path, per-view otherwise. */
export function sectionFavoritesFor(view: EditorView): SectionFavorites {
  const path = getViewDocPath(view);
  return path ? persistentSectionFavorites(path) : sessionSectionFavorites(view);
}
