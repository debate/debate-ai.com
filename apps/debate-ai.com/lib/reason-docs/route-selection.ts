/**
 * @fileoverview The URL half of "click a file in any sidebar, get that file
 * in CardMirror".
 *
 * A selection made in the docs sidebar (`components/reason-docs`) is carried
 * to `/reason-editor` in the query string rather than only in
 * `ReasonDocsProvider` state. Provider state covers a client-side hop; the URL
 * is what also covers a reload, a pasted link, and a hard navigation out of
 * `/videos`, which renders its own layout branch and so can boot the editor
 * with an empty provider.
 *
 * The query names the file by **filename**, not row id — `?doc=impacts/warming-1ac`
 * for one of the reader's own files, `?topic=core/topic-starter` for a public
 * one. `./doc-path` owns how a name becomes a path and how a path is read back;
 * old numeric links keep working because it resolves those too.
 *
 * The path form of that same name — `/reason-editor/impacts-warming-1ac`,
 * which `app/reason-editor/[slug]` serves — is read back by
 * {@link parseSelectionParams} as the `doc` ref it is. One naming scheme, two
 * spellings; nothing resolves a path differently from a query, and
 * {@link canonicalEditorUrl} writes the query form.
 *
 * A URL that names nothing the reader has loaded is not an error: a public file
 * lives in a catalogue this reader may never have fetched (and may not be
 * signed in for at all), so resolution can come back asking for a server
 * lookup — {@link resolveSelection}'s `lookup` outcome, which
 * `ReasonDocsRouteSync` answers with `/api/topic-starters/by-path`. That is
 * what makes a filename URL work for anyone whenever the file is public.
 *
 * Both ends of the round trip live here so they cannot drift: the sidebar
 * builds the href with {@link editorHrefForSelection}, and the editor route's
 * `ReasonDocsRouteSync` reads it back with {@link parseSelectionParams} and
 * {@link resolveSelection}. Pure on purpose — the components stay thin
 * wrappers over functions with unit tests.
 *
 * @module lib/reason-docs/route-selection
 */

import { findItemByRef, itemPath, type PathItem } from "./doc-path"

export const REASON_EDITOR_ROUTE = "/reason-editor"

/** A document the editor can show: an owned document, or a read-only public
 *  topic starter. Both are addressed by name, in separate query parameters. */
export type ReasonDocsSelection =
  | { kind: "document"; id: number }
  | { kind: "topic"; id: number }

/** Which query parameter a selection travels in. */
export function paramForKind(kind: ReasonDocsSelection["kind"]): "doc" | "topic" {
  return kind === "document" ? "doc" : "topic"
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
 * The editor URL that reopens `selection` from cold.
 *
 * `items` is the tree the selection came from, which is what turns a row into
 * a path. Without it (or when the row has no sluggable name) the link falls
 * back to the id — still a working URL, just not a readable one.
 */
export function editorHrefForSelection(
  selection: ReasonDocsSelection,
  items: readonly PathItem[] = [],
): string {
  const path = itemPath(items, selection.id)
  const ref = path && path.length > 0 ? path : String(selection.id)
  // Segment-wise: the slashes are the path's own structure, and encoding them
  // would turn `a/b` into a single unreadable segment.
  const encoded = ref.split("/").map(encodeURIComponent).join("/")
  return `${REASON_EDITOR_ROUTE}?${paramForKind(selection.kind)}=${encoded}`
}

/** The refs a `/reason-editor` URL can carry — a filename path or, on links
 *  minted before paths, a row id. */
export interface SelectionParams {
  doc: string | null
  topic: string | null
}

/**
 * Reads {@link SelectionParams} off a pathname and anything with
 * `URLSearchParams`'s getter (Next's `useSearchParams` returns a readonly
 * wrapper, not the class).
 *
 * `/reason-editor/<name>` and `?doc=<name>` are the same statement about which
 * file to open — the path form is what `app/reason-editor/[slug]` serves, the
 * query form is what the sidebar links to and what {@link canonicalEditorUrl}
 * rewrites the address to — so the path segment reads back as a `doc` ref and
 * resolves through the very same `findItemByRef` lookup. An explicit `?doc=`
 * wins, since that is the link the reader actually followed.
 */
export function parseSelectionParams(
  params: { get: (key: string) => string | null },
  pathname?: string | null,
): SelectionParams {
  const read = (key: string) => params.get(key)?.trim() || null
  return { doc: read("doc") ?? editorSlugFromPathname(pathname), topic: read("topic") }
}

/** What {@link resolveSelection} is deciding over. */
export interface ResolveSelectionInput extends SelectionParams {
  /** The reader's own rows, folders included — folders are what makes a
   *  nested path resolvable, even though one is never opened directly. */
  documents: readonly PathItem[]
  /** The public topic starters this client has loaded. Capped by the
   *  catalogue route, hence the `lookup` outcome for everything past it. */
  topics: readonly PathItem[]
  /**
   * False once this URL's selection has already been applied, so a reader who
   * then picks a different file from the sidebar isn't dragged back to the
   * one named in the URL.
   */
  applyParams: boolean
  /** Whether something is already open in the editor. */
  hasSelection: boolean
  /**
   * False once the server lookup for this URL has been tried and come back
   * empty, so an unresolvable link falls through to the normal fallback
   * instead of asking again forever.
   */
  allowLookup?: boolean
}

/**
 * What the editor route should open, or `null` to leave it as it is.
 *
 * Order: the URL's topic ref, then its document ref (against the reader's own
 * tree and then the public one, since a shared link names a file, not a
 * table), then a server lookup for a ref that matched neither — the file may
 * be public and simply not loaded here — and then, only when nothing is open,
 * the first file, so the reader lands on something readable instead of an
 * empty pane.
 *
 * This is one function rather than a deep-link rule and a separate fallback
 * because as two React effects they raced: the fallback's closure still saw
 * no selection in the commit where the deep link opened its file, and opened
 * the first file over the top of it.
 */
export type SelectionOutcome =
  | ReasonDocsSelection
  /** Not in anything loaded here — ask the public catalogue for this name. */
  | { kind: "lookup"; ref: string }

export function resolveSelection(input: ResolveSelectionInput): SelectionOutcome | null {
  const { doc, topic, documents, topics, applyParams, hasSelection, allowLookup = true } = input

  if (applyParams) {
    if (topic) {
      const match = findItemByRef(topics, topic)
      if (match) return { kind: "topic", id: match.id }
    }
    if (doc) {
      const match = findItemByRef(documents, doc)
      if (match) return { kind: "document", id: match.id }
      // A name is a name: `?doc=` is where a shared link most often ends up,
      // and the file it points at may be a public one rather than one of this
      // reader's. Falling through to the public tree is what lets the same URL
      // work for the person who has the file and the person who doesn't.
      const publicMatch = findItemByRef(topics, doc)
      if (publicMatch) return { kind: "topic", id: publicMatch.id }
    }
    // A name this client can't place is most often a public file it never
    // fetched — the catalogue is capped, and a signed-out reader following a
    // shared link has no documents at all. Ask the server before giving up.
    const unresolved = topic ?? doc
    if (allowLookup && unresolved) return { kind: "lookup", ref: unresolved }
  }

  if (hasSelection) return null
  const first = documents.find((item) => !item.isFolder)
  return first ? { kind: "document", id: first.id } : null
}

/**
 * Identity of the selection a URL asks for, for deduping repeat
 * applications. Two URLs naming the same file share a key even if their other
 * query parameters differ.
 */
export function selectionParamsKey({ doc, topic }: SelectionParams): string {
  return `doc:${doc ?? ""}|topic:${topic ?? ""}`
}

/** The address bar, as much of it as {@link canonicalEditorUrl} reads. */
export interface EditorLocation {
  pathname: string
  /** Including the leading `?`, as `window.location.search` gives it. */
  search: string
  /** Including the leading `#`. */
  hash: string
}

/** The trees {@link canonicalEditorUrl} names a selection against — the
 *  reader's own documents and the public topic starters, folders included
 *  (folders are what makes a nested path resolvable, same as
 *  {@link editorHrefForSelection}'s `items`). */
export interface ReasonDocsCatalog {
  documents: readonly PathItem[]
  topics: readonly PathItem[]
}

/**
 * The URL the open document *should* have, or `null` when the current one
 * already says it.
 *
 * This is what turns a `?doc=12` link — or a link written before the file was
 * renamed — into `?doc=<its name>` once the catalogue has loaded, and what
 * keeps the address bar naming the file the reader switched to. The ids it
 * replaces are dropped from the query; every other parameter is kept, since
 * `?share=` and `?shareWith=` are read by the same page.
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
  const items = selection.kind === "topic" ? catalog.topics : catalog.documents
  const path = itemPath(items, selection.id)
  if (!path) return null
  const params = new URLSearchParams(location.search)
  params.delete("doc")
  params.delete("topic")
  const rest = params.toString()
  // Segment-wise, like `editorHrefForSelection` — `URLSearchParams` would
  // percent-encode the path's own slashes into an unreadable `%2F`.
  const encoded = path.split("/").map(encodeURIComponent).join("/")
  const query = `${paramForKind(selection.kind)}=${encoded}${rest ? `&${rest}` : ""}`
  const next = `${REASON_EDITOR_ROUTE}?${query}${location.hash}`
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
