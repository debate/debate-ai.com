/**
 * Viewer submissions to the video library — "add this video" and "subscribe
 * to this channel" — filed from the plus button beside the library's search
 * bar and added only once a moderator approves them.
 *
 * Like change requests (`./video-change-requests.ts`) they ride the existing
 * `video_issues` queue rather than a table of their own, so they land in the
 * moderators' one "Reports" list and need no migration:
 *
 * - `submit-video` stores the YouTube id in `videoId`, the title in `title`,
 *   and `{ url, channel, note }` as JSON in `issue`.
 * - `submit-channel` has no video, so `videoId` is empty; the channel name
 *   (the `@handle` the resync looks up) is in `title`, and `{ url, note }` is
 *   JSON in `issue`.
 *
 * The library plays everything from YouTube, so "your own video" means a
 * YouTube link to it — there is no file hosting behind the player.
 */

/** The two submission kinds, as stored in `video_issues.kind`. */
export const SUBMISSION_KINDS = ["submit-video", "submit-channel"] as const;

export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

/** Narrows a report kind to a submission kind. */
export function isSubmissionKind(value: unknown): value is SubmissionKind {
  return typeof value === "string" && (SUBMISSION_KINDS as readonly string[]).includes(value);
}

/** YouTube ids are exactly 11 characters from this alphabet. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Longest channel name `youtube_channels.name` accepts. */
const MAX_CHANNEL_LENGTH = 200;

/** Parses a string as a URL, adding the scheme a pasted link often lacks. */
function toUrl(input: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
}

/** Whether a hostname is one of YouTube's. */
function isYouTubeHost(host: string): boolean {
  const bare = host.toLowerCase().replace(/^(www|m|music)\./, "");
  return bare === "youtube.com" || bare === "youtu.be" || bare === "youtube-nocookie.com";
}

/**
 * Pulls the video id out of anything a viewer is likely to paste: a bare id,
 * a `watch?v=` link, a `youtu.be` short link, or a `shorts/`, `live/` or
 * `embed/` link.
 *
 * @returns The 11-character id, or `null` when the input is not a YouTube video.
 */
export function parseYouTubeVideoId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (VIDEO_ID_RE.test(text)) return text;

  const url = toUrl(text);
  if (!url || !isYouTubeHost(url.hostname)) return null;

  const fromQuery = url.searchParams.get("v");
  if (fromQuery && VIDEO_ID_RE.test(fromQuery)) return fromQuery;

  const segments = url.pathname.split("/").filter(Boolean);
  const candidate = url.hostname.toLowerCase().endsWith("youtu.be")
    ? segments[0]
    : ["shorts", "live", "embed", "v"].includes(segments[0] ?? "")
      ? segments[1]
      : undefined;
  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null;
}

/**
 * Turns a channel link or name into the name the subscribed-channels list
 * stores. The resync resolves a name as a legacy username or an `@handle`
 * (`getChannelId` in the former `debate-data-sync` package), so a link reduces to that:
 * `youtube.com/@Foo` → `@Foo`, `youtube.com/c/Foo` and `/user/Foo` → `Foo`,
 * and `/channel/UC…` keeps the id for a moderator to rename. Anything that
 * isn't a YouTube link is taken as a typed name.
 *
 * @returns The channel name, or `null` when nothing usable was given.
 */
export function parseChannelName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text) return null;

  const looksLikeLink = /^https?:\/\//i.test(text) || /^(www\.|m\.)?youtube\.com\//i.test(text);
  if (looksLikeLink) {
    const url = toUrl(text);
    if (!url || !isYouTubeHost(url.hostname)) return null;
    const [first, second] = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (first?.startsWith("@")) return first.length > 1 ? first.slice(0, MAX_CHANNEL_LENGTH) : null;
    if ((first === "c" || first === "user" || first === "channel") && second) {
      return second.slice(0, MAX_CHANNEL_LENGTH);
    }
    return null;
  }

  return text.length <= MAX_CHANNEL_LENGTH ? text : null;
}

/** What a video submission's `issue` JSON carries. */
export interface VideoSubmissionDetails {
  url: string;
  channel: string;
  note: string;
}

/** What a channel submission's `issue` JSON carries. */
export interface ChannelSubmissionDetails {
  url: string;
  note: string;
}

/**
 * Looks a video's title and channel up from YouTube's oEmbed endpoint, which
 * needs no API key. Best-effort: a submission never fails because YouTube
 * didn't answer, the moderator just sees the id instead.
 */
export async function fetchYouTubeOEmbed(
  videoId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ title: string; channel: string } | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetchImpl(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: unknown; author_name?: unknown };
    return {
      title: typeof body.title === "string" ? body.title : "",
      channel: typeof body.author_name === "string" ? body.author_name : "",
    };
  } catch {
    return null;
  }
}
