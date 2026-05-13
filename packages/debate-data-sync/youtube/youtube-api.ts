import grab from "grab-url";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export const YoutubeAPI = grab.instance({
  baseURL: "https://www.googleapis.com/youtube/v3",
  key: YOUTUBE_API_KEY,
});

export async function getChannelId(channelName: string): Promise<string | null> {
  try {
    // Remove @ prefix if present (for handles like @DebateArchive2)
    const cleanName = channelName.startsWith("@") ? channelName.slice(1) : channelName;

    // Try to get channel by forUsername (legacy username)
    try {
      const byUsername = await YoutubeAPI("/channels", {
        part: "id",
        forUsername: cleanName,
      });

      if (byUsername.data?.items && byUsername.data.items.length > 0) {
        console.log(`Found channel by username: ${channelName} -> ${byUsername.data.items[0].id}`);
        return byUsername.data.items[0].id;
      }
    } catch (err) {
      // Username not found, continue to handle
    }

    // Try to get channel by handle (modern @handle format)
    try {
      const byHandle = await YoutubeAPI("/channels", {
        part: "id",
        forHandle: channelName.startsWith("@") ? channelName : `@${channelName}`,
      });

      if (byHandle.data?.items && byHandle.data.items.length > 0) {
        console.log(`Found channel by handle: ${channelName} -> ${byHandle.data.items[0].id}`);
        return byHandle.data.items[0].id;
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

    const data = await YoutubeAPI("/videos", {
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

export async function fetchFullDescriptions(videoIds: string[]): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};

  // YouTube API allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const ids = batch.join(",");

    const data = await YoutubeAPI("/videos", {
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

    const res: any = await YoutubeAPI("/playlistItems", params);
    const data = res.data || res;

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

    const res: any = await YoutubeAPI("/videos", {
      part: "snippet,statistics",
      id: ids,
    });
    const data = res.data || res;

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
