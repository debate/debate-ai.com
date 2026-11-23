/**
 * Where a REASON file may live in the file tree — the checks behind
 * `POST /api/doc/documents` and `PUT /api/doc/documents/:id` when a request
 * names a `parentId`, and the drop rule the sidebar's `FileTree` uses.
 *
 * The tree is built top-down from `parentId === null` (`FileTree`'s
 * `buildTree`), so a row whose parent is missing, belongs to someone else,
 * is a plain file, or is the row itself or one of its own sub-folders is
 * never reached: the file is still in the account but drops out of the
 * sidebar for good. The sidebar already refuses those moves; these checks
 * make the server refuse them too, so a stale tab or another client can't
 * write one.
 */

/** The fields of a `documents` row these checks read. */
export interface DocumentTreeRow {
  id: number
  parentId: number | null
  isFolder: boolean
  userId: string | null
}

/** A request body's editable fields, after type checks. */
export interface DocumentPatchFields {
  title?: string
  content?: string
  parentId?: number | null
}

export type ParsedDocumentPatch = { ok: true; patch: DocumentPatchFields } | { ok: false; error: string }

export type ParentCheck = { ok: true } | { ok: false; error: string }

/** How far up the tree {@link checkDocumentParent} walks before giving up —
 *  far deeper than any real folder nesting, and a stop for a cycle that is
 *  already in the data. */
export const MAX_FOLDER_DEPTH = 256

export const PARENT_ERRORS = {
  invalid: "The folder id must be a whole number or null.",
  missing: "That folder no longer exists.",
  notFolder: "Files can only be moved into a folder.",
  ownSubtree: "A folder can't be moved into itself or one of its own folders.",
  unreachable: "That folder can't be reached from the top of your files.",
} as const

/**
 * True if `targetId` is `id` itself or sits somewhere inside `id` — dropping
 * `id` into `targetId` would then cut it off from the tree. Stops on a
 * repeated row, so a cycle already in `rows` can't loop forever.
 */
export function isSelfOrDescendant(
  rows: readonly Pick<DocumentTreeRow, "id" | "parentId">[],
  id: number,
  targetId: number,
): boolean {
  if (id === targetId) return true
  const byId = new Map(rows.map((d) => [d.id, d]))
  let cur = byId.get(targetId)
  const seen = new Set<number>()
  while (cur?.parentId != null && !seen.has(cur.id)) {
    if (cur.parentId === id) return true
    seen.add(cur.id)
    cur = byId.get(cur.parentId)
  }
  return false
}

/**
 * Type-checks the editable fields of a document request body. A field that
 * is absent stays absent; one of the wrong type is an error rather than a
 * crash further in (a numeric `title` used to throw on `.trim()`).
 */
export function parseDocumentPatch(body: unknown): ParsedDocumentPatch {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "The request body must be a JSON object." }
  }
  const { title, content, parentId } = body as Record<string, unknown>
  const patch: DocumentPatchFields = {}
  if (title !== undefined) {
    if (typeof title !== "string") return { ok: false, error: "\"title\" must be a string." }
    patch.title = title
  }
  if (content !== undefined) {
    if (typeof content !== "string") return { ok: false, error: "\"content\" must be a string." }
    patch.content = content
  }
  if (parentId !== undefined) {
    if (parentId !== null && !Number.isSafeInteger(parentId)) return { ok: false, error: PARENT_ERRORS.invalid }
    patch.parentId = parentId as number | null
  }
  return { ok: true, patch }
}

/**
 * Whether a file owned by `ownerId` may sit under `parentId`. `id` is the
 * file being moved, or omitted for one being created (which has no subtree
 * yet). `load` reads one row by id — the route passes a D1 lookup, tests a
 * map — and is called once per folder on the way up.
 *
 * A folder that belongs to someone else reads as missing rather than
 * forbidden, so the answer doesn't confirm that another user's id exists.
 */
export async function checkDocumentParent(
  target: { id?: number; parentId: number | null; ownerId: string | null },
  load: (id: number) => Promise<DocumentTreeRow | null | undefined>,
): Promise<ParentCheck> {
  const { id, parentId, ownerId } = target
  if (parentId === null) return { ok: true }
  if (!Number.isSafeInteger(parentId)) return { ok: false, error: PARENT_ERRORS.invalid }
  if (id !== undefined && parentId === id) return { ok: false, error: PARENT_ERRORS.ownSubtree }

  const parent = await load(parentId)
  if (!parent || (parent.userId ?? null) !== ownerId) return { ok: false, error: PARENT_ERRORS.missing }
  if (!parent.isFolder) return { ok: false, error: PARENT_ERRORS.notFolder }
  if (id === undefined) return { ok: true }

  // Walk up from the new parent: meeting the moved row means the move would
  // put it inside its own subtree.
  const seen = new Set<number>([parent.id])
  let next = parent.parentId
  for (let depth = 0; next != null; depth++) {
    if (next === id) return { ok: false, error: PARENT_ERRORS.ownSubtree }
    if (seen.has(next) || depth >= MAX_FOLDER_DEPTH) return { ok: false, error: PARENT_ERRORS.unreachable }
    seen.add(next)
    const row = await load(next)
    if (!row) break
    next = row.parentId
  }
  return { ok: true }
}
