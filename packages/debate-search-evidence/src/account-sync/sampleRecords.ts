/**
 * @fileoverview Sample records: demo data written into a tool's own
 * `localStorage` store so its panel has something to show, but never synced
 * to the account.
 *
 * The "Load sample data" button on the Coaching and Research workspaces seeds
 * the same stores the panels already read, so every panel renders the sample
 * exactly as it would real work. Those stores are in `TOOL_RECORD_COLLECTIONS`,
 * though, and the tool-record sync would otherwise push the sample up to the
 * signed-in user's account. So each seeded record's id is written to a
 * manifest here, and the sync (`tool-record-auto-sync.ts`'s snapshot,
 * `tool-record-mirror.ts`'s bulk save and hydrate) leaves any record the
 * manifest names in this browser.
 *
 * Seeding never replaces a record the user already has: a sample record whose
 * id is already in the store is skipped, so clearing the sample can't delete
 * real work either.
 *
 * @module account-sync/sampleRecords
 */

import { toolRecordId, type ToolRecordCollection } from "./toolRecordCollections"

/** localStorage key of the manifest: seeded record ids, by store key. */
export const SAMPLE_RECORDS_MANIFEST_KEY = "sampleDataRecords"

type Manifest = Record<string, string[]>

function readManifest(): Manifest {
  if (typeof localStorage === "undefined") return {}
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAMPLE_RECORDS_MANIFEST_KEY) ?? "{}")
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    const manifest: Manifest = {}
    for (const [key, ids] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(ids)) manifest[key] = ids.filter((id): id is string => typeof id === "string")
    }
    return manifest
  } catch {
    return {}
  }
}

function writeManifest(manifest: Manifest): void {
  if (typeof localStorage === "undefined") return
  const keys = Object.keys(manifest).filter((key) => (manifest[key]?.length ?? 0) > 0)
  if (keys.length === 0) {
    localStorage.removeItem(SAMPLE_RECORDS_MANIFEST_KEY)
    return
  }
  localStorage.setItem(SAMPLE_RECORDS_MANIFEST_KEY, JSON.stringify(Object.fromEntries(keys.map((key) => [key, manifest[key]]))))
}

function readStore(storageKey: string): unknown[] {
  if (typeof localStorage === "undefined") return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStore(storageKey: string, records: unknown[]): void {
  if (typeof localStorage === "undefined") return
  const newValue = JSON.stringify(records)
  localStorage.setItem(storageKey, newValue)
  // Same-tab panels listen for `storage` (see each package's live-update.ts),
  // which the browser only fires in other tabs.
  if (typeof window === "undefined" || typeof StorageEvent === "undefined") return
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue, storageArea: localStorage }))
  } catch {
    // No constructible StorageEvent: the data is stored either way.
  }
}

function idOf(record: unknown, idField: string): string | null {
  if (typeof record !== "object" || record === null) return null
  const id = (record as Record<string, unknown>)[idField]
  return typeof id === "string" && id.length > 0 ? id : null
}

/**
 * Appends sample records to an array store and remembers their ids.
 *
 * @param storageKey - The store's localStorage key.
 * @param idField - The field holding each record's id.
 * @param records - The sample records.
 * @returns How many were added (records whose id the store already holds are skipped).
 */
export function seedSampleRecords(storageKey: string, idField: string, records: readonly unknown[]): number {
  const existing = readStore(storageKey)
  const taken = new Set(existing.map((record) => idOf(record, idField)).filter((id): id is string => id !== null))
  const added: unknown[] = []
  for (const record of records) {
    const id = idOf(record, idField)
    if (id === null || taken.has(id)) continue
    taken.add(id)
    added.push(record)
  }
  if (added.length === 0) return 0

  // The manifest first, so a sync tick between the two writes already skips them.
  const manifest = readManifest()
  const ids = new Set(manifest[storageKey] ?? [])
  for (const record of added) ids.add(idOf(record, idField) as string)
  manifest[storageKey] = [...ids]
  writeManifest(manifest)

  writeStore(storageKey, [...existing, ...added])
  return added.length
}

/**
 * Removes every sample record from the given stores.
 *
 * @param storageKeys - The stores to clear.
 * @param idFields - Each store's id field, by key; `"id"` when absent.
 * @returns How many records were removed.
 */
export function clearSampleRecords(storageKeys: readonly string[], idFields: Readonly<Record<string, string>> = {}): number {
  const manifest = readManifest()
  let removed = 0
  for (const storageKey of storageKeys) {
    const ids = new Set(manifest[storageKey] ?? [])
    if (ids.size > 0) {
      const idField = idFields[storageKey] ?? "id"
      const records = readStore(storageKey)
      const kept = records.filter((record) => {
        const id = idOf(record, idField)
        return id === null || !ids.has(id)
      })
      removed += records.length - kept.length
      if (kept.length !== records.length) writeStore(storageKey, kept)
    }
    delete manifest[storageKey]
  }
  writeManifest(manifest)
  return removed
}

/**
 * Whether any of the given stores holds sample records.
 *
 * @param storageKeys - The stores to check.
 * @returns True when the manifest names a seeded record in one of them.
 */
export function hasSampleRecords(storageKeys: readonly string[]): boolean {
  const manifest = readManifest()
  return storageKeys.some((key) => (manifest[key]?.length ?? 0) > 0)
}

/**
 * Whether a record of a synced collection is sample data, and so must stay
 * out of the account.
 *
 * @param collection - The record's collection.
 * @param record - The record.
 * @returns True when its id was seeded as a sample into the collection's store.
 */
export function isSampleToolRecord(collection: ToolRecordCollection, record: unknown): boolean {
  const ids = readManifest()[collection.storageKey]
  if (!ids || ids.length === 0) return false
  const id = toolRecordId(collection, record)
  return id !== null && ids.includes(id)
}
