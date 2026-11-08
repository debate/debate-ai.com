/**
 * @fileoverview Size statistics for a stored Debate Editor file: how many
 * quotes (evidence cards) and blocks it holds, how many characters of text,
 * and roughly how many pages that prints to.
 *
 * Both tables that hold editor files — the reader's own `documents` and the
 * public `topic_starter_items` — keep these four numbers in their own
 * columns (`quote_count`, `block_count`, `page_count`, `char_count`), written
 * whenever a file's content is saved or imported, and backfilled for older
 * rows by the admin "Count file stats" button and the daily cron. The file
 * indexes (`lib/my-files/file-index.ts`, `lib/topic-starters/file-index.ts`)
 * carry them, so the docs sidebar can show them on hover without loading a
 * single file's content.
 *
 * Kept free of the editor engine: a stored `.cmir` is gzipped JSON of a
 * ProseMirror doc, so counting its nodes needs only `DecompressionStream`
 * and a tree walk — cheap enough for a Worker request, and the same code
 * runs in the browser and under the test runner.
 *
 * @module lib/file-stats/file-stats
 */

import type { StoredContent } from "../debate-editor/format"
import { isCmirContent } from "../debate-editor/content-format"

/** The four numbers kept for every stored file. */
export interface FileStats {
  /** Evidence cards (`card` nodes; in legacy HTML, card tags). */
  quoteCount: number
  /** Blocks (`block` nodes — Verbatim's heading 3). */
  blockCount: number
  /** Estimated printed pages, from the character count. */
  pageCount: number
  /** Characters of text in the whole file, spaces included. */
  charCount: number
}

/** Characters on one printed page of a typical Verbatim file — cards are
 *  set small, so a page holds more than a page of plain prose. */
export const CHARS_PER_PAGE = 3000

/** Estimated pages for a character count: at least one for any text. */
export function estimatePages(charCount: number): number {
  return charCount > 0 ? Math.max(1, Math.ceil(charCount / CHARS_PER_PAGE)) : 0
}

/** Stats with every count at zero — a folder, or an empty file. */
export const EMPTY_FILE_STATS: FileStats = Object.freeze({ quoteCount: 0, blockCount: 0, pageCount: 0, charCount: 0 })

interface JsonNode {
  type?: unknown
  text?: unknown
  content?: unknown
}

/** Counts cards, blocks and text in ProseMirror doc JSON. Never throws. */
export function statsFromDocJson(doc: unknown): FileStats {
  let quoteCount = 0
  let blockCount = 0
  let charCount = 0
  const stack: unknown[] = [doc]
  while (stack.length > 0) {
    const node = stack.pop() as JsonNode | null
    if (!node || typeof node !== "object") continue
    if (node.type === "card") quoteCount++
    else if (node.type === "block") blockCount++
    else if (node.type === "text" && typeof node.text === "string") charCount += node.text.length
    if (Array.isArray(node.content)) for (const child of node.content) stack.push(child)
  }
  return { quoteCount, blockCount, pageCount: estimatePages(charCount), charCount }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

/** Text content of an HTML string: tags dropped, entities decoded. */
function htmlText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
      if (name[0] === "#") {
        const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
      }
      return ENTITIES[name.toLowerCase()] ?? match
    })
}

/** Elements carrying `className` among their classes (not `className-…`). */
function countClass(html: string, className: string): number {
  const pattern = new RegExp(`class\\s*=\\s*["'](?:[^"']*\\s)?${className}(?:\\s[^"']*)?["']`, "gi")
  return html.match(pattern)?.length ?? 0
}

/**
 * Counts cards, blocks and text in stored HTML. Debate Editor's own HTML
 * marks cards `div.pmd-card` and blocks `h3.pmd-block`; HTML from before
 * that (the old card parser) has neither, so a card is counted by its tag
 * (`<h4>`) and a block by its `<h3>`.
 */
export function statsFromHtml(html: string): FileStats {
  const cards = countClass(html, "pmd-card")
  const blocks = countClass(html, "pmd-block")
  const quoteCount = cards || (html.match(/<h4[\s>]/gi)?.length ?? 0)
  const blockCount = blocks || (html.match(/<h3[\s>]/gi)?.length ?? 0)
  const charCount = htmlText(html).length
  return { quoteCount, blockCount, pageCount: estimatePages(charCount), charCount }
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ""))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The doc JSON inside a base64 `.cmir` (gzipped, or the older plain JSON). */
export async function readCmirDocJson(base64: string): Promise<unknown> {
  let bytes = base64ToBytes(base64)
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes)
  const envelope = JSON.parse(new TextDecoder().decode(bytes)) as { doc?: unknown }
  return envelope?.doc
}

/**
 * The stats for a stored row, whichever shape its `content` is in. A `.cmir`
 * that will not decode counts as empty rather than failing the save that
 * asked — the file itself is still stored, and opening it reports the damage.
 */
export async function computeStoredFileStats(item: StoredContent): Promise<FileStats> {
  const content = item.content ?? ""
  if (!content.trim()) return { ...EMPTY_FILE_STATS }
  if (!isCmirContent(item)) return statsFromHtml(content)
  try {
    return statsFromDocJson(await readCmirDocJson(content))
  } catch {
    return { ...EMPTY_FILE_STATS }
  }
}

/** The stat fields as optional row/index fields (null = not counted yet). */
export interface FileStatFields {
  quoteCount?: number | null
  blockCount?: number | null
  pageCount?: number | null
  charCount?: number | null
}

/** Reads the stat fields off an untrusted object (a stored index row):
 *  only the ones that are numbers, so a row without stats stays without. */
export function parseFileStatFields(row: Record<string, unknown>): FileStatFields {
  const out: FileStatFields = {}
  for (const key of ["quoteCount", "blockCount", "pageCount", "charCount"] as const) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value
  }
  return out
}

/** Copies only the stat fields that are set — for building index rows. */
export function statFieldsOf(row: FileStatFields): FileStatFields {
  const out: FileStatFields = {}
  if (row.quoteCount != null) out.quoteCount = row.quoteCount
  if (row.blockCount != null) out.blockCount = row.blockCount
  if (row.pageCount != null) out.pageCount = row.pageCount
  if (row.charCount != null) out.charCount = row.charCount
  return out
}

/** What the sidebar shows when a file is hovered. */
export interface FileHoverDetails extends FileStatFields {
  title: string
  updatedAt?: string | number | Date | null
  author?: string | null
  year?: number | null
}

function formatDate(value: string | number | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null
  const date = value instanceof Date ? value : new Date(typeof value === "number" && value < 1e11 ? value * 1000 : value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return null
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

/**
 * The hover text for a file row: last modified, author, year, pages, quotes,
 * blocks and characters, one per line. A value nobody knows is left out;
 * stats not counted yet say so rather than showing zeros.
 */
export function formatFileHoverText(details: FileHoverDetails): string {
  const lines = [details.title]
  const modified = formatDate(details.updatedAt)
  if (modified) lines.push(`Last modified: ${modified}`)
  if (details.author?.trim()) lines.push(`Author: ${details.author.trim()}`)
  if (details.year) lines.push(`Year: ${details.year}`)
  if (details.charCount == null) {
    lines.push("Pages, quotes, blocks and characters: not counted yet")
  } else {
    lines.push(`Pages: ${(details.pageCount ?? estimatePages(details.charCount)).toLocaleString("en-US")}`)
    lines.push(`Quotes: ${(details.quoteCount ?? 0).toLocaleString("en-US")}`)
    lines.push(`Blocks: ${(details.blockCount ?? 0).toLocaleString("en-US")}`)
    lines.push(`Characters: ${details.charCount.toLocaleString("en-US")}`)
  }
  return lines.join("\n")
}

/** The calendar year of a timestamp (ISO string, epoch ms/seconds or Date), or null. */
export function yearOf(value: string | number | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null
  const date = value instanceof Date ? value : new Date(typeof value === "number" && value < 1e11 ? value * 1000 : value)
  const year = date.getFullYear()
  return Number.isFinite(year) && date.getTime() > 0 ? year : null
}
