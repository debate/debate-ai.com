import grab from "grab-url";

/**
 * @fileoverview The YouTube Data API client shared by the sync CLI and the
 * Worker.
 *
 * Two things here are not incidental.
 *
 * **The key is resolved per request, not at import.** This module started as
 * CLI-only, where `process.env.YOUTUBE_API_KEY` is read at startup and is
 * correct forever. In the Worker it is not: secrets arrive on the request's
 * `env` binding, and `process.env` is empty at module scope. Baking the key
 * into the client at import therefore sent every production sync request
 * with no key at all — a 403 from YouTube for every batch, on a deployment
 * whose admin page had just checked that the key was configured. The Worker
 * hands its key over with {@link setYouTubeApiKey} and every request reads
 * it at call time.
 *
 * **A failed request throws.** `grab` resolves with an `error` field rather
 * than rejecting on a non-2xx response, so `data.items` is simply
 * `undefined` on failure. Every helper below used to read straight through
 * that, which turned an authentication failure into "the API returned no
 * videos" — a resync that reported every video missing, with nothing in the
 * logs saying why. {@link youtubeRequest} raises {@link YouTubeApiError}
 * instead, so a caller can tell "YouTube said no" from "that video is gone".
 * @module youtube/youtube-api
 */

/** A YouTube API request that failed — transport, quota, key or HTTP status. */
export class YouTubeApiError extends Error {
  constructor(
    message: string,
    /** The API path that failed, for the log line. */
    readonly path?: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

/** Key handed over by a host that has one, e.g. the Worker's `env` binding. */
let apiKeyOverride: string | null = null;

/**
 * Sets the API key for subsequent requests.
 *
 * The Worker calls this with the key from its own `env` binding before a
 * sync; the CLI does not need to, because `process.env` is populated for it.
 *
 * @param key - The key, or `null` to fall back to `process.env`.
 */
export function setYouTubeApiKey(key: string | null | undefined): void {
  apiKeyOverride = key?.trim() || null;
}

/** The key in force right now, or `""` when none is configured. */
export function getYouTubeApiKey(): string {
  return apiKeyOverride ?? process.env.YOUTUBE_API_KEY ?? "";
}

export const YoutubeAPI = grab.instance({
  baseURL: "https://www.googleapis.com/youtube/v3",
});

/**
 * Makes one YouTube API request and returns its JSON body.
 *
 * @param path - API path, e.g. `/videos`.
 * @param params - Query parameters; the key is added here.
 * @returns The parsed response body.
 * @throws {YouTubeApiError} When no key is configured, or the API declines
 *   the request — quota, a bad key, or any non-2xx status.
 */
async function youtubeRequest(path: string, params: Record<string, unknown>): Promise<any> {
  const key = getYouTubeApiKey();
  if (!key) {
    throw new YouTubeApiError("YouTube API key not configured", path);
  }

  const res: any = await YoutubeAPI(path, { ...params, key });
  // JSON bodies are spread onto the response root, so `res.data` is only set
  // for non-JSON; read through both rather than assuming either.
  const data = res?.data && typeof res.data === "object" ? res.data : res;

  const failure = res?.error ?? data?.error;
  if (failure) {
    const message =
      typeof failure === "string" ? failure : failure?.message || "YouTube API request failed";
    throw new YouTubeApiError(message, path);
  }

  return data ?? {};
}

export async function getChannelId(channelName: string): Promise<string | null> {
  try {
    // Remove @ prefix if present (for handles like @DebateArchive2)
    const cleanName = channelName.startsWith("@") ? channelName.slice(1) : channelName;

    // Try to get channel by forUsername (legacy username)
    try {
      const byUsername = await youtubeRequest("/channels", {
        part: "id",
        forUsername: cleanName,
      });

      if (byUsername.items?.length > 0) {
        console.log(`Found channel by username: ${channelName} -> ${byUsername.items[0].id}`);
        return byUsername.items[0].id;
      }
    } catch (err) {
      // Username not found, continue to handle
    }

    // Try to get channel by handle (modern @handle format)
    try {
      const byHandle = await youtubeRequest("/channels", {
        part: "id",
        forHandle: channelName.startsWith("@") ? channelName : `@${channelName}`,
      });

      if (byHandle.items?.length > 0) {
        console.log(`Found channel by handle: ${channelName} -> ${byHandle.items[0].id}`);
        return byHandle.items[0].id;
      }
    } catch (err) {
      // Handle not found
    }

    console.warn(`Could not find channel for exact name: ${channelName}`);
    return null;
  } catch (error) {
    console.warn(`Error fetching channel ID for ${channelName}:`, error);
    return null;
  }
}

export async function getVideosByIds(videoIds: string[]): Promise<any[]> {
  const allVideos: any[] = [];

  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const ids = batch.join(",");

    const data = await youtubeRequest("/videos", {
      part: "snippet,statistics",
      id: ids,
    });

    if (data.items) {
      for (const item of data.items) {
        allVideos.push([
          item.id,
          item.snippet.title,
          item.snippet.publishedAt.split("T")[0],
          item.snippet.channelTitle,
          Number.parseInt(item.statistics?.viewCount || "0"),
          item.snippet.description || "",
        ]);
      }
    }

    console.log(`Fetched ${allVideos.length}/${videoIds.length} videos`);
  }

  return allVideos;
}

/**
 * Fetches the current view count for each video id.
 *
 * Requests only the `statistics` part — a view-count refresh has no use for
 * the snippet, and leaving it out keeps the response small on runs that cover
 * the whole library. Ids the API does not return (deleted or private videos)
 * are simply absent from the result rather than reported as zero views.
 *
 * @param videoIds - YouTube video ids, in any quantity; batched by 50.
 * @returns View count keyed by video id.
 */
export async function fetchViewCounts(videoIds: string[]): Promise<Record<string, number>> {
  const viewCounts: Record<string, number> = {};

  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const ids = batch.join(",");

    const data = await youtubeRequest("/videos", {
      part: "statistics",
      id: ids,
    });

    if (data?.items) {
      for (const item of data.items) {
        const views = Number.parseInt(item.statistics?.viewCount ?? "", 10);
        if (Number.isFinite(views)) viewCounts[item.id] = views;
      }
    }

    console.log(`Fetched view counts ${Math.min(i + 50, videoIds.length)}/${videoIds.length}`);
  }

  return viewCounts;
}

/** What YouTube currently says about one stored video. */
export interface YouTubeVideoStatus {
  videoId: string;
  /** Current view count, or `null` when the API withheld statistics. */
  viewCount: number | null;
  /** `public`, `unlisted` or `private`. */
  privacyStatus: string | null;
  /** `processed`, `uploaded`, `rejected`, `failed` or `deleted`. */
  uploadStatus: string | null;
  /** Whether the video may still be played in an embed. */
  embeddable: boolean | null;
}

/** One availability pass over a set of stored ids. */
export interface YouTubeStatusReport {
  /** Everything the API returned, keyed by video id. */
  statuses: Record<string, YouTubeVideoStatus>;
  /**
   * Ids the API did not return at all. A `/videos` lookup by id simply omits
   * a video that has been deleted or made private, so an id that goes in and
   * does not come back is exactly the takedown case.
   */
  missing: string[];
}

/**
 * Fetches view count *and* availability for each id in one pass.
 *
 * {@link fetchViewCounts} answers "how many views", and treats an id the API
 * skipped as merely absent. This answers the question the library actually
 * needs — "is this video still there?" — by asking for `status` alongside
 * `statistics` and reporting the skipped ids rather than swallowing them. A
 * video can be gone in three different ways and only one of them is a
 * deletion: private and region-blocked videos come back with a status that
 * says so, while a deleted one is simply not in the response.
 *
 * @param videoIds - Stored YouTube ids, in any quantity; batched by 50.
 * @returns Statuses and the ids that came back empty. See
 *   {@link YouTubeStatusReport}.
 * @throws {YouTubeApiError} When the API declines the request, so a caller
 *   never mistakes an outage for a library of deleted videos.
 */
export async function fetchVideoStatuses(videoIds: string[]): Promise<YouTubeStatusReport> {
  const statuses: Record<string, YouTubeVideoStatus> = {};
  const missing: string[] = [];

  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);

    const data = await youtubeRequest("/videos", {
      part: "statistics,status",
      id: batch.join(","),
    });

    for (const item of data?.items ?? []) {
      const views = Number.parseInt(item.statistics?.viewCount ?? "", 10);
      statuses[item.id] = {
        videoId: item.id,
        viewCount: Number.isFinite(views) ? views : null,
        privacyStatus: item.status?.privacyStatus ?? null,
        uploadStatus: item.status?.uploadStatus ?? null,
        embeddable: typeof item.status?.embeddable === "boolean" ? item.status.embeddable : null,
      };
    }

    for (const videoId of batch) {
      if (!statuses[videoId]) missing.push(videoId);
    }

    console.log(`Checked ${Math.min(i + 50, videoIds.length)}/${videoIds.length} videos`);
  }

  return { statuses, missing };
}

export async function fetchFullDescriptions(videoIds: string[]): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};

  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const ids = batch.join(",");

    const data = await youtubeRequest("/videos", {
      part: "snippet",
      id: ids,
    });

    if (data.items) {
      for (const item of data.items) {
        descriptions[item.id] = item.snippet.description || "";
      }
    }

    console.log(`Fetched descriptions ${Math.min(i + 50, videoIds.length)}/${videoIds.length}`);
  }

  return descriptions;
}

export async function getVideosForChannel(
  channelId: string,
  channelName: string,
  publishedAfter: string,
): Promise<any[]> {
  // Use the uploads playlist (replace UC prefix with UU) for reliable full listing
  const uploadsPlaylistId = channelId.replace(/^UC/, "UU");
  const publishedAfterDate = new Date(publishedAfter);

  const allVideoIds: string[] = [];
  let nextPageToken: string | null = null;
  const seenIds = new Set<string>();

  // Step 1: Get all video IDs from the uploads playlist
  do {
    const params: any = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: 50,
    };
    if (nextPageToken) params.pageToken = nextPageToken;

    const data = await youtubeRequest("/playlistItems", params);

    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      const videoId = item.contentDetails.videoId;
      const publishedAt = new Date(item.contentDetails.videoPublishedAt);
      if (publishedAt < publishedAfterDate) continue;
      if (seenIds.has(videoId)) continue;
      seenIds.add(videoId);
      allVideoIds.push(videoId);
    }

    nextPageToken = data.nextPageToken || null;
    console.log(`Listed ${allVideoIds.length} video IDs for ${channelName} (page token: ${nextPageToken ? "next" : "done"})`);
  } while (nextPageToken);

  console.log(`Found ${allVideoIds.length} video IDs for ${channelName}, fetching details...`);

  // Step 2: Fetch full details (snippet + statistics) in batches of 50
  const allVideos: any[] = [];
  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batch = allVideoIds.slice(i, i + 50);
    const ids = batch.join(",");

    const data = await youtubeRequest("/videos", {
      part: "snippet,statistics",
      id: ids,
    });

    if (data.items) {
      for (const item of data.items) {
        allVideos.push([
          item.id,
          item.snippet.title,
          item.snippet.publishedAt.split("T")[0],
          item.snippet.channelTitle,
          Number.parseInt(item.statistics?.viewCount || "0"),
          item.snippet.description || "",
        ]);
      }
    }

    console.log(`Fetched details ${Math.min(i + 50, allVideoIds.length)}/${allVideoIds.length} for ${channelName}`);
  }

  console.log(`Total: ${allVideos.length} unique videos for ${channelName}`);
  return allVideos;
}
