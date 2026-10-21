/**
 * @fileoverview How the sidebar's Files tree orders siblings — the "Sort"
 * half of organising files (folders and moving are the other half, in
 * `components/reason-docs/file-manager/FileTree`).
 *
 * Folders always come before files whatever the order, the same as the SVAR
 * file manager and every desktop file browser, so switching the sort never
 * buries a folder among its files.
 *
 * @module lib/reason-docs/file-sort
 */

export const FILE_SORTS = ["name", "name-desc", "updated"] as const
export type FileSort = (typeof FILE_SORTS)[number]

export const FILE_SORT_LABELS: Record<FileSort, string> = {
  name: "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  updated: "Last modified",
}

export function isFileSort(value: unknown): value is FileSort {
  return typeof value === "string" && (FILE_SORTS as readonly string[]).includes(value)
}

/** Epoch ms for a row's `updatedAt` — an ISO string, epoch seconds or epoch
 *  ms depending on where the row came from; `0` when it can't be read. */
export function updatedAtMs(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

interface SortableRow {
  title: string
  isFolder: boolean
  updatedAt?: string | number | null
}

/** A comparator for one folder's children under `sort`. */
export function compareRows(sort: FileSort): (a: SortableRow, b: SortableRow) => number {
  return (a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    const byName = a.title.localeCompare(b.title, undefined, { numeric: true })
    if (sort === "name-desc") return -byName
    if (sort === "updated") return updatedAtMs(b.updatedAt) - updatedAtMs(a.updatedAt) || byName
    return byName
  }
}
