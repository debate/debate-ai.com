/**
 * @fileoverview Presentation logic for the full card content panel.
 *
 * A stored card already carries its own header: the dump's `markup` opens with
 * the tag as a heading and follows it with the citation paragraph. The panel
 * renders a header of its own from the indexed `tag`/`cite` fields, so every
 * card was showing its tag twice and its citation twice — once as panel
 * chrome, once in bold at the top of the card body.
 *
 * These helpers decide what belongs in the header and trim from the body the
 * leading blocks the header already says, so each piece of a card is on screen
 * exactly once. They are React-free so the de-duplication rules can be unit
 * tested without rendering the panel.
 *
 * @module lib/card-content
 */

/** Block-level tags a card's markup opens with before its body begins. */
const LEADING_BLOCK_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "section", "header"];

/**
 * Strips tags and decodes the few entities a card body actually carries.
 *
 * @param html - A fragment of card markup.
 * @returns The text a reader would see, with whitespace collapsed.
 */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reduces text to a form two renderings of the same sentence share.
 *
 * The tag in the index and the tag in the card's own heading differ by
 * punctuation, curly quotes and casing often enough that a strict comparison
 * would leave the duplicate on screen.
 *
 * @param text - Text or markup to normalize.
 * @returns Lowercased letters, digits and single spaces only.
 */
export function normalizeText(text: string): string {
  return plainText(text)
    .toLowerCase()
    .replace(/[‘’“”]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Drops the trailing year from a short citation, leaving the author.
 *
 * Debate citations date by season (`"Chilton 18"`) as often as by full year
 * (`"Smith 2024"`), so both forms have to come apart.
 *
 * @param citeShort - Short citation in `"Author Year"` form.
 * @returns The author alone, or the untouched input when no year trails it.
 */
export function extractAuthor(citeShort: string): string {
  const trimmed = (citeShort ?? "").trim();
  const withoutYear = trimmed.replace(/[\s,]*['’]?\d{2,4}\s*$/, "").trim();
  return withoutYear || trimmed;
}

/**
 * Reads a card's year as the two digits a debater says out loud.
 *
 * @param values - Year candidates in preference order, e.g. the indexed year
 *   then the short citation.
 * @returns A two-digit year such as `"18"`, or `""` when none is parseable.
 */
export function extractYear(...values: (string | number | undefined | null)[]): string {
  for (const value of values) {
    const digits = String(value ?? "").match(/\d{4}|\d{2}/g);
    if (!digits?.length) continue;
    const last = digits[digits.length - 1];
    const full = last.length === 4 ? Number(last) : 2000 + Number(last);
    if (full >= 1900 && full <= 2099) return String(full).slice(2);
  }
  return "";
}

/**
 * Picks the citation line to print under the author, if any adds information.
 *
 * The search API derives `cite_short` from `cite`, so on most cards the two are
 * the same string and printing both just repeats the author. The line is only
 * worth its row when the full citation says something the author line does not.
 *
 * @param cite - Full citation from the index.
 * @param authorLine - The author and year already rendered above it.
 * @returns The citation to render, or `""` when it would be a repeat.
 */
export function citationDetail(cite: string | undefined, authorLine: string): string {
  const trimmed = (cite ?? "").trim();
  if (!trimmed) return "";
  const normalizedCite = normalizeText(trimmed);
  if (!normalizedCite) return "";
  const normalizedAuthor = normalizeText(authorLine);
  if (!normalizedAuthor) return trimmed;
  return normalizedAuthor.includes(normalizedCite) ? "" : trimmed;
}

/**
 * Finds the first top-level element in a fragment and where it ends.
 *
 * @param html - Markup to scan, starting at `from`.
 * @param from - Index to scan from.
 * @returns The element's tag name, inner markup and end index, or `null` when
 *   the fragment does not open with an element.
 */
function firstElement(html: string, from: number): { tag: string; inner: string; end: number } | null {
  const open = /^\s*<([a-z][a-z0-9]*)\b[^>]*?(\/?)>/i.exec(html.slice(from));
  if (!open) return null;

  const tag = open[1].toLowerCase();
  const openEnd = from + open.index + open[0].length;
  // A self-closing or void element has no inner markup to compare.
  if (open[2] === "/") return { tag, inner: "", end: openEnd };

  const boundary = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "gi");
  boundary.lastIndex = openEnd;
  let depth = 1;
  for (let match = boundary.exec(html); match; match = boundary.exec(html)) {
    if (match[1] === "/") depth -= 1;
    else if (match[2] !== "/") depth += 1;
    if (depth === 0) {
      return { tag, inner: html.slice(openEnd, match.index), end: boundary.lastIndex };
    }
  }
  return null;
}

/**
 * Removes the leading blocks of a card body that the panel header already says.
 *
 * Only the run of blocks at the very top is considered, and scanning stops at
 * the first block that carries something new — so a card whose body happens to
 * restate its tag halfway down keeps that text, and a card with no duplicated
 * header is returned untouched.
 *
 * A body block counts as a repeat when its text is one of the header texts, or
 * is wholly contained in one. Containment only trims the *shorter* side: a
 * citation paragraph that expands on the header's `"Chilton 18"` into the full
 * qualification line is kept, because it is the copy that says more.
 *
 * @param html - The card's stored markup.
 * @param headerTexts - Text already rendered above the body.
 * @returns The markup with its duplicated opening blocks removed.
 */
export function stripDuplicateHeader(html: string, headerTexts: (string | undefined)[]): string {
  if (!html) return "";

  const normalizedHeaders = headerTexts
    .map((text) => normalizeText(text ?? ""))
    .filter((text) => text.length > 0);
  if (normalizedHeaders.length === 0) return html;

  let cursor = 0;
  for (;;) {
    const element = firstElement(html, cursor);
    if (!element || !LEADING_BLOCK_TAGS.includes(element.tag)) break;

    const text = normalizeText(element.inner);
    // An empty spacer paragraph is never the thing the header repeats, but it
    // should not stop the scan either.
    const isDuplicate =
      text.length === 0 || normalizedHeaders.some((header) => header === text || header.includes(text));
    if (!isDuplicate) break;

    cursor = element.end;
  }

  return cursor === 0 ? html : html.slice(cursor).trimStart();
}
