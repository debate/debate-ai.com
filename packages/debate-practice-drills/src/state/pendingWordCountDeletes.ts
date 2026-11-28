/**
 * @fileoverview The word-count rounds deleted in this browser that the
 * account hasn't confirmed removing yet, kept in `localStorage` so they
 * outlive the tab.
 *
 * `hooks/useWordCountRounds.ts` used to hold these ids in a module-level
 * `Set`. A delete that failed (offline, a 5xx) and was never retried before
 * the tab closed was forgotten, so the next page load's merge found the round
 * still in the account and adopted it back: the user's delete silently undid
 * itself. Persisting the ids lets the next page load's merge leave them out
 * of the account's list and send the delete again.
 *
 * Every call reads and writes storage, so two tabs share one list and an id
 * one tab confirmed isn't written back by the other. When storage can't be
 * read or written (private mode, quota, no `window`), the set falls back to
 * memory for this page load, which is how it behaved before.
 *
 * This is sync bookkeeping about this browser, not something the user owns:
 * the storage-key coverage guard lists the key as device-local.
 *
 * @module state/pendingWordCountDeletes
 */

/** `localStorage` key holding a JSON array of `roundId`s awaiting an account delete. */
export const PENDING_WORD_COUNT_DELETES_KEY = "wordCountRounds:pendingAccountDeletes";

/** Most ids kept; past this the oldest are dropped, so a long-offline browser can't grow the entry without bound. */
export const MAX_PENDING_WORD_COUNT_DELETES = 500;

/** Longest id kept, matching `MAX_WORD_COUNT_ROUND_ID_LENGTH` in `state/savedWordCountRounds.ts`. */
const MAX_ROUND_ID_LENGTH = 200;

/** The `Storage` methods this module uses, so tests can pass a failing one. */
export type PendingDeletesStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** A `Set<string>`-like view of the pending deletes, backed by storage. */
export interface PendingWordCountDeletes {
  has(roundId: string): boolean;
  add(roundId: string): void;
  delete(roundId: string): void;
  clear(): void;
  /** Every pending id, oldest first. */
  values(): string[];
}

/**
 * Reads a stored list: non-blank strings up to the id length cap, first copy
 * of each, newest `MAX_PENDING_WORD_COUNT_DELETES` kept. Anything that isn't a
 * JSON array reads as empty rather than throwing.
 */
export function parsePendingWordCountDeletes(raw: string | null): string[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.length > MAX_ROUND_ID_LENGTH) continue;
    if (!ids.includes(item)) ids.push(item);
  }
  return ids.slice(-MAX_PENDING_WORD_COUNT_DELETES);
}

function defaultStorage(): PendingDeletesStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Creates the pending-delete set. `getStorage` is called on every access (so
 * a test's fresh `localStorage` is picked up); `null` or a throwing storage
 * means memory only.
 */
export function createPendingWordCountDeletes(
  getStorage: () => PendingDeletesStorage | null = defaultStorage,
): PendingWordCountDeletes {
  // Mirrors the last list read or written; the whole list when storage is out of reach.
  let memory: string[] = [];
  // Set once a write fails: storage then holds a stale list, so memory wins for the rest of this page load.
  let memoryOnly = false;

  const read = (): string[] => {
    if (memoryOnly) return memory;
    try {
      const storage = getStorage();
      if (storage) memory = parsePendingWordCountDeletes(storage.getItem(PENDING_WORD_COUNT_DELETES_KEY));
    } catch {
      // Keep the memory copy.
    }
    return memory;
  };

  const write = (ids: string[]): void => {
    memory = ids.slice(-MAX_PENDING_WORD_COUNT_DELETES);
    try {
      const storage = getStorage();
      if (!storage) return;
      if (memory.length === 0) storage.removeItem(PENDING_WORD_COUNT_DELETES_KEY);
      else storage.setItem(PENDING_WORD_COUNT_DELETES_KEY, JSON.stringify(memory));
    } catch {
      // Quota or a blocked storage: the memory copy still covers this page load.
      memoryOnly = true;
    }
  };

  return {
    has: (roundId) => read().includes(roundId),
    add: (roundId) => {
      const ids = read();
      if (!ids.includes(roundId)) write([...ids, roundId]);
    },
    delete: (roundId) => {
      const ids = read();
      if (ids.includes(roundId)) write(ids.filter((id) => id !== roundId));
    },
    clear: () => write([]),
    values: () => [...read()],
  };
}
