import { promises as fs } from "fs";
import path from "path";
import { YoutubeAPI } from "./youtube-api";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Update view counts for all videos in the database using YouTube API
 * Includes progress tracking and automatic checkpointing
 * @param batchSize Number of videos to process in each batch (max 50)
 * @returns Statistics about the update process
 */
export async function updateVideoViewCounts(batchSize = 50) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  const dataDir = path.join(process.cwd(), "lib", "debate-data");
  const progressFile = path.join(process.cwd(), "youtube-update-progress.json");

  // Load existing data
  const roundsPath = path.join(dataDir, "debate-rounds-videos.json");
  const lecturesPath = path.join(dataDir, "debate-lectures.json");

  const roundsData = JSON.parse(await fs.readFile(roundsPath, "utf-8"));
  const lecturesData = JSON.parse(await fs.readFile(lecturesPath, "utf-8"));

  // Combine all videos
  const allVideos = [
    ...roundsData.data.map((v: any[], idx: number) => ({
      type: "rounds" as const,
      index: idx,
      videoId: v[0],
      oldViews: v[4],
      data: v,
    })),
    ...lecturesData.data.map((v: any[], idx: number) => ({
      type: "lectures" as const,
      index: idx,
      videoId: v[0],
      oldViews: v[4],
      data: v,
    })),
  ];

  // Load progress if exists
  let progress = {
    lastProcessedIndex: -1,
    processedCount: 0,
    updatedCount: 0,
    errorCount: 0,
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString(),
  };

  try {
    const progressData = await fs.readFile(progressFile, "utf-8");
    progress = JSON.parse(progressData);
    console.log(
      `\n📂 Resuming from progress: ${progress.processedCount}/${allVideos.length} videos processed\n`
    );
  } catch {
    console.log("\n🆕 Starting fresh update process\n");
  }

  const startIndex = progress.lastProcessedIndex + 1;
  const videosToProcess = allVideos.slice(startIndex);

  console.log(`📹 Total videos to process: ${videosToProcess.length}`);
  console.log(`📦 Batch size: ${batchSize}\n`);

  // Process in batches
  for (let i = 0; i < videosToProcess.length; i += batchSize) {
    const batch = videosToProcess.slice(i, Math.min(i + batchSize, videosToProcess.length));
    const videoIds = batch.map((v) => v.videoId).join(",");

    try {
      console.log(
        `🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(videosToProcess.length / batchSize)} ` +
        `(videos ${startIndex + i + 1}-${startIndex + i + batch.length})`
      );

      const data = await YoutubeAPI("/videos", {
        part: "statistics",
        id: videoIds,
      });

      if (data.items) {
        // Update view counts
        for (const item of data.items) {
          const videoId = item.id;
          const newViews = Number.parseInt(item.statistics?.viewCount || "0");
          const video = batch.find((v) => v.videoId === videoId);

          if (video) {
            const oldViews = video.oldViews;
            const viewDiff = newViews - oldViews;

            // Update the data
            video.data[4] = newViews;

            // Update in the appropriate dataset
            if (video.type === "rounds") {
              roundsData.data[video.index] = video.data;
            } else {
              lecturesData.data[video.index] = video.data;
            }

            if (viewDiff !== 0) {
              progress.updatedCount++;
              console.log(
                `  ✅ ${videoId}: ${oldViews.toLocaleString()} → ${newViews.toLocaleString()} ` +
                `(${viewDiff > 0 ? "+" : ""}${viewDiff.toLocaleString()})`
              );
            }

            progress.lastProcessedIndex = startIndex + i + batch.indexOf(video);
          }
        }

        progress.processedCount += batch.length;
      } else {
        console.log(`  ⚠️  No data returned for batch`);
        progress.errorCount += batch.length;
      }
    } catch (error) {
      console.error(`  ❌ Error processing batch:`, error);
      progress.errorCount += batch.length;
    }

    // Save progress after each batch
    progress.lastUpdateTime = new Date().toISOString();
    await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));

    // Save updated data files after each batch
    await fs.writeFile(roundsPath, JSON.stringify(roundsData, null, 2));
    await fs.writeFile(lecturesPath, JSON.stringify(lecturesData, null, 2));

    console.log(
      `  💾 Progress saved: ${progress.processedCount}/${allVideos.length} ` +
      `(${progress.updatedCount} updated, ${progress.errorCount} errors)\n`
    );

    // Small delay to avoid rate limiting
    if (i + batchSize < videosToProcess.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Final statistics
  const stats = {
    totalVideos: allVideos.length,
    processedCount: progress.processedCount,
    updatedCount: progress.updatedCount,
    errorCount: progress.errorCount,
    unchangedCount: progress.processedCount - progress.updatedCount - progress.errorCount,
    startTime: progress.startTime,
    endTime: new Date().toISOString(),
  };

  // Clean up progress file on successful completion
  if (progress.processedCount === allVideos.length) {
    try {
      await fs.unlink(progressFile);
      console.log("✨ Progress file removed (update complete)\n");
    } catch {
      // Ignore if file doesn't exist
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ VIDEO VIEW UPDATE COMPLETED");
  console.log("=".repeat(80));
  console.log(JSON.stringify(stats, null, 2));
  console.log("=".repeat(80) + "\n");

  return stats;
}
