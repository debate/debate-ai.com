/**
 * @fileoverview Filename paths for the files the editor opens — the thing a
 * `/reason-editor` URL names.
 *
 * A link used to carry a row id (`?doc=34`), which is unreadable, unguessable
 * and meaningless to anyone but this database. It now carries the file's own
 * name, folders included — `?doc=impacts/warming-1ac` — built here and read
 * back here so the two halves cannot drift.
 *
 * Three properties this module owes its callers:
 *
 *  - **Stable.** The slug comes from the title alone, with the file extension
 *    dropped, so the `.docx` a reader uploaded and the `.cmir` it is stored as
 *    address the same file.
 *  - **Unique.** Two files can share a name; two URLs cannot. Duplicates are
 *    disambiguated by row id, in a fixed order, so a given file keeps the same
 *    path for as long as it and its neighbours keep their names.
 *  - **Forgiving.** A URL that names only the file (`?doc=warming-1ac`), or a
 *    folder, or an old numeric id, still opens something sensible. A link
 *    someone pastes is a claim about a file, not an exact database key.
 *
 * Pure and table-agnostic: the reader's own `documents` and the public
 * `topic_starter_items` are both trees of `{ id, title, parentId, isFolder }`,
 * and the public lookup route resolves a path against the latter with the same
 * function the sidebar builds its links with.
 *
 * @module lib/reason-docs/doc-path
 */

/** The subset of a row this module needs — shared by both file tables. */
export interface PathItem {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
}

/** Extensions dropped before slugging, so `1AC.docx` and the `.cmir` it is
 *  stored as land on the same URL. */
const STRIPPED_EXTENSIONS = /\.(docx?|cmir|html?|md|txt|rtf|odt)$/i

/** How deep a path may nest, and how long one segment may get. Caps a pasted
 *  URL's work rather than any real file's shape. */
const MAX_SEGMENTS = 24
const MAX_SEGMENT_LENGTH = 120

/**
 * One file or folder name as a URL segment: `"Impacts — Warming 1AC.docx"` →
 * `"impacts-warming-1ac"`.
 *
 * Accents are folded rather than dropped (`Réchauffement` → `rechauffement`)
 * so a non-English filename produces a readable slug instead of a row of
 * dashes. A name with nothing sluggable left in it (`"???"`, an emoji-only
 * title) returns `""`, and callers fall back to the row id.
 */
export function slugifySegment(name: string): string {
  return name
    .replace(STRIPPED_EXTENSIONS, "")
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SEGMENT_LENGTH)
    .replace(/-+$/g, "")
}

/** Walks a row up to the root, outermost folder first. Cycles (a folder
 *  re-parented into its own subtree by a bad write) terminate rather than
 *  hang. */
function ancestry(item: PathItem, byId: Map<number, PathItem>): PathItem[] {
  const chain: PathItem[] = [item]
  const seen = new Set<number>([item.id])
  let current = item
  while (current.parentId != null) {
    const parent = byId.get(current.parentId)
    if (!parent || seen.has(parent.id)) break
    seen.add(parent.id)
    chain.unshift(parent)
    current = parent
  }
  return chain
}

/**
 * The path for every row in `items`, keyed by id.
 *
 * Two files that slug the same — same name in the same folder, or a title
 * with no sluggable characters — are disambiguated by appending the row id to
 * all but the lowest-numbered one. The id tiebreak (rather than list order)
 * is what keeps a link working when the sidebar's sort changes underneath it.
 */
export function buildPathMap(items: readonly PathItem[]): Map<number, string> {
  const byId = new Map(items.map((item) => [item.id, item]))
  const paths = new Map<number, string>()
  const taken = new Map<string, number>()

  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    const segments = ancestry(item, byId).map((step) => slugifySegment(step.title) || `f${step.id}`)
    const base = segments.slice(-MAX_SEGMENTS).join("/")
    const owner = taken.get(base)
    const path = owner === undefined ? base : `${base}-${item.id}`
    if (owner === undefined) taken.set(base, item.id)
    paths.set(item.id, path)
  }
  return paths
}

/** The path for one row, as {@link buildPathMap} assigns it. */
export function itemPath(items: readonly PathItem[], id: number): string | null {
  return buildPathMap(items).get(id) ?? null
}

/** Splits a raw `?doc=` value into slugged segments. Tolerates a leading or
 *  trailing slash, percent-encoding, and a title pasted in verbatim. */
export function parsePathRef(ref: string): string[] {
  let decoded = ref
  try {
    decoded = decodeURIComponent(ref)
  } catch {
    // A malformed escape sequence: read the ref as the literal text it is.
  }
  return decoded
    .split("/")
    .map((segment) => slugifySegment(segment))
    .filter(Boolean)
    .slice(0, MAX_SEGMENTS)
}

/** `"34"` → `34`. Anything else — a slug, a float, an empty string — is not
 *  an id. Keeps links minted before paths working. */
export function parseNumericRef(ref: string): number | null {
  if (!/^\d+$/.test(ref.trim())) return null
  const id = Number(ref.trim())
  return Number.isSafeInteger(id) ? id : null
}

/** Files first by name, then folders — the order a folder ref opens "the
 *  first file in here" by, and a stable one across renders. */
function sortForOpen(items: readonly PathItem[]): PathItem[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id)
}

/**
 * The file a `?doc=`/`?topic=` value names, or `null`.
 *
 * Tried in order, most specific first:
 *
 *  1. A row id, for links minted before paths.
 *  2. The exact full path (`impacts/warming-1ac`).
 *  3. A trailing part of a path (`warming-1ac`), when exactly one file ends
 *     that way — the common case for a link typed by hand, and ambiguity here
 *     means the reader gets the fallback rather than a coin flip.
 *  4. A folder, by either of the two rules above, which opens the first file
 *     inside it (recursively) so a folder link lands on something readable.
 */
export function findItemByRef(items: readonly PathItem[], ref: string): PathItem | null {
  if (!ref.trim()) return null
  const byId = new Map(items.map((item) => [item.id, item]))

  const numeric = parseNumericRef(ref)
  const direct = numeric == null ? undefined : byId.get(numeric)
  if (direct) return direct.isFolder ? firstFileIn(items, direct.id) : direct

  const segments = parsePathRef(ref)
  if (segments.length === 0) return null
  const wanted = segments.join("/")

  const paths = buildPathMap(items)
  const matches = (predicate: (path: string) => boolean, folders: boolean) =>
    items.filter((item) => item.isFolder === folders && predicate(paths.get(item.id) ?? ""))

  const exactFile = matches((path) => path === wanted, false)
  if (exactFile.length === 1) return exactFile[0]!

  const suffixFile = matches((path) => path === wanted || path.endsWith(`/${wanted}`), false)
  if (suffixFile.length === 1) return suffixFile[0]!

  const folder =
    matches((path) => path === wanted, true)[0] ??
    matches((path) => path.endsWith(`/${wanted}`), true)[0]
  return folder ? firstFileIn(items, folder.id) : null
}

/** The first file inside a folder, descending into subfolders in the same
 *  order the sidebar shows them. `null` for an empty folder. */
export function firstFileIn(items: readonly PathItem[], folderId: number): PathItem | null {
  const children = sortForOpen(items.filter((item) => item.parentId === folderId))
  for (const child of children) {
    if (!child.isFolder) return child
  }
  for (const child of children) {
    const nested = firstFileIn(items, child.id)
    if (nested) return nested
  }
  return null
}
