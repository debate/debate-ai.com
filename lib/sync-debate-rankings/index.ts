import { promises as fs } from "fs";
import path from "path";
import { syncYouTubeVideos, syncMissingTopPicks } from "./youtube-sync.js";
import { updateVideoViewCounts } from "./youtube-update-views.js";
import { calculateYouTubeViewStats } from "./youtube-stats.js";

const args = process.argv.slice(2);

if (import.meta.main || require.main === module) {
  if (args.includes("--stats")) {
    console.log("Calculating YouTube view statistics...");
    calculateYouTubeViewStats()
      .then((stats) => {
        console.log("\n" + "=".repeat(80));
        console.log("📊 YOUTUBE VIEW STATISTICS");
        console.log("=".repeat(80) + "\n");

        console.log("📈 Summary:");
        console.log(`   Total Views: ${stats.summary.totalViews.toLocaleString()}`);
        console.log(`   Total Videos: ${stats.summary.totalVideos.toLocaleString()}`);
        console.log(`   Total Channels: ${stats.summary.totalChannels}`);
        console.log(`   Total Debate Styles: ${stats.summary.totalDebateStyles}\n`);

        console.log("📺 Top Channels by Views:");
        stats.byChannel.slice(0, 10).forEach((channel, idx) => {
          console.log(
            `   ${idx + 1}. ${channel.channel}: ${channel.totalViews.toLocaleString()} views ` +
            `(${channel.videoCount} videos, avg: ${channel.avgViewsPerVideo.toLocaleString()})`
          );
        });

        console.log("\n🎯 By Debate Style:");
        stats.byDebateStyle.forEach((style) => {
          console.log(
            `   ${style.debateStyle}: ${style.totalViews.toLocaleString()} views ` +
            `(${style.videoCount} videos, avg: ${style.avgViewsPerVideo.toLocaleString()})`
          );
        });

        console.log("\n📅 By Year:");
        stats.byYear.forEach((year) => {
          console.log(
            `   ${year.year}: ${year.totalViews.toLocaleString()} views ` +
            `(${year.videoCount} videos, avg: ${year.avgViewsPerVideo.toLocaleString()})`
          );
        });

        console.log("\n" + "=".repeat(80) + "\n");

        // Save to file
        const outputPath = path.join(process.cwd(), "youtube-stats.json");
        return fs.writeFile(outputPath, JSON.stringify(stats, null, 2))
          .then(() => {
            console.log(`💾 Full statistics saved to: ${outputPath}\n`);
          });
      })
      .catch((err) => {
        console.error("Stats calculation failed:", err);
        process.exit(1);
      });
  } else if (args.includes("--update-views")) {
    const batchSizeArg = args.find((arg) => arg.startsWith("--batch="));
    const batchSize = batchSizeArg ? Number.parseInt(batchSizeArg.split("=")[1]) : 50;

    console.log("Updating video view counts from YouTube API...");
    updateVideoViewCounts(batchSize)
      .then((stats) => {
        console.log("✅ Update completed successfully!");
        console.log(
          `   ${stats.updatedCount} videos updated, ${stats.unchangedCount} unchanged, ${stats.errorCount} errors`
        );
      })
      .catch((err) => {
        console.error("Update failed:", err);
        process.exit(1);
      });
  } else if (args.includes("--missing-top-picks")) {
    console.log("Syncing missing top picks...");
    syncMissingTopPicks()
      .catch((err) => {
        console.error("Missing top picks sync failed:", err);
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
