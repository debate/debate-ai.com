/**
 * @fileoverview Finds the web page a card was cut from.
 *
 * Cards carry no dedicated URL field: a Verbatim citation ends with the
 * source link written out as text (`… Foreign Affairs, https://…, accessed
 * 7-12-24`), and a card imported from HTML may instead link it with an
 * `<a href>` in the citation paragraph. This module reads both, citation
 * first, so the card panel can offer to open the source or pull its full text.
 *
 * React-free so the detection rules can be unit tested on their own.
 *
 * @module lib/card-source-url
 */

/** An `href` attribute's value, quoted either way. */
const HREF_PATTERN = /\bhref\s*=\s*(["'])(.*?)\1/gi

/**
 * A URL written out as text. Stops at whitespace, markup, quotes and the
 * brackets a citation wraps a link in; trailing punctuation is trimmed after.
 */
const TEXT_URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+/gi

/** Punctuation a citation puts after a link that is not part of it. */
const TRAILING_PUNCTUATION = /[.,;:!?'"’”)\]}]+$/

/**
 * Normalizes one candidate into an absolute http(s) URL.
 *
 * @param candidate - A raw `href` value or a URL found in text.
 * @returns The URL, or `null` when it is not a fetchable web page — a
 *   relative link, a `mailto:`, or a bare domain with no article path.
 */
export function normalizeSourceUrl(candidate: string): string | null {
  const trimmed = candidate
    .replace(/&amp;/gi, "&")
    .trim()
    .replace(TRAILING_PUNCTUATION, "")
  if (!trimmed) return null

  const absolute = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed
  if (!/^https?:\/\//i.test(absolute)) return null

  let url: URL
  try {
    url = new URL(absolute)
  } catch {
    return null
  }
  if (!url.hostname.includes(".")) return null
  // qwksearch rejects a domain-only link as "not an article", and opening a
  // publication's homepage is no help finding the card's source either.
  if (url.pathname === "/" && !url.search) return null

  return url.toString()
}

/**
 * Returns the first usable source URL in a fragment of card text or markup.
 *
 * Linked `href`s win over URLs written as text, since an importer that kept
 * the link kept the exact one the card was cut from.
 *
 * @param text - Citation text or card markup.
 * @returns The first http(s) URL with an article path, or `null`.
 */
export function findUrlInText(text: string | undefined | null): string | null {
  if (!text) return null

  for (const match of text.matchAll(HREF_PATTERN)) {
    const url = normalizeSourceUrl(match[2])
    if (url) return url
  }
  for (const match of text.matchAll(TEXT_URL_PATTERN)) {
    const url = normalizeSourceUrl(match[0])
    if (url) return url
  }
  return null
}

/**
 * Finds the source web page of a card.
 *
 * The citation is searched before the body: it is where the link belongs, and
 * a card's body can quote other URLs that are not its source.
 *
 * @param card - Any card with a citation and/or markup.
 * @returns The source URL, or `null` when the card names none.
 */
export function findCardSourceUrl(card: { cite?: string | null; html?: string | null }): string | null {
  return findUrlInText(card.cite) ?? findUrlInText(card.html)
}
