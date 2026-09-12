/**
 * @fileoverview URL slugs for the per-video watch page, `/videos/watch/<slug>`.
 *
 * A slug is the video's title, slugified, with its YouTube id appended:
 * `2022-ndt-finals-dartmouth-vs-michigan-dQw4w9WgXcQ`. The title is there for
 * readers and for search engines; the id is the only part that identifies the
 * video, so a retitled video keeps working on its old link.
 *
 * The id is read back from the **end** of the slug rather than by splitting on
 * `-`: YouTube ids are 11 characters and may themselves contain `-` and `_`,
 * so `slug.split("-").pop()` truncates every id that has a dash in it.
 * @module lib/video-slug
 */

/** YouTube video ids are exactly 11 characters from this alphabet. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Length of a YouTube video id. */
const VIDEO_ID_LENGTH = 11;

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
 * @param videoId - YouTube video id.
 * @returns `<title-slug>-<videoId>`, or just the id for an untitled video.
 */
export function videoWatchSlug(title: string, videoId: string): string {
  const titleSlug = slugifyVideoTitle(title);
  return titleSlug ? `${titleSlug}-${videoId}` : videoId;
}

/**
 * Builds the watch-page href for a video.
 *
 * @param title - Video title.
 * @param videoId - YouTube video id.
 * @returns Absolute app path, e.g. `/videos/watch/ndt-finals-dQw4w9WgXcQ`.
 */
export function videoWatchHref(title: string, videoId: string): string {
  return `/videos/watch/${videoWatchSlug(title, videoId)}`;
}

/**
 * Reads the video id back out of a watch-page slug.
 *
 * The id is the last 11 characters, which is why a title whose own slug ends
 * in something id-shaped is still parsed correctly — the title is never
 * consulted. A bare id (a video with no slug-able title) is accepted as-is.
 *
 * @param slug - The `[slug]` route segment, URL-decoded or not.
 * @returns The YouTube video id, or `null` when the slug doesn't carry one.
 */
export function parseVideoWatchSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;

  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // A malformed escape sequence — fall back to the raw segment.
  }
  const trimmed = decoded.trim().replace(/\/+$/, "");

  if (VIDEO_ID_RE.test(trimmed)) return trimmed;
  if (trimmed.length < VIDEO_ID_LENGTH + 2) return null;

  const candidate = trimmed.slice(-VIDEO_ID_LENGTH);
  // The id is always appended with a separating dash, so anything else in
  // that position means this slug wasn't built by `videoWatchSlug`.
  if (trimmed[trimmed.length - VIDEO_ID_LENGTH - 1] !== "-") return null;
  return VIDEO_ID_RE.test(candidate) ? candidate : null;
}
