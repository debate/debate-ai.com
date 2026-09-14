/**
 * @fileoverview Document names as URL path segments.
 *
 * A document's address is its name — `/doc/cp-answer-to-states`, not
 * `?topic=2`. An opaque id tells a reader nothing about what they are about
 * to open, and reads as an implementation detail in a shared link or a
 * browser history; the file's title is the thing actually being shared.
 *
 * Titles are not unique, though, and ids are. When two files in the same
 * catalogue slugify the same way the loser would be unreachable, so the
 * ambiguous ones carry a discriminator after a `~` —
 * `cp-answer-to-states~t2`. `~` survives that round trip because
 * {@link slugifyDocTitle} strips it out of titles: a file actually called
 * "CP Answer ~ States" slugifies to `cp-answer-states`, so no title can forge
 * a discriminator.
 *
 * Pure and shared: both document surfaces (`/reason-editor`, the qwksearch
 * workspace at `/doc`) build and read their paths through here, and both have
 * unit tests against this module rather than against a rendered route.
 *
 * @module lib/reason-docs/doc-slug
 */

/** What an untitled (or unslugifiable) document is addressed as. */
export const UNTITLED_DOC_SLUG = "untitled"

/** Cap on the generated slug, so a paragraph-long title doesn't become a
 *  paragraph-long URL. Cut on a word boundary where there is one. */
const MAX_SLUG_LENGTH = 80

/** Separates a slug from the id that disambiguates it. */
export const DOC_SLUG_DISCRIMINATOR = "~"

/**
 * A document title as a URL path segment: lowercase, ASCII, words joined by
 * single hyphens.
 *
 * Apostrophes are dropped rather than hyphenated (`don't` → `dont`, not
 * `don-t`), accents are folded to their base letters, and everything else
 * non-alphanumeric collapses to one hyphen. A title with nothing left after
 * that — emoji only, whitespace only, empty — is {@link UNTITLED_DOC_SLUG}
 * rather than an empty segment, which would produce `/doc/` and address
 * nothing.
 */
export function slugifyDocTitle(title: string | null | undefined): string {
  const folded = (title ?? "")
    .normalize("NFKD")
    // Combining marks left behind by the decomposition above.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, "")
  const slug = folded.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (!slug) return UNTITLED_DOC_SLUG
  if (slug.length <= MAX_SLUG_LENGTH) return slug
  const cut = slug.slice(0, MAX_SLUG_LENGTH)
  const lastWordBreak = cut.lastIndexOf("-")
  const trimmed = lastWordBreak > 0 ? cut.slice(0, lastWordBreak) : cut
  return trimmed.replace(/-+$/, "") || UNTITLED_DOC_SLUG
}

/** `("cp-answer-to-states", "t2")` → `"cp-answer-to-states~t2"`. */
export function withDocSlugDiscriminator(slug: string, discriminator: string): string {
  return `${slug}${DOC_SLUG_DISCRIMINATOR}${discriminator}`
}

/** A path segment split back into the pieces {@link withDocSlugDiscriminator}
 *  joined. A segment with no `~` has a `null` discriminator. */
export interface ParsedDocSlug {
  slug: string
  discriminator: string | null
}

/**
 * Reads a `/doc/<segment>` path segment.
 *
 * Next has already percent-decoded the segment; the second decode is for
 * links that double-encoded it, and falls back to the segment as given when
 * the escape doesn't parse (`decodeURIComponent` throws on a lone `%`) so a
 * malformed link lands on the route's normal fallback instead of a 500.
 *
 * The discriminator is taken from the *last* `~`, so a title that somehow
 * carries one still splits at the boundary this module wrote.
 */
export function parseDocSlugSegment(segment: string | null | undefined): ParsedDocSlug | null {
  if (!segment) return null
  let decoded = segment
  try {
    decoded = decodeURIComponent(segment)
  } catch {
    // Keep the raw segment — see above.
  }
  const trimmed = decoded.trim().toLowerCase()
  if (!trimmed) return null
  const at = trimmed.lastIndexOf(DOC_SLUG_DISCRIMINATOR)
  if (at <= 0 || at === trimmed.length - 1) return { slug: trimmed, discriminator: null }
  return { slug: trimmed.slice(0, at), discriminator: trimmed.slice(at + 1) }
}

/** A file in one addressable catalogue: `id` is unique within it (and is
 *  what a colliding slug is disambiguated by), `title` is what the reader
 *  sees and what the URL is built from. */
export interface DocSlugEntry {
  id: string
  title: string
}

/**
 * The path segment addressing `id` within `entries`.
 *
 * Unambiguous titles get the bare slug; a title that slugifies the same as
 * another file's gets `~<id>` appended so both stay reachable. Returns `null`
 * for an id that isn't in the catalogue — a caller with a file it cannot name
 * should leave the URL alone rather than write a wrong one.
 */
export function docSlugForId(id: string, entries: readonly DocSlugEntry[]): string | null {
  const entry = entries.find((item) => item.id === id)
  if (!entry) return null
  const slug = slugifyDocTitle(entry.title)
  const ambiguous = entries.some((other) => other.id !== id && slugifyDocTitle(other.title) === slug)
  return ambiguous ? withDocSlugDiscriminator(slug, id) : slug
}

/**
 * The file a path segment addresses, or `null` when it names none.
 *
 * A discriminator wins outright — it is an id, and ids are exact. Failing
 * that (a link written before a rename, a hand-typed URL) the bare slug is
 * matched in `entries` order, so a caller that cares about precedence
 * expresses it by ordering the catalogue. A segment that is simply an id is
 * accepted too, which is what keeps older `?docs=<id>`-shaped links working
 * once they are rewritten as paths.
 */
export function findDocIdBySlug(
  segment: string | null | undefined,
  entries: readonly DocSlugEntry[],
): string | null {
  const parsed = parseDocSlugSegment(segment)
  if (!parsed) return null
  if (parsed.discriminator) {
    const exact = entries.find((item) => item.id.toLowerCase() === parsed.discriminator)
    if (exact) return exact.id
  }
  const bySlug = entries.find((item) => slugifyDocTitle(item.title) === parsed.slug)
  if (bySlug) return bySlug.id
  const byId = entries.find((item) => item.id.toLowerCase() === parsed.slug)
  return byId ? byId.id : null
}

/**
 * A slug read back as words — `cp-answer-to-states~t2` → `Cp Answer To
 * States`.
 *
 * Lossy by nature (the original capitalization and punctuation are gone), so
 * this is for the one caller that has nothing better: a route's
 * `generateMetadata`, naming the browser tab on the server, where the
 * documents — per-reader, and in the browser's own storage — cannot be looked
 * up. Anything rendered client-side should use the real title instead.
 */
export function titleFromDocSlug(segment: string | null | undefined): string {
  const parsed = parseDocSlugSegment(segment)
  if (!parsed) return ""
  return parsed.slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
