/**
 * @fileoverview Where large on-device data lives instead of `localStorage`.
 *
 * `localStorage` is a ~5 MB string bucket shared by every store on the
 * origin, so whole flows, rounds and the flow history kept filling it — and
 * the flow workspace answered with a "Storage quota exceeded!" alert asking
 * the user to delete their own work. `localStorage` is now meant for small
 * preferences only (the kind of thing a cookie would hold); anything that
 * grows with use goes through this store.
 *
 * The store keeps the synchronous `getItem`/`setItem`/`removeItem` shape the
 * callers already used, over an in-memory cache:
 *
 * - **IndexedDB** is the primary backend. Its quota is a share of free disk
 *   (gigabytes, not megabytes), and {@link hydrateBulkStorage} asks the
 *   browser to make it persistent so it is not evicted under pressure. Inside
 *   the browser extension, whose manifest asks for `unlimitedStorage`, it has
 *   no quota at all.
 * - **The browser extension**, when it is installed, is a second copy: every
 *   write is mirrored into its `chrome.storage.local` (unlimited under the
 *   same permission), and a key IndexedDB lost is read back from it. See
 *   `apps/debate-browser-ext/src/storage/bulk-storage-bridge.ts`.
 * - **`localStorage`** is read only to migrate values written before this
 *   store existed; once a key reaches a real backend its legacy copy is
 *   deleted, which frees the quota it held. It is written only when neither
 *   backend exists (a test environment, a locked-down browser), and a refusal
 *   there is swallowed — the value stays in memory for this visit.
 *
 * Nothing here ever surfaces a quota error to the user. Signed-in data is
 * also synced to the account by the owning stores (`saved_flows`,
 * `saved_rounds`, `TOOL_RECORD_COLLECTIONS`); this is the offline copy.
 *
 * Framework-free like the rest of `state/`: no React, no `fetch`.
 *
 * @module state/bulk-storage
 */

/** The keys this store owns. Each one used to be a `localStorage` key of the same name. */
export const BULK_STORAGE_KEYS = ["flows", "rounds", "flow-history"] as const

export type BulkStorageKey = (typeof BULK_STORAGE_KEYS)[number]

/**
 * Chrome Web Store id of `apps/debate-browser-ext`, derived from the `key` in
 * its manifest. Same value as `debate-webview`'s `lib/config/site.ts`
 * `EXTENSION_ID` (this package cannot import that one) — keep them in sync.
 */
export const DEBATE_EXTENSION_ID = "noecbaibfhbmpapofcdkgchfifmoinfj"

/** Message type the extension's background worker answers (keep in sync with the extension's bridge). */
export const BULK_STORAGE_MESSAGE = "debate-ai:bulk-storage"

/** A place values are durably kept. Every method may reject; callers tolerate it. */
export interface BulkStorageBackend {
  getMany(keys: readonly string[]): Promise<Record<string, string | null>>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** What the Settings page shows about where this device keeps its data. */
export interface BulkStorageStatus {
  /** `"indexeddb"` when IndexedDB is in use, `"memory"` when nothing durable is (values then fall back to `localStorage`). */
  backend: "indexeddb" | "memory"
  /** The browser extension answered and mirrors every write into its unlimited storage. */
  extensionConnected: boolean
  /** Running inside the extension itself, where IndexedDB has no quota. */
  insideExtension: boolean
  /** The browser agreed not to evict this origin's storage (`navigator.storage.persist()`). */
  persisted: boolean
  /** Bytes used / available for the origin, when the browser reports them. */
  usage: number | null
  quota: number | null
}

type LegacyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

// `null` is a remembered deletion, so a cache miss can still fall through to
// the legacy `localStorage` copy without resurrecting a removed key.
const cache = new Map<string, string | null>()
const listeners = new Set<() => void>()

let primary: BulkStorageBackend | null = null
let mirror: BulkStorageBackend | null = null
let insideExtension = false
let persisted = false
let hydration: Promise<void> | null = null

function legacy(): LegacyStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

/** Subscribes to status changes (hydration finished, extension connected). */
export function subscribeBulkStorage(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reads a value: this visit's copy, else whatever an older build left in `localStorage`. */
export function getBulkItem(key: string): string | null {
  if (cache.has(key)) return cache.get(key) ?? null
  try {
    return legacy()?.getItem(key) ?? null
  } catch {
    return null
  }
}

/**
 * Stores a value. Applies to the in-memory copy first, always, then writes
 * through to the backends in the background. Never throws.
 */
export function setBulkItem(key: string, value: string): void {
  if (!primary && !mirror) {
    // No durable backend: `localStorage` stays the source of truth, and only
    // a value it refused is held in memory.
    if (writeLegacy(key, value)) cache.delete(key)
    else cache.set(key, value)
    return
  }
  cache.set(key, value)
  void mirror?.set(key, value).catch(() => {})
  if (primary) {
    primary.set(key, value).then(
      () => dropLegacy(key),
      () => void writeLegacy(key, value),
    )
  }
}

/** Deletes a value from every place it may be kept. Never throws. */
export function removeBulkItem(key: string): void {
  if (!primary && !mirror) cache.delete(key)
  else cache.set(key, null)
  void primary?.remove(key).catch(() => {})
  void mirror?.remove(key).catch(() => {})
  dropLegacy(key)
}

/** A `Storage`-shaped view, for helpers that take a storage parameter. */
export const bulkStorage: LegacyStorage = {
  getItem: getBulkItem,
  setItem: setBulkItem,
  removeItem: removeBulkItem,
}

/** Writes the legacy copy; `false` when refused. A full quota costs this copy, never the user's edit. */
function writeLegacy(key: string, value: string): boolean {
  try {
    const storage = legacy()
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    // Deliberately silent — see the module comment.
    return false
  }
}

function dropLegacy(key: string): void {
  try {
    legacy()?.removeItem(key)
  } catch {
    // Nothing to free.
  }
}

/** Configures the backends directly. Tests use this; the app uses {@link hydrateBulkStorage}'s defaults. */
export function configureBulkStorage(options: {
  primary?: BulkStorageBackend | null
  mirror?: BulkStorageBackend | null
  insideExtension?: boolean
}): void {
  if (options.primary !== undefined) primary = options.primary
  if (options.mirror !== undefined) mirror = options.mirror
  if (options.insideExtension !== undefined) insideExtension = options.insideExtension
}

/** Forgets everything this module holds in memory. Tests only. */
export function resetBulkStorageForTests(): void {
  cache.clear()
  listeners.clear()
  primary = null
  mirror = null
  insideExtension = false
  persisted = false
  hydration = null
}

/**
 * Loads every bulk key from the backends into memory and migrates legacy
 * `localStorage` copies out. Safe to call many times; the first call does the
 * work and later ones wait on it. Call it before the first {@link getBulkItem}
 * that matters (the flow workspace awaits it before reading its flows).
 */
export function hydrateBulkStorage(options: { extensionId?: string } = {}): Promise<void> {
  if (!hydration) hydration = hydrate(options.extensionId ?? DEBATE_EXTENSION_ID)
  return hydration
}

async function hydrate(extensionId: string | undefined): Promise<void> {
  if (primary === null && mirror === null) {
    primary = openIndexedDbBackend()
    insideExtension = isInsideExtension()
    if (!insideExtension && extensionId) mirror = await connectExtensionBackend(extensionId)
    persisted = await requestPersistence()
  }
  if (!primary && !mirror) {
    // Nothing to load from; `localStorage` is read through directly.
    notify()
    return
  }

  const keys = [...BULK_STORAGE_KEYS]
  const fromPrimary = await safeGetMany(primary, keys)
  const fromMirror = await safeGetMany(mirror, keys)

  for (const key of keys) {
    // A write made while hydrating is newer than anything stored.
    if (cache.has(key)) continue
    const stored = fromPrimary[key] ?? fromMirror[key] ?? null
    const old = (() => {
      try {
        return legacy()?.getItem(key) ?? null
      } catch {
        return null
      }
    })()
    const value = stored ?? old
    if (value === null) continue
    cache.set(key, value)
    // Back-fill whichever backend is missing it; dropping the legacy copy
    // waits for the primary write to land.
    if (primary && fromPrimary[key] == null) {
      await primary.set(key, value).then(
        () => dropLegacy(key),
        () => {},
      )
    } else if (old !== null && primary) {
      dropLegacy(key)
    }
    if (mirror && fromMirror[key] == null) void mirror.set(key, value).catch(() => {})
  }
  notify()
}

async function safeGetMany(
  backend: BulkStorageBackend | null,
  keys: readonly string[],
): Promise<Record<string, string | null>> {
  if (!backend) return {}
  try {
    return await backend.getMany(keys)
  } catch {
    return {}
  }
}

/** Where this device's data currently lives, for the Settings page. */
export async function getBulkStorageStatus(): Promise<BulkStorageStatus> {
  let usage: number | null = null
  let quota: number | null = null
  try {
    const estimate = await globalThis.navigator?.storage?.estimate?.()
    usage = estimate?.usage ?? null
    quota = estimate?.quota ?? null
  } catch {
    // Not reported by this browser.
  }
  return {
    backend: primary ? "indexeddb" : "memory",
    extensionConnected: mirror !== null,
    insideExtension,
    persisted,
    usage,
    quota,
  }
}

function isInsideExtension(): boolean {
  try {
    const protocol = globalThis.location?.protocol ?? ""
    return protocol === "chrome-extension:" || protocol === "moz-extension:"
  } catch {
    return false
  }
}

async function requestPersistence(): Promise<boolean> {
  try {
    const storage = globalThis.navigator?.storage
    if (!storage?.persist) return false
    if (await storage.persisted?.()) return true
    return await storage.persist()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

const DB_NAME = "debate-ai-bulk-storage"
const STORE_NAME = "kv"

/** An IndexedDB key/value backend, or `null` where IndexedDB is unavailable. */
export function openIndexedDbBackend(): BulkStorageBackend | null {
  const idb = (() => {
    try {
      return globalThis.indexedDB ?? null
    } catch {
      return null
    }
  })()
  if (!idb) return null

  let opened: Promise<IDBDatabase> | null = null
  const db = () => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = idb.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return opened
  }
  const run = <T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T> | void) =>
    db().then(
      (database) =>
        new Promise<T | undefined>((resolve, reject) => {
          const tx = database.transaction(STORE_NAME, mode)
          const request = body(tx.objectStore(STORE_NAME))
          tx.oncomplete = () => resolve(request ? request.result : undefined)
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        }),
    )

  return {
    async getMany(keys) {
      const out: Record<string, string | null> = {}
      await db().then(
        (database) =>
          new Promise<void>((resolve, reject) => {
            const tx = database.transaction(STORE_NAME, "readonly")
            const store = tx.objectStore(STORE_NAME)
            for (const key of keys) {
              const request = store.get(key)
              request.onsuccess = () => {
                out[key] = typeof request.result === "string" ? request.result : null
              }
            }
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
          }),
      )
      return out
    },
    async set(key, value) {
      await run("readwrite", (store) => store.put(value, key))
    },
    async remove(key) {
      await run("readwrite", (store) => store.delete(key))
    },
  }
}

// ---------------------------------------------------------------------------
// The browser extension
// ---------------------------------------------------------------------------

interface ExtensionRuntime {
  sendMessage(extensionId: string, message: unknown, callback: (response: unknown) => void): void
  lastError?: unknown
}

function extensionRuntime(): ExtensionRuntime | null {
  try {
    const runtime = (globalThis as { chrome?: { runtime?: ExtensionRuntime } }).chrome?.runtime
    return runtime && typeof runtime.sendMessage === "function" ? runtime : null
  } catch {
    return null
  }
}

/** Sends one request to the extension. Rejects when it is not installed or refuses. */
function ask(runtime: ExtensionRuntime, extensionId: string, request: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      runtime.sendMessage(extensionId, { type: BULK_STORAGE_MESSAGE, ...request }, (response) => {
        // Reading lastError is what tells Chrome the failure was handled.
        if (runtime.lastError || !response || (response as { ok?: boolean }).ok !== true) {
          reject(runtime.lastError ?? new Error("Extension storage unavailable"))
          return
        }
        resolve(response)
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Connects to the browser extension's storage bridge, or resolves `null` when
 * the extension is not installed (or this browser cannot message it — the
 * bridge is Chromium's `externally_connectable`).
 */
export async function connectExtensionBackend(
  extensionId: string,
  runtime: ExtensionRuntime | null = extensionRuntime(),
): Promise<BulkStorageBackend | null> {
  if (!runtime) return null
  try {
    await ask(runtime, extensionId, { op: "ping" })
  } catch {
    return null
  }
  return {
    async getMany(keys) {
      const response = await ask(runtime, extensionId, { op: "get", keys })
      return (response.values ?? {}) as Record<string, string | null>
    },
    async set(key, value) {
      await ask(runtime, extensionId, { op: "set", key, value })
    },
    async remove(key) {
      await ask(runtime, extensionId, { op: "remove", key })
    },
  }
}
