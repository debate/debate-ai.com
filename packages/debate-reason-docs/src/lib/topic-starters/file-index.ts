/**
 * The Topic Starters file index: every published row's name and place in the
 * tree, with no file content.
 *
 * The browsable catalogue (`GET /api/topic-starters`) carries each file's
 * content, so it is capped at 100 rows. The index is the opposite trade:
 * names only, for the whole library, small enough (a few hundred KB at most)
 * to keep in `localStorage`. The server rebuilds it once a day (the daily
 * cron) and after every applied catalogue edit, and serves it from
 * `GET /api/topic-starters/file-index`.
 *
 * On the client the sidebar paints the tree straight from the stored copy —
 * synchronously, before any request — then fetches a fresh index in the
 * background and stores that. A row known only from the index carries no
 * content (`indexOnly: true`); the provider loads its content by id when it
 * is opened, downloaded or copied.
 *
 * Both halves live here so the server and the client agree on the shape.
 *
 * @module lib/topic-starters/file-index
 */

import type { TopicStarterItem } from "../../docs/topic-starters/TopicStarterTree"

/** Bump when the stored shape changes; an old copy is then ignored. */
export const TOPIC_STARTER_INDEX_VERSION = 2

/** `localStorage` key holding the last fetched index. */
export const TOPIC_STARTER_INDEX_STORAGE_KEY = "debate-ai:topic-starters:file-index"

/** Where the client fetches the index. */
export const TOPIC_STARTER_INDEX_URL = "/api/topic-starters/file-index"

/** One row of the index: everything about a file except its content. */
export interface TopicStarterIndexEntry {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
  tags: string
  year: number | null
  /** The resolution the row is filed under; null inherits its folder's. */
  topicCode: string | null
  format?: string
}

/** The whole index as served and stored. */
export interface TopicStarterFileIndex {
  version: number
  /** ISO time the server built it. */
  generatedAt: string
  count: number
  items: TopicStarterIndexEntry[]
}

/** The row fields the index is built from (a D1 select, or a catalogue row). */
export interface TopicStarterIndexSource {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
  tags?: string | null
  year?: number | null
  topicCode?: string | null
  format?: string | null
}

/** Builds the index from published rows, folders first then by title — the
 *  order the tree shows them in. */
export function buildTopicStarterFileIndex(
  rows: readonly TopicStarterIndexSource[],
  now: Date = new Date(),
): TopicStarterFileIndex {
  const items = rows
    .map((row): TopicStarterIndexEntry => {
      const entry: TopicStarterIndexEntry = {
        id: row.id,
        title: row.title,
        parentId: row.parentId ?? null,
        isFolder: Boolean(row.isFolder),
        tags: row.tags ?? "[]",
        year: row.year ?? null,
        topicCode: row.topicCode ?? null,
      }
      if (!row.isFolder && row.format) entry.format = row.format
      return entry
    })
    .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.title.localeCompare(b.title) || a.id - b.id)
  return { version: TOPIC_STARTER_INDEX_VERSION, generatedAt: now.toISOString(), count: items.length, items }
}

function isEntry(value: unknown): value is TopicStarterIndexEntry {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === "number" &&
    typeof row.title === "string" &&
    (row.parentId === null || typeof row.parentId === "number") &&
    typeof row.isFolder === "boolean"
  )
}

/** Validates an index read from storage or the network; `null` when it is
 *  not one (or is an older shape). Malformed rows are dropped. */
export function parseTopicStarterFileIndex(value: unknown): TopicStarterFileIndex | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<TopicStarterFileIndex>
  if (raw.version !== TOPIC_STARTER_INDEX_VERSION || !Array.isArray(raw.items)) return null
  const items = raw.items.filter(isEntry).map((row) => ({
    ...row,
    tags: typeof row.tags === "string" ? row.tags : "[]",
    year: typeof row.year === "number" ? row.year : null,
    topicCode: typeof row.topicCode === "string" ? row.topicCode : null,
  }))
  return {
    version: TOPIC_STARTER_INDEX_VERSION,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
    count: items.length,
    items,
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    // Access itself throws when site data is blocked.
    return null
  }
}

/** The index kept in `localStorage`, or `null` when there is none (or
 *  storage is unavailable). Synchronous, so the tree can paint from it
 *  before anything else happens. */
export function readStoredTopicStarterIndex(storage: StorageLike | null = defaultStorage()): TopicStarterFileIndex | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(TOPIC_STARTER_INDEX_STORAGE_KEY)
    return raw ? parseTopicStarterFileIndex(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Stores the index. Never throws: a full or blocked storage just means the
 *  next visit fetches it again. */
export function writeStoredTopicStarterIndex(
  index: TopicStarterFileIndex,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(TOPIC_STARTER_INDEX_STORAGE_KEY, JSON.stringify(index))
  } catch {
    // Quota exceeded or storage disabled.
  }
}

/** Fetches the current index from the server and stores it. Resolves to
 *  `null` when the request fails. */
export async function refreshTopicStarterIndex({
  fetchImpl = fetch,
  storage = defaultStorage(),
}: {
  fetchImpl?: typeof fetch
  storage?: StorageLike | null
} = {}): Promise<TopicStarterFileIndex | null> {
  try {
    const res = await fetchImpl(TOPIC_STARTER_INDEX_URL)
    if (!res.ok) return null
    const index = parseTopicStarterFileIndex(await res.json())
    if (index) writeStoredTopicStarterIndex(index, storage)
    return index
  } catch {
    return null
  }
}

/** True for a row the client knows only from the index — its content has
 *  not been loaded yet. */
export function isIndexOnly(item: TopicStarterItem): boolean {
  return item.indexOnly === true
}

/** An index row as a catalogue row without content. */
export function indexEntryToItem(entry: TopicStarterIndexEntry): TopicStarterItem {
  return { ...entry, content: "", indexOnly: true }
}

/**
 * The tree's rows: every row that has content (from the catalogue, the
 * IndexedDB cache or a lookup), plus every index row not among them.
 * Rows with content win, since they are at least as fresh as the index.
 */
export function mergeTopicStarterIndex(
  withContent: readonly TopicStarterItem[],
  index: TopicStarterFileIndex | null,
): TopicStarterItem[] {
  const loaded = withContent.filter((item) => !isIndexOnly(item))
  if (!index) return loaded
  const have = new Set(loaded.map((item) => item.id))
  return [...loaded, ...index.items.filter((entry) => !have.has(entry.id)).map(indexEntryToItem)]
}
