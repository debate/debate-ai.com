/**
 * Web cross-tab store for a single JSON-serializable value (an array of items,
 * in practice), backed by IndexedDB — which, unlike `localStorage`'s ~5 MB cap,
 * gets a large disk-fraction quota, so image-heavy dropzone content and a
 * growing quick-cards library fit. Cross-tab live sync rides a BroadcastChannel,
 * since IndexedDB has no built-in cross-tab change event: after a write we ping
 * the channel and other tabs re-`load()`.
 *
 * WEB ONLY — the Electron editions keep their main-process backends. All ops are
 * best-effort: where IndexedDB is unavailable (private mode, disabled storage,
 * jsdom in tests) `load()` returns null and `save()` no-ops, so the store still
 * works in-memory for the current tab, just without persistence or cross-tab
 * sync. `save()` surfaces a toast when the browser refuses a write for quota.
 */

import { showToast } from './toast.js';

const DB_NAME = 'cardmirror-web';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = (): void => resolve(req.result);
    req.onerror = (): void => resolve(null);
  });
  return dbPromise;
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.code === 22)
  );
}

export class WebSharedStore<T> {
  private readonly channel: BroadcastChannel | null;

  /**
   * @param key         IndexedDB key the value lives under.
   * @param channelName BroadcastChannel name for cross-tab notifications.
   * @param label       Human name used in the quota toast (e.g. "dropzone shelf").
   */
  constructor(
    private readonly key: string,
    private readonly channelName: string,
    private readonly label: string,
  ) {
    this.channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(channelName)
        : null;
  }

  /** Load the stored value, or null if absent / storage unavailable. */
  async load(): Promise<T | null> {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      let req: IDBRequest;
      try {
        req = db.transaction(STORE, 'readonly').objectStore(STORE).get(this.key);
      } catch {
        resolve(null);
        return;
      }
      req.onsuccess = (): void => resolve((req.result as T | undefined) ?? null);
      req.onerror = (): void => resolve(null);
    });
  }

  /** Persist `value` and ping other tabs. Best-effort; toasts on quota refusal. */
  async save(value: T): Promise<void> {
    const db = await openDb();
    if (!db) return;
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, this.key);
        tx.oncomplete = (): void => resolve();
        tx.onerror = (): void => reject(tx.error ?? new Error('write failed'));
        tx.onabort = (): void => reject(tx.error ?? new Error('write aborted'));
      });
      // BroadcastChannel doesn't echo to the sender, so only OTHER tabs reload.
      this.channel?.postMessage('changed');
    } catch (err) {
      console.warn(`[cardmirror] ${this.label}: web persist failed`, err);
      if (isQuotaError(err)) {
        showToast(`Couldn't save the ${this.label} — browser storage is full.`);
      }
    }
  }

  /** Run `fn` when another tab writes. Returns an unsubscribe. */
  onExternalChange(fn: () => void): () => void {
    if (!this.channel) return () => {};
    const handler = (): void => fn();
    this.channel.addEventListener('message', handler);
    return () => this.channel?.removeEventListener('message', handler);
  }
}
