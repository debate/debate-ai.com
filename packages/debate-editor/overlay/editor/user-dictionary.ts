/**
 * The signed-in user's personal spellcheck dictionary: words added via
 * `viewport-spellcheck.ts`'s "Add to Dictionary" context-menu action.
 *
 * Pulled out of `viewport-spellcheck.ts` so the storage shape — and its
 * migration from the format this store shipped with before it synced to the
 * account — is unit-testable without importing that module's ProseMirror
 * plugin machinery.
 *
 * Stored as an array of `{ id, word }` records (`id` and `word` always equal)
 * rather than a bare array of strings, so this store fits the shape
 * `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS` catalog requires — a JSON
 * array under one `localStorage` key, each record keyed by one stable string
 * field — and syncs to the account like every other tool in that catalog
 * (`spellcheckDictionary`), rather than staying per-browser only. A record's
 * `word` is redundant with its `id` today, but keeping both means a future
 * field (e.g. a per-word "added on") has somewhere to live without changing
 * what the id is.
 *
 * `loadUserDictionary` reads the older bare-string-array shape this store
 * shipped with (before it synced) transparently, and rewrites it in the new
 * shape immediately — so an existing dictionary starts syncing the next time
 * the editor loads, not only after the next word is added.
 */

/** The `localStorage` key this store lives under, and the sync catalog's `storageKey`. */
export const USER_DICTIONARY_STORAGE_KEY = 'pmd-user-dictionary';

/** One word in the synced dictionary. `id` is what the account sync keys on. */
export interface UserDictionaryEntry {
  id: string;
  word: string;
}

function isUserDictionaryEntry(value: unknown): value is UserDictionaryEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { word?: unknown }).word === 'string' &&
    (value as { word: string }).word.length > 0
  );
}

/**
 * Parses a dictionary's raw stored JSON into the set of words it names.
 * Tolerant of both the current `{ id, word }[]` shape and the bare
 * `string[]` shape this store used before it synced; an unparseable or
 * unexpected value reads as an empty dictionary rather than throwing.
 *
 * @param raw - `localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)`'s result.
 */
export function parseUserDictionary(raw: string | null): Set<string> {
  const words = new Set<string>();
  if (!raw) return words;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return words;
  }
  if (!Array.isArray(parsed)) return words;
  for (const entry of parsed) {
    if (typeof entry === 'string') {
      if (entry.length > 0) words.add(entry);
    } else if (isUserDictionaryEntry(entry)) {
      words.add(entry.word);
    }
  }
  return words;
}

/** Serializes a set of words into this store's `{ id, word }[]` JSON shape. */
export function serializeUserDictionary(words: Iterable<string>): string {
  const entries: UserDictionaryEntry[] = [...words].map((word) => ({ id: word, word }));
  return JSON.stringify(entries);
}

/**
 * Reads the dictionary from `localStorage`, migrating it to the current
 * `{ id, word }[]` shape in place when it was still in the older bare-string
 * shape.
 */
export function loadUserDictionary(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  let raw: string | null;
  try {
    raw = localStorage.getItem(USER_DICTIONARY_STORAGE_KEY);
  } catch {
    return new Set();
  }
  const words = parseUserDictionary(raw);
  // Migrate eagerly: a dictionary already in the current shape re-serializes
  // to the same JSON, so this only ever rewrites a legacy-shaped store (or a
  // corrupt one, which becomes an explicit empty array rather than staying
  // unparseable). `raw === null` (nothing saved yet) is left alone rather
  // than seeded with `[]` — a dictionary with no words stays "never saved",
  // same as before this store synced.
  if (raw !== null) {
    const migrated = serializeUserDictionary(words);
    if (migrated !== raw) {
      try {
        localStorage.setItem(USER_DICTIONARY_STORAGE_KEY, migrated);
      } catch {
        // localStorage full/disabled — the in-memory set is still correct;
        // migration is retried on the next load.
      }
    }
  }
  return words;
}

/** Writes a dictionary back to `localStorage` in the current shape. */
export function saveUserDictionary(words: Iterable<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(USER_DICTIONARY_STORAGE_KEY, serializeUserDictionary(words));
  } catch {
    // localStorage full/disabled — the in-memory set stays correct for this
    // session; the write is simply lost.
  }
}
