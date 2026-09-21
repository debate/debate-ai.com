/**
 * @fileoverview URL slugs for the per-video watch page, `/videos/watch/<slug>`.
 *
 * A slug is the video's title, slugified: `ndt-finals`. The title is
 * there for readers and for search engines; it is the only part that
 * identifies the video in the URL, so a retitled video gets a new
 * address — old links stop working by design, which is the trade-off
 * for clean URLs without appended ids.
 *
 * @module lib/video-slug
 */

/**
 * Longest title portion kept in a slug. Long enough to stay readable in a
 * search result, short enough that the whole URL survives being pasted into
 * chat clients that elide long links.
 */
const MAX_TITLE_SLUG_LENGTH = 80;

/**
 * Slugifies a video title for use in a URL path segment.
 *
 * Accents are folded to ASCII, everything that isn't a letter or digit
 * becomes a single `-`, and the result is truncated at a word boundary.
 *
 * @param title - Raw video title.
 * @returns Lowercase, dash-separated slug; `""` when the title has no
 *   slug-able characters at all.
 */
export function slugifyVideoTitle(title: string): string {
  const slug = (title ?? "")
    .normalize("NFKD")
    // Strip the combining marks NFKD just split off, so "é" becomes "e".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= MAX_TITLE_SLUG_LENGTH) return slug;

  const clipped = slug.slice(0, MAX_TITLE_SLUG_LENGTH);
  const lastBreak = clipped.lastIndexOf("-");
  // Cutting at the last dash keeps whole words, unless that would leave
  // almost nothing — then take the hard truncation.
  return (lastBreak > MAX_TITLE_SLUG_LENGTH / 2 ? clipped.slice(0, lastBreak) : clipped).replace(
    /-+$/,
    "",
  );
}

/**
 * Builds the watch-page slug for a video.
 *
 * @param title - Video title.
 * @returns `<title-slug>` — the video id is no longer appended.
 */
export function videoWatchSlug(title: string): string {
  return slugifyVideoTitle(title);
}

/**
 * Builds the watch-page href for a video.
 *
 * @param title - Video title.
 * @returns Absolute app path, e.g. `/videos/watch/ndt-finals`.
 */
export function videoWatchHref(title: string): string {
  return `/videos/watch/${videoWatchSlug(title)}`;
}

/**
 * Normalizes a watch-page slug segment for lookup.
 *
 * The URL no longer carries a video id, so the slug is used as-is
 * to find the video by its title.
 *
 * @param slug - The `[slug]` route segment, URL-decoded or not.
 * @returns The trimmed slug, or `null` when empty.
 */
export function parseVideoWatchSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // A malformed escape sequence — fall back to the raw segment.
  }
  return slug.trim().replace(/\/+$/, "") || null;
}
