/**
 * @fileoverview The `localStorage` read/write pair every per-user video store
 * in this package is built on.
 *
 * Extracted from `videoLibrary.ts` when the watch history became the fourth
 * store with the same three requirements: parse defensively (a store written
 * by another version, or half-written by a tab that died mid-`setItem`, must
 * read as empty rather than throw on page load), never let a full quota cost
 * the user their click, and let panels mounted in *this* tab hear about the
 * write — the browser fires `storage` only in other tabs.
 *
 * @module state/localRecordStore
 */

/**
 * Reads one store, tolerating anything a browser hands back.
 *
 * @param key - The `localStorage` key.
 * @returns The stored array, or an empty one for anything unparseable.
 */
export function readLocalRecords(key: string): unknown[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Writes one store, and lets any mounted panel in this tab re-read it.
 *
 * @param key - The `localStorage` key.
 * @param records - The records to store.
 */
export function writeLocalRecords(key: string, records: readonly unknown[]): void {
  if (typeof localStorage === "undefined") return;
  const newValue = JSON.stringify(records);
  try {
    localStorage.setItem(key, newValue);
  } catch {
    // A full or blocked quota costs the write, not the click; the in-memory
    // state the caller is about to set still reflects it for this session.
    return;
  }

  notifyLocalRecordChange(key, newValue);
}

/**
 * Dispatches the synthetic `storage` event this tab's own listeners need.
 *
 * @param key - The key that changed.
 * @param newValue - Its new serialized value, or `null` when it was removed.
 */
export function notifyLocalRecordChange(key: string, newValue: string | null): void {
  if (typeof window === "undefined" || typeof StorageEvent === "undefined") return;
  try {
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue, storageArea: localStorage }),
    );
  } catch {
    // A host without a constructible StorageEvent just doesn't live-update.
  }
}
