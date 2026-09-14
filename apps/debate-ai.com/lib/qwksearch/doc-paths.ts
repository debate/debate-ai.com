/**
 * @fileoverview `/doc/<the file's name>` — the qwksearch research
 * workspace's document URLs.
 *
 * The workspace at `/doc` is one route with tabs in it (research chats and
 * REASON documents), so its URL is a record of which tab is open rather than
 * a navigation target. That record used to be `?docs=<id>&chat=<id>`, which
 * named a document by an id generated from `Date.now()` — meaningless in a
 * shared link and unreadable in a browser history. The open document is now
 * the path: `/doc/cp-answer-to-states`.
 *
 * The names come from the documents themselves, which the embedded editor
 * keeps in `localStorage` (its `REASON-documents` array — the same key its
 * own sidebar and file tree read). Nothing here writes that store; it is read
 * only to turn an id into a name and back.
 *
 * The slug rules — and the `~<id>` suffix two same-named files need — are
 * shared with the native editor route in `lib/reason-docs/doc-slug`.
 *
 * @module lib/qwksearch/doc-paths
 */

import { type DocSlugEntry, docSlugForId, findDocIdBySlug } from "@/lib/reason-docs/doc-slug"

/** The workspace route itself, with no document named. */
export const QWKSEARCH_DOCS_ROUTE = "/doc"

/** Where the embedded editor keeps its documents. Declared here rather than
 *  imported from `react-reason-editor` so reading a title costs nothing at
 *  runtime: the alternative pulls the editor bundle into every page that
 *  wants to know a document's name. */
export const QWKSEARCH_DOCS_STORAGE_KEY = "REASON-documents"

/** The slice of the editor's stored document shape this module reads. */
export interface StoredQwksearchDoc {
  id?: unknown
  title?: unknown
  isFolder?: unknown
  isDeleted?: unknown
}

/**
 * The documents a URL can name: everything in the store that is a real,
 * still-present file. Folders open no editor and trashed files are not
 * reachable, so neither is addressable.
 */
export function addressableDocs(stored: readonly StoredQwksearchDoc[]): DocSlugEntry[] {
  return stored
    .filter((doc) => typeof doc?.id === "string" && doc.id && !doc.isFolder && !doc.isDeleted)
    .map((doc) => ({ id: doc.id as string, title: typeof doc.title === "string" ? doc.title : "" }))
}

/**
 * The editor's stored documents, or an empty list when there are none to read
 * — no browser, storage blocked (private mode), nothing written yet, or a
 * value that is not the array this key is supposed to hold.
 */
export function readStoredDocs(): DocSlugEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(QWKSEARCH_DOCS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? addressableDocs(parsed as StoredQwksearchDoc[]) : []
  } catch {
    return []
  }
}

/** The `<segment>` in `/doc/<segment>`, or `null` on the bare route (and on
 *  any other page). */
export function docSlugFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathname.split("?")[0]?.split("#")[0] ?? ""
  if (!path.startsWith(`${QWKSEARCH_DOCS_ROUTE}/`)) return null
  const segment = path.slice(QWKSEARCH_DOCS_ROUTE.length + 1).replace(/\/+$/, "")
  return segment || null
}

/** The document a `/doc/<segment>` URL opens, or `null` when it names none —
 *  a file that has since been deleted or renamed, or someone else's link
 *  (documents are per-browser). */
export function docIdFromSlug(
  segment: string | null | undefined,
  docs: readonly DocSlugEntry[],
): string | null {
  return findDocIdBySlug(segment, docs)
}

/**
 * The workspace URL that reopens `docId`.
 *
 * A document the store doesn't know about — one created in the same tick, or
 * one whose row has gone — is addressed by its id instead of dropping it from
 * the URL, so a reload still reopens the right tab. `docIdFromSlug` reads
 * that form back.
 */
export function docPathForId(docId: string, docs: readonly DocSlugEntry[]): string {
  const slug = docSlugForId(docId, docs)
  return `${QWKSEARCH_DOCS_ROUTE}/${slug ?? encodeURIComponent(docId)}`
}
