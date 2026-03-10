import { promises as fs } from "fs";
import path from "path";


const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const categories = {
  rounds: [
    "su.debate",
    "ResolvedDebate",
    "PolicyDebateCentral-gv1nl",
    "pfvideos9234",
    "ddidebate4071",
    "DebateStreamDB8",
  ],
  lectures: [
    "thatdebatekid5313",
    "NSD_DebateCamp",
    "ddidebate4071",
    "pfvideos9234",
    "lasadebate",
    "DebateStreamDB8",
    "CEDADebate",
    "KentuckyDebate",
    "sailorferrets",
    "wakedebate8636",
    "exodusfiles3478",
    "SolvencyAdvocate",
    "northbrowardmr4523",
    "TexasDebate",
    "jacob_wilkus",
    "arvindshankar2481",
    "NDT-jl6oi",
    "atrujillo9",
    "UNTDebate",
    "vintagedebatevids",
    "georgetowndebateseminar1234",
    "barkleyforumvideos3220",
    "BillBatterman",
    "msudebate6544",
    "ProfessorGraham",
    "michigandebate7440",
  ],
};

const publishedAfter = "2025-11-21T00:00:00Z";



async function getChannelId(channelName: string): Promise<string | null> {
  try {
    // Use the correct endpoint path for the YouTube API search
    const data = await youtubeFetch("/search", {
      params: {
        part: "snippet",
        type: "channel",
        q: channelName,
      },
    });
    if (data.items && data.items.length > 0) {
      return data.items[0].id.channelId;
    }
    return null;
  } catch (err: any) {
    console.warn(
      `Skipping ${channelName}: ${err?.response?.status ?? err?.message}`,
    );
    return null;
  }
}

async function getVideosForChannel(
  channelId: string,
  channelName: string,
): Promise<any[]> {
  const allVideos: any[] = [];
  let nextPageToken: string | null = null;

  do {
    let searchData: any;
    try {
      const data = await youtubeFetch("/search", {
        part: "snippet",
        channelId,
        order: "date",
        type: "video",
        maxResults: 50,
        publishedAfter,
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      });
      searchData = data;
    } catch (err: any) {
      console.warn(
        `Skipping videos for ${channelName}: ${err?.response?.status ?? err?.message}`,
      );
      break;
    }

    if (!searchData.items || searchData.items.length === 0) break;

    const videoIds = searchData.items
      .map((item: any) => item.id.videoId)
      .join(",");

    let statsData: any = { items: [] };
    try {
      const data = await youtubeFetch("/videos", {
        part: "statistics",
        id: videoIds,
      });
      statsData = data;
    } catch (err: any) {
      console.warn(
        `Could not fetch stats for ${channelName}: ${err?.response?.status ?? err?.message}`,
      );
    }

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

export async function syncYouTubeVideos() {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  console.log("Starting video sync...");

  const newVideos: Record<string, any[]> = {
    rounds: [],
    lectures: [],
    topPicks: [],
  };

  for (const [category, channels] of Object.entries(categories)) {
    for (const channelName of channels) {
      const channelId = await getChannelId(channelName);
      if (channelId) {
        const videos = await getVideosForChannel(channelId, channelName);
        newVideos[category].push(...videos);
        console.log(`Fetched ${videos.length} videos from ${channelName}`);
      } else {
        console.log(`Could not find channel ID for ${channelName}`);
      }
    }
  }

  return newVideos;
}

if (require.main === module) {
  console.log("Syncing YouTube videos...");
  syncYouTubeVideos().then(async (videos) => {
    const outputDir = path.join(process.cwd(), "output");
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(
      path.join(outputDir, "debate-rounds.json"),
      JSON.stringify(videos.rounds, null, 2),
    );
    await fs.writeFile(
      path.join(outputDir, "debate-lectures.json"),
      JSON.stringify(videos.lectures, null, 2),
    );
    await fs.writeFile(
      path.join(outputDir, "debate-top-picks.json"),
      JSON.stringify(videos.topPicks, null, 2),
    );

    console.log(
      `Written: ${videos.rounds.length} rounds, ${videos.lectures.length} lectures, ${videos.topPicks.length} top picks`,
    );
  });
}
