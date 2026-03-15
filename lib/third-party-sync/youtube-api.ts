import grab from "grab-url";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export const YoutubeAPI = grab.instance({
  baseURL: "https://www.googleapis.com/youtube/v3",
  key: YOUTUBE_API_KEY,
});

export async function getChannelId(channelName: string): Promise<string | null> {
  try {
    const data = await YoutubeAPI("/search", {
      part: "snippet",
      type: "channel",
      q: channelName,
    });

    if (data.data.items && data.data.items.length > 0) {
      return data.data.items[0].id.channelId;
    }
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

export async function getVideosForChannel(
  channelId: string,
  channelName: string,
  publishedAfter: string,
): Promise<any[]> {
  const allVideos: any[] = [];
  let nextPageToken: string | null = null;

  do {
    const searchData: any = await YoutubeAPI("/search", {
      part: "snippet",
      channelId,
      order: "date",
      type: "video",
      maxResults: 50,
      publishedAfter,
    });

    if (!searchData.items || searchData.items.length === 0) break;

    const videoIds = searchData.items
      .map((item: any) => item.id.videoId)
      .join(",");

    const statsData = await YoutubeAPI("/videos", {
      part: "statistics",
      id: videoIds,
    });

    const videoStatistics: Record<string, any> = {};
    statsData.items?.forEach((item: any) => {
      videoStatistics[item.id] = item.statistics;
    });

    const videosWithStats = searchData.items.map((item: any) => {
      const stats = videoStatistics[item.id.videoId];
      return [
        item.id.videoId,
        item.snippet.title,
        item.snippet.publishedAt.split("T")[0],
        item.snippet.channelTitle,
        Number.parseInt(stats?.viewCount || "0"),
        item.snippet.description || "",
      ];
    });

    allVideos.push(...videosWithStats);
    nextPageToken = searchData.nextPageToken || null;

    console.log(`Fetched ${allVideos.length} videos for ${channelName}`);
  } while (nextPageToken);

  return allVideos;
}
