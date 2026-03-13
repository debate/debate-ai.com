import { promises as fs } from "fs";
import path from "path";
import grab from "grab-url";

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
    "jacobwilkus8697",
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

const publishedAfter = "2025-08-21T00:00:00Z";

const YoutubeAPI = grab.instance({
  baseURL: "https://www.googleapis.com/youtube/v3",
  key: YOUTUBE_API_KEY,
});

async function getChannelId(channelName: string): Promise<string | null> {
  try {
    const data = await YoutubeAPI("/search", {
      part: "snippet",
      type: "channel",
      q: channelName,
    });

    if (data.items && data.items.length > 0) {
      return data.items[0].id.channelId;
    }
    return null;
  } catch (error) {
    console.warn(`Error fetching channel ID for ${channelName}:`, error);
    return null;
  }
}

async function getVideosByIds(videoIds: string[]): Promise<any[]> {
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

async function getVideosForChannel(
  channelId: string,
  channelName: string,
): Promise<any[]> {
  const allVideos: any[] = [];
  let nextPageToken: string | null = null;

  do {
    const searchData: any = await YoutubeAPI("/search", {
      part: "snippet",
      channelId,
      order: "date",
      type: "video",
      maxResults: "50",
      publishedAfter,
      pageToken: nextPageToken ? nextPageToken : undefined,
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

export async function syncMissingTopPicks() {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  const missingFile = path.join(process.cwd(), "missing-top-picks.txt");
  const content = await fs.readFile(missingFile, "utf-8");
  const videoIds = content.split("\n").map((l) => l.trim()).filter(Boolean);

  if (videoIds.length === 0) {
    console.log("No missing video IDs found.");
    return;
  }

  console.log(`Fetching info for ${videoIds.length} missing top picks...`);

  const videos = await getVideosByIds(videoIds);

  const dataDir = path.join(process.cwd(), "lib", "debate-data");
  const roundsPath = path.join(dataDir, "debate-rounds-videos.json");

  const roundsFile = JSON.parse(await fs.readFile(roundsPath, "utf-8"));
  const existingIds = new Set(roundsFile.data.map((v: any[]) => v[0]));
  const newVideos = videos.filter((v) => !existingIds.has(v[0]));

  roundsFile.data.push(...newVideos);

  await fs.writeFile(roundsPath, JSON.stringify(roundsFile, null, 2));

  console.log(`Added ${newVideos.length} videos to debate-rounds-videos.json`);
  console.log(`Skipped ${videos.length - newVideos.length} already present`);

  const notFound = videoIds.filter(
    (id) => !videos.some((v) => v[0] === id),
  );
  if (notFound.length > 0) {
    console.log(`Could not find ${notFound.length} videos on YouTube:`, notFound);
  }

  return { added: newVideos.length, notFound };
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
        console.log(`Fetched ${videos.length} videos from ${channelName} `);
      } else {
        console.log(`Could not find channel ID for ${channelName}`);
      }
    }
  }

  const dataDir = path.join(process.cwd(), "lib", "debate-data");
  const filePaths: Record<string, string> = {
    rounds: path.join(dataDir, "debate-rounds.json"),
    topPicks: path.join(dataDir, "debate-top-picks.json"),
    lectures: path.join(dataDir, "debate-lectures.json"),
  };

  const mergedData: Record<string, any[]> = {};
  for (const category of ["rounds", "lectures", "topPicks"]) {
    let existing = [];
    try {
      if (await fs.stat(filePaths[category]).catch(() => null)) {
        existing = JSON.parse(await fs.readFile(filePaths[category], "utf-8"));
      }
    } catch (e) {
      console.warn(`Could not read existing data for ${category}, starting fresh.`);
    }
    const newVids = newVideos[category] || [];

    const existingIds = new Set(existing.map((v: any[]) => v[0]));
    const uniqueNewVids = newVids.filter((v: any[]) => !existingIds.has(v[0]));

    mergedData[category] = [...uniqueNewVids, ...existing];
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      filePaths[category],
      JSON.stringify(mergedData[category], null, 2),
    );
  }

  const stats = {
    rounds: {
      new: newVideos.rounds.length,
      total: mergedData.rounds.length,
    },
    lectures: {
      new: newVideos.lectures.length,
      total: mergedData.lectures.length,
    },
    topPicks: {
      new: newVideos.topPicks.length,
      total: mergedData.topPicks.length,
    },
  };

  console.log("Video sync completed:", stats);

  return {
    success: true,
    message: "Videos synced successfully",
    stats,
  };
}

const args = process.argv.slice(2);
if (import.meta.main || (require.main === module)) {
  if (args.includes("--missing-top-picks")) {
    console.log("Fetching missing top picks...");
    syncMissingTopPicks().catch((err) => {
      console.error("Sync failed:", err);
      process.exit(1);
    });
  } else {
    console.log("Syncing YouTube videos...");
    syncYouTubeVideos().catch((err) => {
      console.error("Sync failed:", err);
      process.exit(1);
    });
  }
}
