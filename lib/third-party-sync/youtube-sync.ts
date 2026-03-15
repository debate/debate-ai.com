import { promises as fs } from "fs";
import path from "path";
import { getChannelId, getVideosForChannel, getVideosByIds } from "./youtube-api";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const categories = {
  rounds: [
    "LynbrookDebate",
  ],
};

const publishedAfter = "2023-03-01T00:00:00Z";

export async function syncMissingTopPicks() {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  const missingFile = path.join(process.cwd(), "missing-top-picks.txt");
  const content = await fs.readFile(missingFile, "utf-8");
  const videoIds = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

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

  const notFound = videoIds.filter((id) => !videos.some((v) => v[0] === id));
  if (notFound.length > 0) {
    console.log(
      `Could not find ${notFound.length} videos on YouTube:`,
      notFound,
    );
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
        const videos = await getVideosForChannel(channelId, channelName, publishedAfter);
        newVideos[category].push(...videos);
        console.log(`Fetched ${videos.length} videos from ${channelName} `);
      } else {
        console.log(`Could not find channel ID for ${channelName}`);
      }
    }
  }

  // Combine all videos from all categories into one array
  const allVideos = [
    ...newVideos.rounds,
    ...newVideos.lectures,
    ...newVideos.topPicks,
  ];

  console.log("\n" + "=".repeat(60));
  console.log("💾 SAVING ALL VIDEOS TO new-videos.json");
  console.log("=".repeat(60) + "\n");

  console.log(`📹 Total videos fetched: ${allVideos.length}`);
  console.log(`   Rounds: ${newVideos.rounds.length}`);
  console.log(`   Lectures: ${newVideos.lectures.length}`);
  console.log(`   Top Picks: ${newVideos.topPicks.length}`);

  const outputPath = path.join(process.cwd(), "new-videos.json");

  await fs.writeFile(
    outputPath,
    JSON.stringify(allVideos, null, 2),
  );

  console.log(`\n💾 Saved all videos to: ${outputPath}`);
  console.log(`📦 Total videos: ${allVideos.length}`);

  const stats = {
    total: allVideos.length,
    byCategory: {
      rounds: newVideos.rounds.length,
      lectures: newVideos.lectures.length,
      topPicks: newVideos.topPicks.length,
    },
    outputFile: outputPath,
  };

  console.log("\n" + "=".repeat(60));
  console.log("✅ VIDEO SYNC COMPLETED");
  console.log("=".repeat(60));
  console.log(JSON.stringify(stats, null, 2));
  console.log("=".repeat(60) + "\n");

  return {
    success: true,
    message: "Videos synced successfully",
    stats,
  };
}
