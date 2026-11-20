/**
 * @fileoverview The file after the open one, for the card editor's read-aloud
 * "Keep reading the next files" (`READ_NEXT_FILE_EVENT` from
 * `@debate-ai/editor/read-voice`): when the whole document has been read, the
 * editor screen opens this file and the reader carries on there.
 *
 * "After" is the order the file tree reads top to bottom: each folder's
 * children by name (numbers in names compared as numbers), a folder's files
 * read where the folder sits. Folders themselves are never returned.
 *
 * @module lib/reason-docs/next-file
 */

import type { PathItem } from "./doc-path"

type TreeItem = Pick<PathItem, "id" | "title" | "parentId" | "isFolder">

const byName = (a: TreeItem, b: TreeItem) =>
  a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }) || a.id - b.id

/** Every file, in tree order (see the module doc). Rows whose folder is missing sit at the top level. */
export function filesInTreeOrder<T extends TreeItem>(items: readonly T[]): T[] {
  const ids = new Set(items.map((item) => item.id))
  const children = new Map<number | null, T[]>()
  for (const item of items) {
    const parent = item.parentId != null && ids.has(item.parentId) ? item.parentId : null
    const list = children.get(parent) ?? []
    list.push(item)
    children.set(parent, list)
  }
  const out: T[] = []
  const seen = new Set<number>()
  const walk = (parent: number | null) => {
    for (const item of [...(children.get(parent) ?? [])].sort(byName)) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      if (item.isFolder) walk(item.id)
      else out.push(item)
    }
  }
  walk(null)
  return out
}

/** The file after `activeId` in tree order, or null when it is the last (or isn't a file here). */
export function nextFileAfter<T extends TreeItem>(items: readonly T[], activeId: number | null): T | null {
  if (activeId == null) return null
  const files = filesInTreeOrder(items)
  const index = files.findIndex((file) => file.id === activeId)
  return index >= 0 ? files[index + 1] ?? null : null
}
