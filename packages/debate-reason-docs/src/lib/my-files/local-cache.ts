"use client"

/**
 * Client-side copy of your own documents, content included — the My Files
 * counterpart of the Topic Starters cache (`lib/topic-starters/local-cache.ts`).
 *
 * `localStorage` holds only the index (`lib/my-files/file-index.ts`); the
 * files themselves can be megabytes of `.cmir`, so they live in IndexedDB.
 * Opening a file you have opened on this device before needs no request, and
 * the whole tree is there offline.
 *
 * Writes never throw and reads resolve to `null`/empty when there is nothing
 * cached or IndexedDB is unavailable, so callers always fall back to the
 * network. Every call goes through a {@link MyFilesBackend} (IndexedDB by
 * default) that tests replace with {@link configureMyFilesCache}.
 *
 * @module lib/my-files/local-cache
 */

import type { ReasonDocument } from "../../docs/types"

/** A row as stored, stamped when it was written. */
export interface CachedDocument extends ReasonDocument {
  cachedAt: number
}

export interface MyFilesBackend {
  getAll(): Promise<CachedDocument[]>
  get(id: number): Promise<CachedDocument | null>
  put(rows: readonly CachedDocument[]): Promise<void>
  remove(ids: readonly number[]): Promise<void>
  clear(): Promise<void>
}

const DB_NAME = "debate-ai-my-files"
const STORE = "documents"

let opened: Promise<IDBDatabase> | null = null
let override: MyFilesBackend | null = null

/** Swap the storage backend (tests). `null` restores IndexedDB. */
export function configureMyFilesCache(backend: MyFilesBackend | null): void {
  override = backend
}

function idb(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return opened
}

function transact<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return idb().then(
    (database) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = database.transaction(STORE, mode)
        const request = body(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(request ? request.result : undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

const idbBackend: MyFilesBackend = {
  async getAll() {
    return ((await transact("readonly", (store) => store.getAll())) as CachedDocument[] | undefined) ?? []
  },
  async get(id) {
    return ((await transact("readonly", (store) => store.get(id))) as CachedDocument | undefined) ?? null
  },
  async put(rows) {
    await transact("readwrite", (store) => {
      for (const row of rows) store.put(row)
    })
  },
  async remove(ids) {
    await transact("readwrite", (store) => {
      for (const id of ids) store.delete(id)
    })
  },
  async clear() {
    await transact("readwrite", (store) => store.clear())
  },
}

function backend(): MyFilesBackend | null {
  if (override) return override
  return typeof indexedDB === "undefined" ? null : idbBackend
}

function strip(row: CachedDocument): ReasonDocument {
  const { cachedAt: _cachedAt, ...rest } = row
  return rest
}

/** Every cached document, or `[]`. */
export async function getCachedDocuments(): Promise<ReasonDocument[]> {
  try {
    return ((await backend()?.getAll()) ?? []).map(strip)
  } catch {
    return []
  }
}

/** One cached document by id, or `null`. */
export async function getCachedDocument(id: number): Promise<ReasonDocument | null> {
  try {
    const row = await backend()?.get(id)
    return row ? strip(row) : null
  } catch {
    return null
  }
}

/** Write these rows (new or changed) through to the cache. */
export async function putCachedDocuments(rows: readonly ReasonDocument[]): Promise<void> {
  if (rows.length === 0) return
  const now = Date.now()
  try {
    await backend()?.put(rows.map((row) => ({ ...row, cachedAt: now })))
  } catch {
    // Quota exceeded or IndexedDB gone: the network copy still stands.
  }
}

/** Drop these rows (deleted documents). */
export async function removeCachedDocuments(ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return
  try {
    await backend()?.remove(ids)
  } catch {
    // Nothing to do.
  }
}

/** Drop every cached document (e.g. on sign-out). */
export async function clearCachedDocuments(): Promise<void> {
  try {
    await backend()?.clear()
  } catch {
    // Nothing to do.
  }
}
