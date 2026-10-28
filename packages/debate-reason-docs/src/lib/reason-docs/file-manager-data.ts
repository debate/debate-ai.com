/**
 * @fileoverview The sidebar's files as the SVAR file manager sees them.
 *
 * SVAR's `Filemanager` (`@svar-ui/react-filemanager`, the same widget quick
 * search's REASON sidebar opens from its `FileManagerModal`) identifies every
 * row by a path — `"/Energy/Solar Aff"` — and reads the row's name and parent
 * folder back out of that path. This app identifies rows by numeric id under a
 * `parentId`. This module is the translation both ways:
 *
 *  - {@link buildFileManagerData} turns the reader's documents, plus the public
 *    Topic Starters under one read-only {@link TOPIC_ROOT} folder, into SVAR
 *    entities, and returns a `refs` map so an action SVAR reports by path
 *    (open, rename, move, delete…) can be routed back to the row it names.
 *  - Names that would break a path are made safe: `/` is replaced, and two
 *    siblings with the same title get `" (2)"`, `" (3)"`… so neither shadows
 *    the other — SVAR would otherwise silently merge them into one row.
 *
 * Pure on purpose, with unit tests; `components/reason-docs/file-manager/FileManagerDialog`
 * is the thin component over it.
 *
 * @module lib/reason-docs/file-manager-data
 */

/** The rows the two sidebar areas hold — a `ReasonDocument` and a
 *  `TopicStarterItem` both satisfy it. */
export interface FileManagerSourceItem {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
  content?: string
  updatedAt?: string | number
  /** The competition year a topic starter belongs to, when it has one. */
  year?: number | null
}

/** Which area a file-manager path points into. */
export interface FileManagerRef {
  kind: "document" | "topic"
  id: number
  isFolder: boolean
}

/** One SVAR row. `id` is the path; SVAR derives the name and parent from it. */
export interface FileManagerEntity {
  id: string
  type: "file" | "folder"
  size?: number
  date?: Date
}

/** The folder the public Topic Starters are shown under. Read-only there:
 *  they are copied out, never renamed or deleted from the file manager. */
export const TOPIC_ROOT = "/Topic Starters"

/** A title as a single path segment. */
function segmentOf(title: string): string {
  const cleaned = (title || "Untitled").replace(/[\\/]/g, "-").trim()
  return cleaned || "Untitled"
}

/** `"Name"`, `"Name (2)"`, … — the first one not already in `taken`. */
function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

function dateOf(value: string | number | undefined): Date | undefined {
  if (value == null || value === "") return undefined
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Walks one area's rows from `root`, folders before files, assigning each row
 * a unique path. A row whose parent isn't in the list (the public catalogue is
 * capped, so a file can arrive without its folder) is placed at the root
 * rather than dropped.
 */
function addArea(
  items: readonly FileManagerSourceItem[],
  kind: FileManagerRef["kind"],
  root: string,
  taken: Set<string>,
  data: FileManagerEntity[],
  refs: Map<string, FileManagerRef>,
): void {
  const ids = new Set(items.map((item) => item.id))
  const children = new Map<number | null, FileManagerSourceItem[]>()
  for (const item of items) {
    const parent = item.parentId != null && ids.has(item.parentId) && item.parentId !== item.id ? item.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), item])
  }
  const seen = new Set<number>()
  const walk = (parentId: number | null, parentPath: string, siblingsTaken: Set<string>) => {
    const rows = [...(children.get(parentId) ?? [])].sort(
      (a, b) => Number(b.isFolder) - Number(a.isFolder) || a.title.localeCompare(b.title),
    )
    for (const item of rows) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      const name = uniqueName(segmentOf(item.title), siblingsTaken)
      siblingsTaken.add(name.toLowerCase())
      const path = `${parentPath === "/" ? "" : parentPath}/${name}`
      data.push({
        id: path,
        type: item.isFolder ? "folder" : "file",
        ...(item.isFolder ? {} : { size: item.content?.length ?? 0 }),
        date: dateOf(item.updatedAt),
      })
      refs.set(path, { kind, id: item.id, isFolder: item.isFolder })
      if (item.isFolder) walk(item.id, path, new Set())
    }
  }
  walk(null, root, taken)
}

/** SVAR's rows for both areas, and the path → row map to route actions back. */
export function buildFileManagerData(
  documents: readonly FileManagerSourceItem[],
  topics: readonly FileManagerSourceItem[] = [],
): { data: FileManagerEntity[]; refs: Map<string, FileManagerRef> } {
  const data: FileManagerEntity[] = []
  const refs = new Map<string, FileManagerRef>()
  // The Topic Starters folder claims its name first, so a reader's own
  // top-level folder called "Topic Starters" becomes "Topic Starters (2)".
  const rootTaken = new Set<string>()
  if (topics.length > 0) {
    rootTaken.add(TOPIC_ROOT.slice(1).toLowerCase())
    data.push({ id: TOPIC_ROOT, type: "folder" })
  }
  addArea(documents, "document", "/", rootTaken, data, refs)
  if (topics.length > 0) addArea(topics, "topic", TOPIC_ROOT, new Set(), data, refs)
  return { data, refs }
}

/** True for the Topic Starters folder itself and everything under it. */
export function isTopicPath(path: string): boolean {
  return path === TOPIC_ROOT || path.startsWith(`${TOPIC_ROOT}/`)
}

/**
 * The owned folder a file-manager path names, as a `parentId`: `null` for
 * the root (SVAR's `"/"`), the folder's id for one of the reader's folders,
 * and `undefined` for anything that can't hold the reader's files — a file,
 * an unknown path, or the read-only Topic Starters area.
 */
export function ownedFolderIdOf(path: string, refs: ReadonlyMap<string, FileManagerRef>): number | null | undefined {
  if (!path || path === "/" || path === "0") return null
  const ref = refs.get(path)
  if (!ref || ref.kind !== "document" || !ref.isFolder) return undefined
  return ref.id
}
