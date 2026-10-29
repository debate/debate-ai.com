/**
 * @fileoverview Edits to the public Topic Starters catalogue, as data.
 *
 * Anyone signed in can rearrange the catalogue from the docs sidebar — move,
 * rename, delete, add a folder, submit one of their own files, or accept the
 * AI's "organize by argument" plan — but only moderators and admins change
 * the live tree directly. Everyone else's edit is stored as one of these
 * change records and waits in the admin panel's Topic starters queue until a
 * moderator approves it, at which point the server applies exactly the same
 * record a moderator's own edit would have applied.
 *
 * This module is the shared vocabulary for that: the change shapes, the
 * sanitizer the server runs on every body, the one-line summary the queue
 * shows, and the pure planner behind the reorganize change. No I/O, so the
 * client, the routes and the tests all read the same rules.
 *
 * @module lib/topic-starters/changes
 */

/** Longest title a rename, new folder or submission may set. */
export const MAX_TOPIC_TITLE_LENGTH = 200

/**
 * Largest submitted file, in characters of stored content. D1 caps a row at
 * 2 MB, and a pending submission carries the file inside the change row's
 * JSON, so this leaves room for the rest of the record.
 */
export const MAX_SUBMISSION_CONTENT_LENGTH = 1_500_000

/** Most files one reorganize change may re-file. */
export const MAX_REORGANIZE_ASSIGNMENTS = 2000

/** Which side of the resolution a file argues. */
export const ARGUMENT_SIDES = ["aff", "neg"] as const
export type ArgumentSide = (typeof ARGUMENT_SIDES)[number]

/**
 * The argument types the organizer files by. `case` is an affirmative case
 * (plan, advantages); `da`, `cp`, `t` and `k` are the negative's off-case
 * positions; `theory` and `other` catch what fits none of those.
 */
export const ARGUMENT_TYPES = ["case", "da", "cp", "t", "k", "theory", "other"] as const
export type ArgumentType = (typeof ARGUMENT_TYPES)[number]

/** Folder name for each side, as it appears in the tree. */
export const SIDE_FOLDER_NAMES: Record<ArgumentSide, string> = { aff: "Aff", neg: "Neg" }

/** Folder name for each argument type, as it appears in the tree. */
export const TYPE_FOLDER_NAMES: Record<ArgumentType, string> = {
  case: "Case",
  da: "DA",
  cp: "CP",
  t: "T",
  k: "K",
  theory: "Theory",
  other: "Other",
}

/** One file's place in the organized tree: `Aff/Case`, `Neg/DA`, … */
export interface ArgumentAssignment {
  itemId: number
  side: ArgumentSide
  type: ArgumentType
}

export type TopicStarterChange =
  | { kind: "move"; itemId: number; parentId: number | null }
  | { kind: "rename"; itemId: number; title: string }
  | { kind: "delete"; itemId: number }
  | { kind: "create-folder"; title: string; parentId: number | null }
  | { kind: "submit"; title: string; content: string; format: string; parentId: number | null; year: number | null }
  | { kind: "reorganize"; assignments: ArgumentAssignment[] }

export type TopicStarterChangeKind = TopicStarterChange["kind"]

export const TOPIC_STARTER_CHANGE_KINDS: readonly TopicStarterChangeKind[] = [
  "move",
  "rename",
  "delete",
  "create-folder",
  "submit",
  "reorganize",
]

/** Where a change stands in the moderation queue. */
export type TopicStarterChangeStatus = "pending" | "approved" | "rejected"

/** What `POST /api/topic-starters/changes` answers. */
export type ChangeSubmitResponse =
  | { status: "applied" }
  | { status: "pending"; id: number }

/** A stored change, as the admin queue lists it. */
export interface TopicStarterChangeRow {
  id: number
  change: TopicStarterChange
  summary: string
  status: TopicStarterChangeStatus
  submittedBy: string | null
  reviewedBy: string | null
  error: string | null
  createdAt: string
}

function positiveId(value: unknown): number | null {
  const id = typeof value === "string" && value.trim() ? Number(value) : value
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null
}

function parentOf(value: unknown): number | null {
  return positiveId(value)
}

function titleOf(value: unknown): string | null {
  if (typeof value !== "string") return null
  const title = value.replace(/\s+/g, " ").trim().slice(0, MAX_TOPIC_TITLE_LENGTH)
  return title || null
}

/** The competition year a value names, or `null` — mirrors the importer. */
export function parseTopicStarterYear(raw: unknown): number | null {
  if (raw == null) return null
  const year = typeof raw === "number" ? raw : Number(String(raw).trim())
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null
  return year
}

/**
 * Keeps only well-formed assignments: a real id, a known side and type, and
 * the first assignment per file when one is repeated.
 */
export function sanitizeAssignments(input: unknown): ArgumentAssignment[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<number>()
  const out: ArgumentAssignment[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const entry = raw as Record<string, unknown>
    const itemId = positiveId(entry.itemId ?? entry.id)
    const side = typeof entry.side === "string" ? entry.side.toLowerCase() : ""
    const type = typeof entry.type === "string" ? entry.type.toLowerCase() : ""
    if (itemId == null || seen.has(itemId)) continue
    if (!(ARGUMENT_SIDES as readonly string[]).includes(side)) continue
    if (!(ARGUMENT_TYPES as readonly string[]).includes(type)) continue
    seen.add(itemId)
    out.push({ itemId, side: side as ArgumentSide, type: type as ArgumentType })
    if (out.length >= MAX_REORGANIZE_ASSIGNMENTS) break
  }
  return out
}

/**
 * Reads a change out of an untrusted request body, or explains why it can't.
 * Every field is coerced to the shape the server applies, so a stored change
 * never needs re-validating when a moderator approves it later.
 */
export function parseTopicStarterChange(input: unknown): { ok: true; change: TopicStarterChange } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Expected a change object." }
  const raw = input as Record<string, unknown>
  switch (raw.kind) {
    case "move": {
      const itemId = positiveId(raw.itemId)
      if (itemId == null) return { ok: false, error: "Name the item to move." }
      const parentId = parentOf(raw.parentId)
      if (parentId === itemId) return { ok: false, error: "An item cannot be moved into itself." }
      return { ok: true, change: { kind: "move", itemId, parentId } }
    }
    case "rename": {
      const itemId = positiveId(raw.itemId)
      const title = titleOf(raw.title)
      if (itemId == null) return { ok: false, error: "Name the item to rename." }
      if (!title) return { ok: false, error: "A name is required." }
      return { ok: true, change: { kind: "rename", itemId, title } }
    }
    case "delete": {
      const itemId = positiveId(raw.itemId)
      if (itemId == null) return { ok: false, error: "Name the item to delete." }
      return { ok: true, change: { kind: "delete", itemId } }
    }
    case "create-folder": {
      const title = titleOf(raw.title)
      if (!title) return { ok: false, error: "A folder name is required." }
      return { ok: true, change: { kind: "create-folder", title, parentId: parentOf(raw.parentId) } }
    }
    case "submit": {
      const title = titleOf(raw.title)
      if (!title) return { ok: false, error: "A title is required." }
      const content = typeof raw.content === "string" ? raw.content : ""
      if (content.length > MAX_SUBMISSION_CONTENT_LENGTH) {
        return { ok: false, error: "That file is too large to submit to Topic Starters." }
      }
      const format = typeof raw.format === "string" && raw.format.trim() ? raw.format.trim().slice(0, 40) : "html"
      return {
        ok: true,
        change: { kind: "submit", title, content, format, parentId: parentOf(raw.parentId), year: parseTopicStarterYear(raw.year) },
      }
    }
    case "reorganize": {
      const assignments = sanitizeAssignments(raw.assignments)
      if (assignments.length === 0) return { ok: false, error: "The reorganization moves no files." }
      return { ok: true, change: { kind: "reorganize", assignments } }
    }
    default:
      return { ok: false, error: "Unknown change." }
  }
}

/**
 * One line naming what a change does, for the moderation queue and toasts.
 *
 * @param titles - Current titles by id, so a queued move reads "Move
 *   Warming 1AC to Impacts" rather than a pair of numbers. An id that is no
 *   longer in the catalogue reads as `#id`.
 */
export function describeTopicStarterChange(change: TopicStarterChange, titles: ReadonlyMap<number, string> = new Map()): string {
  const name = (id: number | null) => (id == null ? "the top level" : titles.get(id) ?? `#${id}`)
  switch (change.kind) {
    case "move":
      return `Move ${name(change.itemId)} to ${name(change.parentId)}`
    case "rename":
      return `Rename ${name(change.itemId)} to ${change.title}`
    case "delete":
      return `Delete ${name(change.itemId)}`
    case "create-folder":
      return `New folder ${change.title} in ${name(change.parentId)}`
    case "submit":
      return `Add ${change.title} to ${name(change.parentId)}`
    case "reorganize": {
      const counts = new Map<string, number>()
      for (const { side, type } of change.assignments) {
        const label = `${SIDE_FOLDER_NAMES[side]}/${TYPE_FOLDER_NAMES[type]}`
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
      const breakdown = [...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, count]) => `${label} ${count}`)
        .join(", ")
      const files = change.assignments.length
      return `Organize ${files} file${files === 1 ? "" : "s"} by argument (${breakdown})`
    }
  }
}

/** The tree shape the planner reads: a catalogue row without its content. */
export interface TopicTreeRow {
  id: number
  title: string
  parentId: number | null
  isFolder: boolean
}

/** A folder the reorganize plan needs, by its path from the top level. */
export interface PlannedFolder {
  path: [string] | [string, string]
  /** The existing folder with this path, when there is one. */
  existingId: number | null
}

export interface ReorganizePlan {
  /** Every `Side` and `Side/Type` folder the moves land in, sides first. */
  folders: PlannedFolder[]
  /** Each file that changes folder, and the `Side/Type` path it goes to. */
  moves: Array<{ itemId: number; path: [string, string] }>
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Works out the folders and moves that file every assigned file under
 * `Aff/<Type>` or `Neg/<Type>`, reusing a top-level `Aff`/`Neg` folder and
 * the type folders inside it when they already exist (matched by name, any
 * case), so running the organizer twice is a no-op the second time.
 *
 * Only files are moved — folders are never assigned — and a file already in
 * its target folder is left out of `moves`.
 */
export function planReorganize(rows: readonly TopicTreeRow[], assignments: readonly ArgumentAssignment[]): ReorganizePlan {
  const files = new Map(rows.filter((row) => !row.isFolder).map((row) => [row.id, row]))
  const folderRows = rows.filter((row) => row.isFolder)
  const topFolder = (title: string) => folderRows.find((row) => row.parentId == null && sameName(row.title, title)) ?? null
  const childFolder = (parentId: number | null, title: string) =>
    parentId == null ? null : folderRows.find((row) => row.parentId === parentId && sameName(row.title, title)) ?? null

  const folders = new Map<string, PlannedFolder>()
  const moves: ReorganizePlan["moves"] = []
  for (const assignment of assignments) {
    const file = files.get(assignment.itemId)
    if (!file) continue
    const sideName = SIDE_FOLDER_NAMES[assignment.side]
    const typeName = TYPE_FOLDER_NAMES[assignment.type]
    const side = topFolder(sideName)
    const type = childFolder(side?.id ?? null, typeName)
    if (!folders.has(sideName)) folders.set(sideName, { path: [sideName], existingId: side?.id ?? null })
    const typeKey = `${sideName}/${typeName}`
    if (!folders.has(typeKey)) folders.set(typeKey, { path: [sideName, typeName], existingId: type?.id ?? null })
    if (type && file.parentId === type.id) continue
    moves.push({ itemId: file.id, path: [sideName, typeName] })
  }
  const ordered = [...folders.values()].sort((a, b) => a.path.length - b.path.length || a.path.join("/").localeCompare(b.path.join("/")))
  return { folders: ordered, moves }
}

/**
 * Folders that hold no file anywhere beneath them — what a reorganize leaves
 * behind once it has moved every file out. `keep` (the `Aff`/`Neg` tree it
 * just filed into) is never reported, nor is anything above a kept folder.
 */
export function emptyFolders(rows: readonly TopicTreeRow[], keep: ReadonlySet<number>): number[] {
  const children = new Map<number, TopicTreeRow[]>()
  for (const row of rows) {
    if (row.parentId != null) children.set(row.parentId, [...(children.get(row.parentId) ?? []), row])
  }
  const holdsSomething = new Map<number, boolean>()
  const visit = (row: TopicTreeRow, trail: Set<number>): boolean => {
    if (!row.isFolder) return true
    const cached = holdsSomething.get(row.id)
    if (cached !== undefined) return cached
    if (trail.has(row.id)) return false
    trail.add(row.id)
    let result = keep.has(row.id)
    for (const child of children.get(row.id) ?? []) {
      if (visit(child, trail)) result = true
    }
    holdsSomething.set(row.id, result)
    return result
  }
  return rows.filter((row) => row.isFolder && !visit(row, new Set())).map((row) => row.id)
}
