/**
 * The My Files index: every one of your own documents' name and place in the
 * tree, with no content — kept in `localStorage` the same way the Topic
 * Starters index is (`lib/topic-starters/file-index.ts`).
 *
 * On load the sidebar paints your tree straight from the stored copy —
 * synchronously, before any request — then the IndexedDB copy of the files
 * themselves (`lib/my-files/local-cache.ts`) fills in their content, and the
 * network list replaces both. Unlike the Topic Starters index there is no
 * server endpoint for it: the client builds it from the rows it already has
 * and writes it again whenever the tree changes.
 *
 * A row known only from the index carries no content (`indexOnly`); the
 * provider loads it by id before it is opened, downloaded or copied.
 *
 * @module lib/my-files/file-index
 */

import type { ReasonDocument } from "@debate-ai/types"

/** Bump when the stored shape changes; an old copy is then ignored. */
export const MY_FILES_INDEX_VERSION = 1

/** `localStorage` key holding the index. */
export const MY_FILES_INDEX_STORAGE_KEY = "debate-ai:my-files:file-index"

/** One row of the index: everything about a document except its content. */
export interface MyFilesIndexEntry {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
  format?: string
  updatedAt: string | number
}

/** The whole index as stored. */
export interface MyFilesIndex {
  version: number
  /** ISO time the client built it. */
  generatedAt: string
  count: number
  items: MyFilesIndexEntry[]
}

/** A document row that may be known only from the index. */
export type LocalDocument = ReasonDocument & { indexOnly?: true }

/** Builds the index from document rows. */
export function buildMyFilesIndex(
  rows: readonly Pick<ReasonDocument, "id" | "title" | "parentId" | "isFolder" | "format" | "updatedAt">[],
  now: Date = new Date(),
): MyFilesIndex {
  const items = rows.map((row): MyFilesIndexEntry => {
    const entry: MyFilesIndexEntry = {
      id: row.id,
      title: row.title,
      parentId: row.parentId ?? null,
      isFolder: Boolean(row.isFolder),
      updatedAt: row.updatedAt ?? 0,
    }
    if (!row.isFolder && row.format) entry.format = row.format
    return entry
  })
  return { version: MY_FILES_INDEX_VERSION, generatedAt: now.toISOString(), count: items.length, items }
}

function isEntry(value: unknown): value is MyFilesIndexEntry {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "number" &&
    typeof row.title === "string" &&
    (row.parentId === null || typeof row.parentId === "number") &&
    typeof row.isFolder === "boolean"
  )
}

/** Validates an index read from storage; `null` when it is not one (or is
 *  an older shape). Malformed rows are dropped. */
export function parseMyFilesIndex(value: unknown): MyFilesIndex | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<MyFilesIndex>
  if (raw.version !== MY_FILES_INDEX_VERSION || !Array.isArray(raw.items)) return null
  const items = raw.items.filter(isEntry).map((row) => ({
    ...row,
    updatedAt: typeof row.updatedAt === "string" || typeof row.updatedAt === "number" ? row.updatedAt : 0,
  }))
  return {
    version: MY_FILES_INDEX_VERSION,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    count: items.length,
    items,
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    // Access itself throws when site data is blocked.
    return null
  }
}

/** The index kept in `localStorage`, or `null`. Synchronous, so the tree can
 *  paint from it before anything else happens. */
export function readStoredMyFilesIndex(storage: StorageLike | null = defaultStorage()): MyFilesIndex | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(MY_FILES_INDEX_STORAGE_KEY)
    return raw ? parseMyFilesIndex(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Stores the index. Never throws. */
export function writeStoredMyFilesIndex(index: MyFilesIndex, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(MY_FILES_INDEX_STORAGE_KEY, JSON.stringify(index))
  } catch {
    // Quota exceeded or storage disabled.
  }
}

/** Forgets the stored index (e.g. on sign-out). Never throws. */
export function clearStoredMyFilesIndex(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(MY_FILES_INDEX_STORAGE_KEY)
  } catch {
    // Storage disabled.
  }
}

/** True for a row known only from the index — its content is not loaded. */
export function isIndexOnlyDocument(doc: ReasonDocument): boolean {
  return (doc as LocalDocument).indexOnly === true
}

/** An index row as a document without content. */
export function indexEntryToDocument(entry: MyFilesIndexEntry): LocalDocument {
  return { ...entry, content: "", indexOnly: true }
}

/** The tree's rows: every row with content, plus every index row not among
 *  them. Rows with content win, since they are at least as fresh. */
export function mergeMyFilesIndex(withContent: readonly ReasonDocument[], index: MyFilesIndex | null): LocalDocument[] {
  const loaded = withContent.filter((doc) => !isIndexOnlyDocument(doc))
  if (!index) return loaded
  const have = new Set(loaded.map((doc) => doc.id))
  return [...loaded, ...index.items.filter((entry) => !have.has(entry.id)).map(indexEntryToDocument)]
}

/** Rows as they should be written out: without the client-only flag. */
export function stripIndexOnly(doc: LocalDocument): ReasonDocument {
  const { indexOnly: _indexOnly, ...rest } = doc
  return rest
}
