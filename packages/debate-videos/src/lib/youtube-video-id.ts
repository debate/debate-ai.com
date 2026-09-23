/**
 * @fileoverview Pulls the 11-character video id out of whatever an editor
 * pastes: a bare id, a `watch?v=` link, a `youtu.be` short link, a Shorts,
 * live or embed URL, or one of this site's own `/videos/watch?v=` links.
 * @module lib/youtube-video-id
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * @param input - A YouTube id or URL, as pasted.
 * @returns The video id, or `null` when none can be found.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (VIDEO_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery;

  const segments = url.pathname.split("/").filter(Boolean);
  if (url.hostname.replace(/^www\./, "") === "youtu.be") {
    return segments[0] && VIDEO_ID.test(segments[0]) ? segments[0] : null;
  }

  const marker = segments.findIndex((segment) =>
    ["embed", "shorts", "live", "v"].includes(segment),
  );
  const candidate = marker >= 0 ? segments[marker + 1] : undefined;
  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}
