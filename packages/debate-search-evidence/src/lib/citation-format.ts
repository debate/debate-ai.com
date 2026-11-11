/**
 * @fileoverview Auto-citation formatting for the Shared Evidence Library
 * submission form (`panels/EvidenceLibraryPanel.tsx`'s **Format citation**
 * button) — the first slice of the "auto-citation formatting" half of the
 * "Evidence Library & Citation Manager" idea in IDEAS.md.
 *
 * Turns a pasted full citation into the debate-standard "short cite first"
 * form: `Smith 24 — Jane Smith, Professor of Economics at MIT, 3-14-2024, …`,
 * then appends the entry's Source URL when the citation doesn't already
 * carry it. Author and year detection is not reimplemented here: it reuses
 * `debate-card-parser`'s `extractCiteInfo` (the same heuristics the `.docx`
 * importer runs on every cite paragraph) and `formatShortCiteTag` (the
 * Verbatim "Smith 24" / "Smith ND" tag).
 *
 * Formatting is idempotent: a citation that already opens with a
 * `<tag> YY —` / `<tag> ND —` prefix keeps that prefix as is, so pressing the
 * button twice changes nothing.
 *
 * @module lib/citation-format
 */

import { extractCiteInfo, formatShortCiteTag } from "@debate-ai/card-parser"

/** Separator placed between the short cite and the full citation. */
export const CITE_SEPARATOR = " — "

/** Longest short-cite prefix recognised as "already formatted". */
const MAX_TAG_LENGTH = 80

/** `<tag> YY — rest` or `<tag> ND — rest`, the form this module produces. */
const FORMATTED_PREFIX_RE = new RegExp(`^(.{1,${MAX_TAG_LENGTH}}?\\s(?:\\d{2}|ND))\\s+[—–]\\s+(.*)$`, "s")

/** Leading separators left over after stripping a bare short cite ("Smith 24, Jane…"). */
const LEADING_SEPARATORS_RE = /^[\s,;:—–-]+/

export interface FormattedCitation {
  /** The formatted citation, ready to save as `EvidenceLibraryEntry.cite`. */
  cite: string
  /** Its short cite, e.g. `Smith 24` or `Brookings Institution ND`. */
  shortCite: string
  /** Whether `cite` differs from the (whitespace-collapsed) input. */
  changed: boolean
}

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim()

/** A URL reduced to what matters for "is it already in the cite": no scheme, `www.` or trailing slash; lowercased. */
function urlKey(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
}

/** `cite` with `sourceUrl` appended, unless it is blank or the cite already contains it. */
function withSourceUrl(cite: string, sourceUrl: string): string {
  const url = sourceUrl.trim()
  if (!url) return cite
  const key = urlKey(url)
  if (key && cite.toLowerCase().includes(key)) return cite
  return cite ? `${cite.replace(/[\s,;]+$/, "")}, ${url}` : url
}

/**
 * Formats a pasted citation as `<short cite> — <full citation>[, <source URL>]`.
 *
 * @param rawCite - The citation as typed or pasted.
 * @param sourceUrl - The entry's Source URL field; appended when not already in the cite.
 * @returns The formatted citation, or `null` when the citation is blank or no
 *   author can be found (there is nothing to build a short cite from).
 */
export function formatEvidenceCitation(rawCite: string, sourceUrl = ""): FormattedCitation | null {
  const cite = collapseWhitespace(rawCite)
  if (!cite) return null

  const already = cite.match(FORMATTED_PREFIX_RE)
  if (already) {
    const shortCite = already[1]!.trim()
    const formatted = withSourceUrl(`${shortCite}${CITE_SEPARATOR}${already[2]!.trim()}`, sourceUrl)
    return { cite: formatted, shortCite, changed: formatted !== cite }
  }

  const info = extractCiteInfo(cite, cite)
  const author = info.author?.trim()
  // The name heuristics fall back to "<first word> et al." on a cite with no
  // name at all ("2024, 12, 3"); a real author starts with a letter.
  if (!author || !/^\p{L}/u.test(author)) return null
  const shortCite = formatShortCiteTag({ author, year: info.year ?? undefined })
  if (!shortCite) return null

  // A cite that opens with its own short cite ("Smith 24, Jane Smith…") keeps
  // the rest as the body instead of repeating the tag.
  const body = cite.toLowerCase().startsWith(shortCite.toLowerCase())
    ? cite.slice(shortCite.length).replace(LEADING_SEPARATORS_RE, "")
    : cite
  const formatted = withSourceUrl(body ? `${shortCite}${CITE_SEPARATOR}${body}` : shortCite, sourceUrl)
  return { cite: formatted, shortCite, changed: formatted !== cite }
}
