/**
 * @fileoverview The reader's favorite references: sources starred from the
 * docs' References panel, kept in `localStorage` and read back by the Research
 * Workspace's "Favorite References" panel.
 *
 * The store is a JSON array of {@link FavoriteReference} under
 * {@link FAVORITE_REFERENCES_STORAGE_KEY}, the shape the app's account sync
 * (`TOOL_RECORD_COLLECTIONS` in `@debate-ai/research-evidence`, collection
 * `docsFavoriteReferences`) mirrors for a signed-in user, so a guest keeps
 * their favorites in this browser and a signed-in user has them on every
 * device. Nothing here knows about the account; it only reads and writes the
 * array and says when it changed.
 *
 * Framework- and fetch-free so the docs, the research panel and the tests all
 * share one definition of a favorite and of its id.
 */

import type { ReferenceDescription } from "./references"

/** The `localStorage` key holding the favorites array (also the sync catalog's `storageKey`). */
export const FAVORITE_REFERENCES_STORAGE_KEY = "docsFavoriteReferences"

/** Fired on `window` after a write here, since `storage` events only reach other tabs. */
export const FAVORITE_REFERENCES_EVENT = "debate-favorite-references"

/** Most favorites kept; the oldest go first when a new one would pass it. */
export const MAX_FAVORITE_REFERENCES = 500

const MAX_CITATION_CHARS = 2000
const MAX_FIELD_CHARS = 400
const MAX_URL_CHARS = 2000

/** One starred source. */
export interface FavoriteReference {
  /** Stable identity: the same source starred from two pages is one favorite. */
  id: string
  /** The bibliography entry as plain text, without its link. */
  citation: string
  /** The entry's own link; absent when it has none. */
  url?: string
  title?: string
  authors?: string
  year?: string
  publication?: string
  /** The docs page it was starred from, `/docs/...`; absent when unknown. */
  page?: string
  /** When it was starred, ms since the epoch. */
  savedAt: number
}

/** cyrb53: a short, well-spread string hash; an id only has to be stable and collision-unlikely. */
function hash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * The id of a source: its link when it has one (the same article cited with
 * different wording is one source), otherwise its citation text, ignoring
 * case, punctuation and spacing.
 */
export function favoriteReferenceId(source: { url?: string; citation: string }): string {
  const url = (source.url ?? "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/+$/, "")
  if (url) return `ref-${hash(url)}`
  const text = source.citation.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  return `ref-${hash(text)}`
}

function clip(value: string | undefined, max: number): string | undefined {
  const text = (value ?? "").replace(/\s+/g, " ").trim()
  return text ? text.slice(0, max) : undefined
}

/** A favorite for `reference`, starred now from `page`. */
export function toFavoriteReference(reference: ReferenceDescription, page?: string, now: number = Date.now()): FavoriteReference {
  const citation = clip(reference.citation, MAX_CITATION_CHARS) ?? ""
  const url = clip(reference.url, MAX_URL_CHARS)
  const favorite: FavoriteReference = { id: favoriteReferenceId({ url, citation }), citation, savedAt: now }
  if (url) favorite.url = url
  for (const key of ["title", "authors", "year", "publication"] as const) {
    const value = clip(reference[key], MAX_FIELD_CHARS)
    if (value) favorite[key] = value
  }
  if (page && /^\/docs(\/|$)/.test(page)) favorite.page = page.slice(0, 300)
  return favorite
}

function isFavorite(value: unknown): value is FavoriteReference {
  if (!value || typeof value !== "object") return false
  const { id, citation, savedAt } = value as Record<string, unknown>
  return typeof id === "string" && id !== "" && typeof citation === "string" && typeof savedAt === "number" && Number.isFinite(savedAt)
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/** Every favorite, newest first. A missing or damaged store reads as none. */
export function readFavoriteReferences(): FavoriteReference[] {
  const raw = storage()?.getItem(FAVORITE_REFERENCES_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isFavorite).sort((a, b) => b.savedAt - a.savedAt) : []
  } catch {
    return []
  }
}

/** Whether the source with this id is a favorite. */
export function isFavoriteReference(id: string): boolean {
  return readFavoriteReferences().some((favorite) => favorite.id === id)
}

function write(favorites: FavoriteReference[]): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem(FAVORITE_REFERENCES_STORAGE_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITE_REFERENCES)))
  } catch {
    return false
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(FAVORITE_REFERENCES_EVENT))
  return true
}

/**
 * Stars a source, or un-stars it when it already is one.
 *
 * @returns Whether the source is a favorite afterwards; a browser that refuses
 *   to store reports what was there before.
 */
export function toggleFavoriteReference(favorite: FavoriteReference): boolean {
  const current = readFavoriteReferences()
  if (current.some((existing) => existing.id === favorite.id)) {
    return !write(current.filter((existing) => existing.id !== favorite.id))
  }
  return write([favorite, ...current])
}

/** Un-stars a source; a no-op when it is not one. */
export function removeFavoriteReference(id: string): void {
  const current = readFavoriteReferences()
  if (current.some((favorite) => favorite.id === id)) write(current.filter((favorite) => favorite.id !== id))
}

/**
 * Calls `onChange` after the favorites change here, in another tab, or in an
 * account sync merge (which dispatches a `storage` event for the key).
 *
 * @returns Unsubscribes.
 */
export function subscribeFavoriteReferences(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FAVORITE_REFERENCES_STORAGE_KEY) onChange()
  }
  window.addEventListener(FAVORITE_REFERENCES_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(FAVORITE_REFERENCES_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}
