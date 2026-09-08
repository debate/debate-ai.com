/**
 * @fileoverview The URL half of "click a file, get that file in CardMirror".
 *
 * A selection made in the docs sidebar (`components/reason-docs`) is carried
 * to `/reason-editor` in the query string — `?doc=<id>` for one of the
 * reader's own documents, `?topic=<id>` for a public topic starter — rather
 * than only in `ReasonDocsProvider` state. Provider state covers a
 * client-side hop; the URL is what also covers a reload, a pasted link, and a
 * hard navigation out of `/videos`, which renders its own layout branch and
 * so can boot the editor with an empty provider.
 *
 * Both ends of that round trip live here so they cannot drift: the sidebar
 * builds the href with {@link editorHrefForSelection}, and the editor route's
 * `ReasonDocsRouteSync` reads it back with {@link parseSelectionParams} and
 * {@link resolveSelection}. Pure on purpose — the components stay thin
 * wrappers over functions with unit tests.
 *
 * @module lib/reason-docs/route-selection
 */

export const REASON_EDITOR_ROUTE = "/reason-editor"

/** A document the editor can show: an owned document, or a read-only public
 *  topic starter. Both are addressed by id, in separate namespaces. */
export type ReasonDocsSelection =
  | { kind: "document"; id: number }
  | { kind: "topic"; id: number }

/** The editor URL that reopens `selection` from cold. */
export function editorHrefForSelection(selection: ReasonDocsSelection): string {
  const key = selection.kind === "document" ? "doc" : "topic"
  return `${REASON_EDITOR_ROUTE}?${key}=${selection.id}`
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

/** Both ids a `/reason-editor` URL can carry. */
export interface SelectionParams {
  doc: number | null
  topic: number | null
}

/** Reads {@link SelectionParams} off anything with `URLSearchParams`'s getter
 *  (Next's `useSearchParams` returns a readonly wrapper, not the class). */
export function parseSelectionParams(params: { get: (key: string) => string | null }): SelectionParams {
  return { doc: parseSelectionId(params.get("doc")), topic: parseSelectionId(params.get("topic")) }
}

/** What {@link resolveSelection} is deciding over. */
export interface ResolveSelectionInput extends SelectionParams {
  /** Ids of the reader's own non-folder documents, in sidebar order. */
  documentIds: readonly number[]
  /** Ids of the public topic starters that are files, not folders. */
  topicIds: readonly number[]
  /**
   * False once this URL's selection has already been applied, so a reader who
   * then picks a different file from the sidebar isn't dragged back to the
   * one named in the query.
   */
  applyParams: boolean
  /** Whether something is already open in the editor. */
  hasSelection: boolean
}

/**
 * The document the editor route should open, or `null` to leave it as it is.
 *
 * Order: the URL's topic id, then its document id, then — only when nothing
 * is open — the first file, so the reader lands on something readable instead
 * of an empty pane. An id that matches nothing (a deleted file, someone
 * else's link) falls through to that same fallback rather than erroring.
 *
 * This is one function rather than a deep-link rule and a separate fallback
 * because as two React effects they raced: the fallback's closure still saw
 * no selection in the commit where the deep link opened its file, and opened
 * the first file over the top of it.
 */
export function resolveSelection(input: ResolveSelectionInput): ReasonDocsSelection | null {
  const { doc, topic, documentIds, topicIds, applyParams, hasSelection } = input

  if (applyParams) {
    if (topic != null && topicIds.includes(topic)) return { kind: "topic", id: topic }
    if (doc != null && documentIds.includes(doc)) return { kind: "document", id: doc }
  }

  if (hasSelection) return null
  const first = documentIds[0]
  return first == null ? null : { kind: "document", id: first }
}

/**
 * Identity of the selection a URL asks for, for deduping repeat applications.
 * Two URLs naming the same file share a key even if their other query
 * parameters differ.
 */
export function selectionParamsKey({ doc, topic }: SelectionParams): string {
  return `doc:${doc ?? ""}|topic:${topic ?? ""}`
}
