/**
 * @fileoverview Search over the docs sidebar's files — the reader's own
 * documents and the public Topic Starters — by file name *and* contents, for
 * the app-wide Ctrl/Cmd-K palette (`components/layout/command-palette/GlobalCommandPalette`).
 *
 * The palette's tool catalogue is ranked by fuse.js; files are not, because
 * a fuzzy match over a whole card file's text turns every query into a hit.
 * Here a file matches when every word of the query appears in its name, one
 * of its outline headings, or its text. A name hit outranks an outline hit,
 * which outranks a contents hit; an outline hit names the heading and a
 * contents hit carries a snippet of the text around the first matched word,
 * so the row shows *why* it matched.
 *
 * Pure on purpose: the palette builds {@link FileSearchEntry} rows from the
 * provider (turning `.cmir` rows into text with Debate Editor's engine, which is
 * loaded on demand) and this module only ranks them.
 *
 * @module lib/reason-docs/file-search
 */

/** One searchable file. */
export interface FileSearchEntry {
  /** `"document"` for an owned file, `"topic"` for a public topic starter. */
  kind: "document" | "topic"
  id: number
  title: string
  /** The folders above the file, `"Energy / Solar"`, or `""` at the top. */
  folder: string
  /** The file's text with markup stripped; `""` while it isn't converted yet. */
  text: string
  /** The file's outline — its pocket, hat, block and tag headings, in order. */
  headings?: readonly string[]
}

/** A ranked hit. `heading` is set only for an outline match, `snippet` only
 *  for a contents match. */
export interface FileSearchResult {
  entry: FileSearchEntry
  snippet: string | null
  /** The outline heading every word matched, for an outline match. */
  heading?: string | null
  /** True when every word matched the name (or folder) alone. */
  nameMatch: boolean
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
}

/**
 * HTML → plain text, without a DOM: the palette runs this over every file, and
 * a regex pass is both cheaper than parsing and safe to call during SSR.
 * Block-level closes become spaces so words on adjacent lines don't fuse.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ""
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(p|div|br|li|h[1-6]|tr|td|th|blockquote|section|article)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * The text of each `<h1>`–`<h6>` in `html`, in order, without empty ones —
 * the outline the editor's navigation pane shows for the file.
 */
export function htmlHeadings(html: string): string[] {
  if (!html) return []
  const out: string[] = []
  for (const match of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = htmlToPlainText(match[2]!)
    if (text) out.push(text)
  }
  return out
}

/** The query split into lowercased words. */
function termsOf(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** ~`radius` characters either side of `index`, cut at word edges. */
function snippetAround(text: string, index: number, length: number, radius = 60): string {
  let start = Math.max(0, index - radius)
  let end = Math.min(text.length, index + length + radius)
  if (start > 0) {
    const space = text.indexOf(" ", start)
    if (space !== -1 && space < index) start = space + 1
  }
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end)
    if (space > index + length) end = space
  }
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`
}

/**
 * Ranks `entries` against `query`: name matches first (shorter names first,
 * so an exact name beats one that merely contains it), then outline matches
 * (a heading holding every word), then contents matches, both in their
 * original order. An empty query matches nothing — the palette
 * browses tools, not files, until something is typed.
 */
export function searchFiles(entries: readonly FileSearchEntry[], query: string, limit = 8): FileSearchResult[] {
  const terms = termsOf(query)
  if (terms.length === 0) return []
  const byName: FileSearchResult[] = []
  const byHeading: FileSearchResult[] = []
  const byText: FileSearchResult[] = []
  for (const entry of entries) {
    const name = `${entry.title} ${entry.folder}`.toLowerCase()
    const text = entry.text.toLowerCase()
    const inName = terms.every((term) => name.includes(term))
    if (inName) {
      byName.push({ entry, snippet: null, nameMatch: true })
      continue
    }
    const heading = entry.headings?.find((h) => {
      const lower = h.toLowerCase()
      return terms.every((term) => lower.includes(term))
    })
    if (heading) {
      byHeading.push({ entry, snippet: null, heading, nameMatch: false })
      continue
    }
    if (!terms.every((term) => name.includes(term) || text.includes(term))) continue
    // The snippet centres on the first word that isn't already in the name,
    // which is the word the reader is looking for in the body.
    const bodyTerm = terms.find((term) => !name.includes(term)) ?? terms[0]!
    const at = text.indexOf(bodyTerm)
    byText.push({ entry, snippet: snippetAround(entry.text, at, bodyTerm.length), nameMatch: false })
  }
  byName.sort((a, b) => a.entry.title.length - b.entry.title.length || a.entry.title.localeCompare(b.entry.title))
  return [...byName, ...byHeading, ...byText].slice(0, limit)
}

/** Items with a name and a parent, enough to build a folder path. */
interface FolderItem {
  id: number
  title: string
  parentId: number | null
}

/** `"Energy / Solar"` for a file two folders down; `""` at the top level. */
export function folderPathOf(items: readonly FolderItem[], item: FolderItem): string {
  const byId = new Map(items.map((row) => [row.id, row]))
  const names: string[] = []
  const seen = new Set<number>()
  let parentId = item.parentId
  while (parentId != null && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    names.unshift(parent.title)
    parentId = parent.parentId
  }
  return names.join(" / ")
}
