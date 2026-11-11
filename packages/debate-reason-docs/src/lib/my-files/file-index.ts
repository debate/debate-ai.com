/**
 * The My Files index: every one of your own documents' name and place in the
 * tree, with no content — kept in `localStorage` the same way the Topic
 * Starters index is (`lib/topic-starters/file-index.ts`).
 *
 * On load the sidebar paints your tree straight from the stored copy —
 * synchronously, before any request — then the IndexedDB copy of the files
 * themselves (`lib/my-files/local-cache.ts`) fills in their content, and the
 * network replaces both. The client writes the index again whenever the tree
 * changes, and — like the Topic Starters index — checks the server's copy in
 * the background on every load: `GET /api/doc/documents/file-index` lists the
 * signed-in user's rows (names, folders and `updatedAt`, no content), and
 * {@link reconcileMyFilesIndex} compares it with the IndexedDB copy so only
 * files that changed elsewhere (another device, a tab) are downloaded again.
 *
 * A row known only from the index carries no content (`indexOnly`); the
 * provider loads it by id before it is opened, downloaded or copied. Every
 * file row also carries what the tree shows on hover — created date, author
 * and the size stats (quotes, blocks, pages, characters) the server counts
 * on save (`lib/file-stats/file-stats.ts`) — so hovering never loads content.
 *
 * The stored copy is scoped to one account: it records whose files it lists
 * (`owner` — the user id, or {@link MY_FILES_ANONYMOUS_OWNER} for the shared
 * signed-out set). The provider paints from it only for that account, and
 * drops it (and the IndexedDB copy) when someone else signs in on the same
 * browser — see {@link canPaintMyFilesIndex}.
 *
 * @module lib/my-files/file-index
 */

import type { ReasonDocument } from "../../docs/types"
import { parseFileStatFields, statFieldsOf, type FileStatFields } from "../file-stats/file-stats"

/** Bump when the stored shape changes; an old copy is then ignored.
 *  2: rows carry `createdAt`, `author` and the size stats. */
export const MY_FILES_INDEX_VERSION = 2

/** `localStorage` key holding the index. */
export const MY_FILES_INDEX_STORAGE_KEY = "debate-ai:my-files:file-index"

/** The `owner` of the signed-out set of documents (rows with no user id). */
export const MY_FILES_ANONYMOUS_OWNER = "anonymous"

/** Whose files the local copy should hold, from the host's session: the user
 *  id, {@link MY_FILES_ANONYMOUS_OWNER} when signed out, or `null` while the
 *  session is still loading (or the host never said). */
export function myFilesOwnerOf(session: {
  isLoading?: boolean
  isAuthenticated: boolean
  user: { id?: string | null } | null
}): string | null {
  if (session.isLoading !== false) return null
  if (!session.isAuthenticated) return MY_FILES_ANONYMOUS_OWNER
  return session.user?.id ?? null
}

/** Where the client checks for a newer index (the server builds it fresh
 *  from the `documents` table on every request). */
export const MY_FILES_INDEX_URL = "/api/doc/documents/file-index"

/** One row of the index: everything about a document except its content. */
export interface MyFilesIndexEntry extends FileStatFields {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
  format?: string
  updatedAt: string | number
  createdAt?: string | number | null
  author?: string | null
}

/** The row fields the index is built from. */
type MyFilesIndexSource = Pick<ReasonDocument, "id" | "title" | "parentId" | "isFolder" | "format" | "updatedAt"> &
  Pick<ReasonDocument, "createdAt" | "author" | "quoteCount" | "blockCount" | "pageCount" | "charCount">

/** The whole index as stored. */
export interface MyFilesIndex {
  version: number
  /** ISO time the client built it. */
  generatedAt: string
  count: number
  items: MyFilesIndexEntry[]
  /** Whose files these are (see {@link myFilesOwnerOf}). Missing on a copy
   *  written before the index was scoped, or before the session was known. */
  owner?: string
}

/** A document row that may be known only from the index. */
export type LocalDocument = ReasonDocument & { indexOnly?: true }

/** Builds the index from document rows. */
export function buildMyFilesIndex(
  rows: readonly MyFilesIndexSource[],
  now: Date = new Date(),
  owner: string | null = null,
): MyFilesIndex {
  const items = rows.map((row): MyFilesIndexEntry => {
    const entry: MyFilesIndexEntry = {
      id: row.id,
      title: row.title,
      parentId: row.parentId ?? null,
      isFolder: Boolean(row.isFolder),
      updatedAt: row.updatedAt ?? 0,
    }
    if (row.createdAt != null) entry.createdAt = row.createdAt
    if (!row.isFolder) {
      if (row.format) entry.format = row.format
      if (row.author) entry.author = row.author
      Object.assign(entry, statFieldsOf(row))
    }
    return entry
  })
  return withOwner({ version: MY_FILES_INDEX_VERSION, generatedAt: now.toISOString(), count: items.length, items }, owner)
}

/** The index stamped with `owner` (unchanged when `owner` is `null`). */
export function withOwner(index: MyFilesIndex, owner: string | null): MyFilesIndex {
  return owner ? { ...index, owner } : index
}

/**
 * Whether the stored index may paint the tree for `owner` before the server
 * answers. While the session is unknown (`owner` is `null`) the stored copy is
 * shown — it is almost always this browser's own account, and the session
 * check that follows wipes it if not. Once the session is known, only a copy
 * recorded for that same account is shown.
 */
export function canPaintMyFilesIndex(index: Pick<MyFilesIndex, "owner">, owner: string | null): boolean {
  return owner === null || index.owner === owner
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
  const items = raw.items.filter(isEntry).map((row): MyFilesIndexEntry => {
    const { createdAt, author, quoteCount: _q, blockCount: _b, pageCount: _p, charCount: _c, ...rest } = row
    const entry: MyFilesIndexEntry = {
      ...rest,
      updatedAt: typeof row.updatedAt === "string" || typeof row.updatedAt === "number" ? row.updatedAt : 0,
      ...parseFileStatFields(row as unknown as Record<string, unknown>),
    }
    if (typeof createdAt === "string" || typeof createdAt === "number") entry.createdAt = createdAt
    if (typeof author === "string") entry.author = author
    return entry
  })
  const index: MyFilesIndex = {
    version: MY_FILES_INDEX_VERSION,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    count: items.length,
    items,
  }
  return typeof raw.owner === "string" && raw.owner ? withOwner(index, raw.owner) : index
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

/** Fetches the server's index and stores it (as `owner`'s, when given).
 *  Pass `storage: null` to only fetch. Resolves to `null` when the request
 *  fails (offline, signed-out error) — the local copy then stands. */
export async function refreshMyFilesIndex({
  fetchImpl = fetch,
  storage = defaultStorage(),
  owner = null,
}: {
  fetchImpl?: typeof fetch
  storage?: StorageLike | null
  owner?: string | null
} = {}): Promise<MyFilesIndex | null> {
  try {
    const res = await fetchImpl(MY_FILES_INDEX_URL)
    if (!res.ok) return null
    const parsed = parseMyFilesIndex(await res.json())
    const index = parsed && withOwner(parsed, owner)
    if (index) writeStoredMyFilesIndex(index, storage)
    return index
  } catch {
    return null
  }
}

function timeOf(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return Number.NaN
  return typeof value === "number" ? value : new Date(value).getTime()
}

/** Whether a cached row is the version the index describes. */
export function isSameVersion(cached: Pick<ReasonDocument, "updatedAt">, entry: Pick<MyFilesIndexEntry, "updatedAt">): boolean {
  const a = timeOf(cached.updatedAt)
  const b = timeOf(entry.updatedAt)
  return Number.isFinite(a) && a === b
}

/** What a fresh server index means for the local copy. */
export interface MyFilesReconcile {
  /** The tree, in index order: current cached rows keep their content, the
   *  rest come back index-only. Folders never need content. */
  rows: LocalDocument[]
  /** Files whose content is missing here or older than the server's. */
  stale: number[]
  /** Cached rows the server no longer lists (deleted elsewhere). */
  removed: number[]
}

/**
 * Compares the server's index with the rows cached on this device. A cached
 * file whose `updatedAt` matches is current and needs no download; any other
 * file is listed in `stale` for the caller to fetch.
 */
export function reconcileMyFilesIndex(index: MyFilesIndex, cached: readonly ReasonDocument[]): MyFilesReconcile {
  const byId = new Map(cached.map((doc) => [doc.id, doc]))
  const listed = new Set<number>()
  const stale: number[] = []
  const rows = index.items.map((entry): LocalDocument => {
    listed.add(entry.id)
    const local = byId.get(entry.id)
    if (entry.isFolder) return { ...stripIndexOnly(local ?? indexEntryToDocument(entry)), ...entry, content: "" }
    if (local && !isIndexOnlyDocument(local) && isSameVersion(local, entry)) {
      return { ...stripIndexOnly(local), ...entry, content: local.content }
    }
    stale.push(entry.id)
    return indexEntryToDocument(entry)
  })
  const removed = cached.filter((doc) => !listed.has(doc.id)).map((doc) => doc.id)
  return { rows, stale, removed }
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
  const byId = new Map(index.items.map((entry) => [entry.id, entry]))
  return [
    ...loaded.map((doc) => withIndexDetails(doc, byId.get(doc.id))),
    ...index.items.filter((entry) => !have.has(entry.id)).map(indexEntryToDocument),
  ]
}

/** The hover details (author, created date, stats) a row lacks, taken from
 *  its index entry — a row cached before they existed still shows them. */
export function withIndexDetails<T extends ReasonDocument>(doc: T, entry: MyFilesIndexEntry | undefined): T {
  if (!entry) return doc
  const keys = ["createdAt", "author", "quoteCount", "blockCount", "pageCount", "charCount"] as const
  let next: T | null = null
  for (const key of keys) {
    if (doc[key] == null && entry[key] != null) {
      next ??= { ...doc }
      ;(next as Record<string, unknown>)[key] = entry[key]
    }
  }
  return next ?? doc
}

/** Rows as they should be written out: without the client-only flag. */
export function stripIndexOnly(doc: LocalDocument): ReasonDocument {
  const { indexOnly: _indexOnly, ...rest } = doc
  return rest
}
