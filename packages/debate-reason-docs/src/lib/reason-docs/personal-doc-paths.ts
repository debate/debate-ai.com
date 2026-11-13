/**
 * @fileoverview The `/<username>/<side>/<slug>` address of a personal file,
 * e.g. `/alexgul/aff/aca-affirmative-msci-2026`.
 *
 * A personal file lives under its owner's account, addressed by the owner's
 * username slug, the side it argues (`aff` / `neg`), and the document's own
 * slug. Once the file is listed in the file market the same address works for
 * anyone who follows it: the reader opens their own copy (or, for a file they
 * bought, the copy saved to their files) by the same name.
 *
 * Mirrors `topic-doc-paths` (`/docs/<topic code>/<path>`): one naming scheme,
 * one address, both built and read back here so the two halves cannot drift.
 *
 * @module lib/reason-docs/personal-doc-paths
 */

export const PERSONAL_DOCS_ROUTE = ""

/** The side a personal file argues: affirmative or negative. */
export type PersonalDocSide = "aff" | "neg"

/** Whether `segment` is an `aff` or `neg` side segment. */
export function isPersonalDocSide(segment: string | null | undefined): segment is PersonalDocSide {
  return segment === "aff" || segment === "neg"
}

/** A personal-file address read back: the owner, the side, and the slug. */
export interface PersonalDocPath {
  /** The file's owner — their username slug. */
  username: string
  /** `aff` or `neg`. */
  side: PersonalDocSide
  /** The document's slug, or `null` on the bare `/<username>/<side>`. */
  slug: string | null
}

/** Reads `/<username>/<side>/<slug>` off a pathname, or `null` for anything
 *  else — including `/<username>` (no side) and `/<username>/<other>` (not a
 *  side). */
export function parsePersonalDocPath(pathname: string | null | undefined): PersonalDocPath | null {
  if (!pathname) return null
  const path = (pathname.split("?")[0]?.split("#")[0] ?? "").replace(/\/+$/, "")
  if (!path.startsWith("/")) return null
  const [username, side, ...rest] = path.slice(1).split("/")
  if (!username || !isPersonalDocSide(side)) return null
  const slug = rest.join("/") || null
  return { username, side, slug }
}

/** True on a personal-file address (`/alexgul/aff/aca-affirmative-msci-2026`). */
export function isPersonalDocPath(pathname: string | null | undefined): boolean {
  return parsePersonalDocPath(pathname) != null
}

/** `/<username>/<side>/<slug>`, with the slug encoded segment-wise so its own
 *  slashes stay path structure; `/<username>/<side>` without a slug. */
export function personalDocHref(
  username: string,
  side: PersonalDocSide,
  slug?: string | null,
): string {
  const base = `/${username}/${side}`
  if (!slug) return base
  return `${base}/${slug.split("/").map(encodeURIComponent).join("/")}`
}
