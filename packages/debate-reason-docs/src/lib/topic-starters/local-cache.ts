"use client"

/**
 * Client-side cache for the public Topic Starters library.
 *
 * `localStorage` (~5 MB) cannot hold the library, so this lives in IndexedDB
 * (a gigabyte-scale quota, durable across sessions) instead. Two shapes:
 *
 *  - **index-only** — the capped catalogue (`GET /api/topic-starters`), kept
 *    on every device so the sidebar tree renders without a network round trip.
 *  - **full** — every published item with its content
 *    (`GET /api/topic-starters/all`), about 60 MB. Pulled once, in the
 *    background, when the browser extension is installed (its unlimited
 *    storage quota backs the copy); after that any file opens instantly,
 *    even offline.
 *
 * Writes never throw and reads resolve to `null` when there is nothing
 * cached or IndexedDB is unavailable, so callers always fall back to the
 * network. Every read and write goes through a configurable {@link Backend}
 * (IndexedDB by default), so the module is testable without IndexedDB.
 *
 * @module lib/topic-starters/local-cache
 */

import { findItemByRef } from "../reason-docs/doc-path"
import type { TopicStarterItem } from "../../docs/topic-starters/TopicStarterTree"

/** Chrome Web Store id of `apps/debate-browser-ext` — keep in sync with its
 *  manifest `key` and with `@debate-ai/data-sync`'s `DEBATE_EXTENSION_ID`. */
export const DEBATE_EXTENSION_ID = "noecbaibfhbmpapofcdkgchfifmoinfj"
/** Message type the extension's storage bridge answers — keep in sync with
 *  `apps/debate-browser-ext/src/storage/bulk-storage-bridge.ts`. */
export const BULK_STORAGE_MESSAGE = "debate-ai:bulk-storage"

/** Reserved key under which the last full-download version is stored. */
const VERSION_KEY = "__version__"

/** A row as stored in the cache, stamped when it was written. */
export interface CachedTopicStarter extends TopicStarterItem {
  cachedAt: number
}

interface Backend {
  /** Every cached row, keyed by id, values are JSON strings of the row. */
  getAll(): Promise<Record<string, string>>
  getMany(keys: readonly string[]): Promise<Record<string, string | null>>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

// IndexedDB is the only default backend; tests replace it via configureTopicStarterCache.
let opened: Promise<IDBDatabase> | null = null
let primary: Backend | null = null

export function configureTopicStarterCache(options: { primary?: Backend | null }): void {
  if (options.primary !== undefined) primary = options.primary
}

export function resetTopicStarterCacheForTests(): void {
  opened = null
  primary = null
}

function idb(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === "undefined") return null
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("debate-ai-topic-starters", 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore("items", { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return opened
}

function idbBackend(): Backend | null {
  if (typeof indexedDB === "undefined") return null
  const run = <T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> =>
    idb()!.then(
      (database) =>
        new Promise<T | undefined>((resolve, reject) => {
          const tx = database.transaction("items", mode)
          const request = body(tx.objectStore("items"))
          tx.oncomplete = () => resolve(request ? request.result : undefined)
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        }),
    )
  return {
    async getAll() {
      const out: Record<string, string> = {}
      const database = await idb()!
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction("items", "readonly")
        const request = tx.objectStore("items").getAll()
        request.onsuccess = () => {
          for (const row of request.result as { id: number; value: string }[]) out[String(row.id)] = row.value
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
      return out
    },
    async getMany(keys) {
      const out: Record<string, string | null> = {}
      const database = await idb()!
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction("items", "readonly")
        const store = tx.objectStore("items")
        let remaining = keys.length
        if (remaining === 0) return resolve()
        for (const key of keys) {
          const request = store.get(String(key))
          request.onsuccess = () => {
            const row = request.result as { value?: string } | undefined
            out[key] = row?.value ?? null
            if (--remaining === 0) resolve()
          }
          request.onerror = () => reject(tx.error)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      return out
    },
    async set(key, value) {
      await run("readwrite", (store) => store.put({ id: key, value, cachedAt: Date.now() }, key))
    },
    async remove(key) {
      await run("readwrite", (store) => store.delete(key))
    },
    async clear() {
      await run("readwrite", (store) => store.clear())
    },
  }
}

function backend(): Backend | null {
  return primary ?? idbBackend()
}

async function readRows(): Promise<readonly CachedTopicStarter[]> {
  const all = await backend()?.getAll()
  const rows: CachedTopicStarter[] = []
  if (all) {
    for (const [key, value] of Object.entries(all)) {
      if (key === VERSION_KEY) continue
      try {
        rows.push(JSON.parse(value) as CachedTopicStarter)
      } catch {
        // Ignore unreadable rows.
      }
    }
  }
  return rows
}

/** Everything cached, or `null` when nothing is (or IndexedDB is gone). */
export async function getCachedItems(): Promise<readonly CachedTopicStarter[] | null> {
  const rows = await readRows()
  return rows.length > 0 ? rows : null
}

/** One cached row by id, or `null`. */
export async function getCachedItem(id: number): Promise<CachedTopicStarter | null> {
  const raw = await backend()?.getMany([String(id)])
  const value = raw?.[String(id)]
  if (value == null) return null
  try {
    return JSON.parse(value) as CachedTopicStarter
  } catch {
    return null
  }
}

/** Replace the whole cache with `items` (the full library download). */
export async function replaceCachedItems(items: readonly TopicStarterItem[]): Promise<void> {
  const b = backend()
  if (!b) return
  // Keep the version stamp: only a finished download (setCachedVersion) moves it.
  const version = (await b.getMany([VERSION_KEY]))[VERSION_KEY]
  await b.clear()
  if (version != null) await b.set(VERSION_KEY, version)
  const now = Date.now()
  for (const item of items) {
    await b.set(String(item.id), JSON.stringify({ ...item, cachedAt: now }))
  }
}

/** Upsert one row (write-through after a network fetch or a local edit). */
export async function upsertCachedItem(item: TopicStarterItem): Promise<void> {
  await backend()?.set(String(item.id), JSON.stringify({ ...item, cachedAt: Date.now() }))
}

/** Drop every cached starter. */
export async function clearCachedItems(): Promise<void> {
  await backend()?.clear()
}

/** The version stamp the last full download was made against, or `null`. */
export async function getCachedVersion(): Promise<string | null> {
  const raw = await backend()?.getMany([VERSION_KEY])
  return raw?.[VERSION_KEY] ?? null
}

/** Stamp the cache with the version `version` was downloaded against. */
export async function setCachedVersion(version: string): Promise<void> {
  await backend()?.set(VERSION_KEY, version)
}

/** Whether the browser extension is installed and can answer a storage ping. */
export function isExtensionInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const chrome = (globalThis as { chrome?: { runtime?: { sendMessage: unknown } } }).chrome
    const send = chrome?.runtime?.sendMessage
    if (typeof send !== "function") {
      resolve(false)
      return
    }
    const timeout = setTimeout(() => {
      if (!done) resolve(false)
    }, 1500)
    try {
      send(DEBATE_EXTENSION_ID, { type: BULK_STORAGE_MESSAGE, op: "ping" }, (response: unknown) => {
        done = true
        clearTimeout(timeout)
        resolve((response as { ok?: boolean } | undefined)?.ok === true)
      })
    } catch {
      done = true
      clearTimeout(timeout)
      resolve(false)
    }
  })
}

/** Pull the entire published library into the local cache, in the background.
 * Resolves once the last row is stored; failures are reported to the caller.
 */
export async function downloadFullTopicStarterLibrary({
  fetchImpl = fetch,
  version = String(Date.now()),
}: {
  fetchImpl?: typeof fetch
  version?: string
} = {}): Promise<void> {
  const res = await fetchImpl("/api/topic-starters/all")
  if (!res.ok) throw new Error(`topic starter bulk export failed (${res.status})`)
  const body = (await res.json()) as { items?: unknown }
  const items = Array.isArray(body.items) ? body.items : []
  await replaceCachedItems(items as TopicStarterItem[])
  await setCachedVersion(version)
}

/** The catalogue as an id→row map, for resolving a URL's `?topic=` ref from
 *  cache instead of the network. `null` when nothing is cached. */
export async function getCachedIndex(): Promise<ReadonlyMap<number, CachedTopicStarter> | null> {
  const rows = await readRows()
  if (rows.length === 0) return null
  const map = new Map<number, CachedTopicStarter>()
  for (const item of rows) map.set(item.id, item)
  return map
}

/** Resolve a `?topic=`/`?doc=` ref against the cached index, mirroring the
 *  server's `by-path` lookup, so a shared link opens from cache when the
 *  whole library is stored locally. */
export async function resolveCachedTopic(ref: string): Promise<TopicStarterItem | null> {
  const index = await getCachedIndex()
  if (!index) return null
  const match = findItemByRef([...index.values()], ref)
  return match ? ({ ...match } as TopicStarterItem) : null
}
