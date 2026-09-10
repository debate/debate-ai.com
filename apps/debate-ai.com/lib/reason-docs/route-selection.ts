/**
 * @fileoverview The URL half of "click a file in any sidebar, get that file
 * in CardMirror".
 *
 * A selection made in the docs sidebar (`components/reason-docs`) is carried
 * to `/reason-editor` in the URL rather than only in `ReasonDocsProvider`
 * state. Provider state covers a client-side hop; the URL is what also covers
 * a reload, a pasted link, and a hard navigation out of `/videos`, which
 * renders its own layout branch and so can boot the editor with an empty
 * provider.
 *
 * That URL names the document: `/reason-editor/cp-answer-to-states`, built by
 * {@link editorHrefForSelection} from the file's own title (see
 * `./doc-slug`). The older `?doc=<id>` / `?topic=<id>` query form is still
 * read — links to it are out in the world — and the editor route rewrites
 * itself to the named path once it knows which file that id is
 * ({@link canonicalEditorUrl}).
 *
 * Both ends of the round trip live here so they cannot drift: the sidebar
 * builds the href, and the editor route's `ReasonDocsRouteSync` reads it back
 * with {@link parseSelectionParams} and {@link resolveSelection}. Pure on
 * purpose — the components stay thin wrappers over functions with unit tests.
 *
 * @module lib/reason-docs/route-selection
 */

import { type DocSlugEntry, docSlugForId, findDocIdBySlug } from "./doc-slug"

export const REASON_EDITOR_ROUTE = "/reason-editor"

/** A document the editor can show: an owned document, or a read-only public
 *  topic starter. Both are addressed by id, in separate namespaces. */
export type ReasonDocsSelection =
  | { kind: "document"; id: number }
  | { kind: "topic"; id: number }

/** One file the editor route can address, as the sidebar knows it. */
export interface ReasonDocsEntry {
  id: number
  title: string
}

/**
 * Everything `/reason-editor` can open, in the order a bare slug resolves
 * against it: topic starters first, then the reader's own documents — the
 * same precedence the query form has always had for a URL carrying both.
 */
export interface ReasonDocsCatalog {
  /** The reader's own non-folder documents, in sidebar order. */
  documents: readonly ReasonDocsEntry[]
  /** Public topic starters that are files, not folders. */
  topics: readonly ReasonDocsEntry[]
}

const EMPTY_CATALOG: ReasonDocsCatalog = { documents: [], topics: [] }

/** The two id namespaces share one URL space, so a slug's discriminator says
 *  which one it belongs to: `d12` is document 12, `t7` is topic starter 7. */
function entryKey(selection: ReasonDocsSelection): string {
  return `${selection.kind === "document" ? "d" : "t"}${selection.id}`
}

/** Reads {@link entryKey} back. */
function parseEntryKey(key: string): ReasonDocsSelection | null {
  const match = /^([dt])(\d+)$/.exec(key)
  if (!match) return null
  const id = Number(match[2])
  if (!Number.isInteger(id)) return null
  return { kind: match[1] === "d" ? "document" : "topic", id }
}

/** The catalogue as one flat, slug-addressable list — topic starters ahead of
 *  owned documents, per {@link ReasonDocsCatalog}. */
function slugEntries(catalog: ReasonDocsCatalog): DocSlugEntry[] {
  return [
    ...catalog.topics.map((item) => ({ id: `t${item.id}`, title: item.title })),
    ...catalog.documents.map((item) => ({ id: `d${item.id}`, title: item.title })),
  ]
}

/** The path segment naming `selection`, or `null` when the catalogue doesn't
 *  hold it (a file still loading, or one that has been deleted). */
export function editorSlugForSelection(
  selection: ReasonDocsSelection,
  catalog: ReasonDocsCatalog,
): string | null {
  return docSlugForId(entryKey(selection), slugEntries(catalog))
}

/** The editor URL that reopens `selection` from cold — `/reason-editor/<the
 *  file's name>`, falling back to the id form while the catalogue is still
 *  loading and the name isn't known yet. */
export function editorHrefForSelection(
  selection: ReasonDocsSelection,
  catalog: ReasonDocsCatalog = EMPTY_CATALOG,
): string {
  const slug = editorSlugForSelection(selection, catalog)
  if (slug) return `${REASON_EDITOR_ROUTE}/${slug}`
  const key = selection.kind === "document" ? "doc" : "topic"
  return `${REASON_EDITOR_ROUTE}?${key}=${selection.id}`
}

/** True on `/reason-editor` and on the named-document paths below it. */
export function isEditorPathname(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = (pathname.split("?")[0]?.split("#")[0] ?? "").replace(/\/+$/, "")
  return path === REASON_EDITOR_ROUTE || path.startsWith(`${REASON_EDITOR_ROUTE}/`)
}

/** The `<slug>` in `/reason-editor/<slug>`, or `null` on the bare route (and
 *  on any other page). */
export function editorSlugFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathname.split("?")[0]?.split("#")[0] ?? ""
  if (!path.startsWith(`${REASON_EDITOR_ROUTE}/`)) return null
  const segment = path.slice(REASON_EDITOR_ROUTE.length + 1).replace(/\/+$/, "")
  return segment || null
}

/**
 * `?doc=12` → `12`. Anything that is not a whole number — empty, `abc`,
 * `3.5`, a repeated param's junk — reads as absent rather than throwing: a
 * malformed link should land on the editor's normal fallback, not an error.
 */
export function parseSelectionId(raw: string | null | undefined): number | null {
  if (!raw) return null
  const id = Number(raw)
  return Number.isInteger(id) ? id : null
}

/** Everything a `/reason-editor` URL can say about which file to open: the
 *  named path segment, plus the legacy ids. */
export interface SelectionParams {
  slug: string | null
  doc: number | null
  topic: number | null
}

/** Reads {@link SelectionParams} off a pathname and anything with
 *  `URLSearchParams`'s getter (Next's `useSearchParams` returns a readonly
 *  wrapper, not the class). */
export function parseSelectionParams(
  params: { get: (key: string) => string | null },
  pathname?: string | null,
): SelectionParams {
  return {
    slug: editorSlugFromPathname(pathname),
    doc: parseSelectionId(params.get("doc")),
    topic: parseSelectionId(params.get("topic")),
  }
}

/** What {@link resolveSelection} is deciding over. */
export interface ResolveSelectionInput extends SelectionParams {
  /** Every file the editor can open, and in what order a slug matches. */
  catalog: ReasonDocsCatalog
  /**
   * False once this URL's selection has already been applied, so a reader who
   * then picks a different file from the sidebar isn't dragged back to the
   * one named in the URL.
   */
  applyParams: boolean
  /** Whether something is already open in the editor. */
  hasSelection: boolean
}

/**
 * The document the editor route should open, or `null` to leave it as it is.
 *
 * Order: the URL's named file, then its topic id, then its document id, then
 * — only when nothing is open — the first file, so the reader lands on
 * something readable instead of an empty pane. A name or id that matches
 * nothing (a deleted file, someone else's link) falls through to that same
 * fallback rather than erroring.
 *
 * This is one function rather than a deep-link rule and a separate fallback
 * because as two React effects they raced: the fallback's closure still saw
 * no selection in the commit where the deep link opened its file, and opened
 * the first file over the top of it.
 */
export function resolveSelection(input: ResolveSelectionInput): ReasonDocsSelection | null {
  const { slug, doc, topic, catalog, applyParams, hasSelection } = input
  const documentIds = catalog.documents.map((item) => item.id)
  const topicIds = catalog.topics.map((item) => item.id)

  if (applyParams) {
    const named = slug ? findDocIdBySlug(slug, slugEntries(catalog)) : null
    if (named) {
      const selection = parseEntryKey(named)
      if (selection) return selection
    }
    if (topic != null && topicIds.includes(topic)) return { kind: "topic", id: topic }
    if (doc != null && documentIds.includes(doc)) return { kind: "document", id: doc }
  }

  if (hasSelection) return null
  const first = documentIds[0]
  return first == null ? null : { kind: "document", id: first }
}

/**
 * Identity of the selection a URL asks for, for deduping repeat
 * applications. Two URLs naming the same file share a key even if their other
 * query parameters differ.
 */
export function selectionParamsKey({ slug, doc, topic }: SelectionParams): string {
  return `slug:${slug ?? ""}|doc:${doc ?? ""}|topic:${topic ?? ""}`
}

/** The address bar, as much of it as {@link canonicalEditorUrl} reads. */
export interface EditorLocation {
  pathname: string
  /** Including the leading `?`, as `window.location.search` gives it. */
  search: string
  /** Including the leading `#`. */
  hash: string
}

/**
 * The URL the open document *should* have, or `null` when the current one
 * already says it.
 *
 * This is what turns a `?doc=12` link — or a link written before the file was
 * renamed — into `/reason-editor/<its name>` once the catalogue has loaded,
 * and what keeps the address bar naming the file the reader switched to. The
 * ids it replaces are dropped from the query; every other parameter is kept,
 * since `?share=` and `?shareWith=` are read by the same page.
 */
export function canonicalEditorUrl(
  selection: ReasonDocsSelection | null,
  catalog: ReasonDocsCatalog,
  location: EditorLocation,
): string | null {
  if (!selection) return null
  // Only ever rewrites the editor's own address. The route sync that calls
  // this mounts on `/reason-editor`, but a caller mounted elsewhere renaming
  // *that* page's URL would be a navigation, not a rename.
  if (!isEditorPathname(location.pathname)) return null
  const slug = editorSlugForSelection(selection, catalog)
  if (!slug) return null
  const params = new URLSearchParams(location.search)
  params.delete("doc")
  params.delete("topic")
  const query = params.toString()
  const next = `${REASON_EDITOR_ROUTE}/${slug}${query ? `?${query}` : ""}${location.hash}`
  const current = `${location.pathname}${location.search}${location.hash}`
  return next === current ? null : next
}

/**
 * `location` with `param` dropped — the URL to leave behind once a
 * one-shot query parameter has been acted on (`?share=<id>` is joined once;
 * a reload must not re-run it).
 *
 * Kept here because the naive version of that is `router.replace(
 * "/reason-editor")`, which now also throws away the document the path names
 * and routes the reader off the file they were reading. Returns `null` when
 * the parameter isn't there to drop.
 */
export function urlWithoutParam(param: string, location: EditorLocation): string | null {
  const params = new URLSearchParams(location.search)
  if (!params.has(param)) return null
  params.delete(param)
  const query = params.toString()
  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`
}
