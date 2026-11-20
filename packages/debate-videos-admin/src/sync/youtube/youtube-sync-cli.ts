/**
 * @deprecated This file is kept for backward compatibility.
 * Please use the individual modules instead:
 * - youtube-api.ts for API functions
 * - youtube-sync.ts for sync functions
 * - youtube-update-views.ts for view update functions
 * - index.ts for CLI entry point
 */

// Re-export all functions for backward compatibility
export { syncYouTubeVideos } from "./youtube-sync";
export { updateVideoViewCounts } from "./youtube-update-views";

// Import for CLI
import { syncYouTubeVideos } from "./youtube-sync";
import { updateVideoViewCounts } from "./youtube-update-views";

const args = process.argv.slice(2);
if (import.meta.main || require.main === module) {
  if (args.includes("--update-views")) {
    const batchSizeArg = args.find((arg) => arg.startsWith("--batch="));
    const batchSize = batchSizeArg
      ? Number.parseInt(batchSizeArg.split("=")[1])
      : 50;

    console.log("Updating video view counts from YouTube API...");
    updateVideoViewCounts(batchSize)
      .then((stats) => {
        console.log("✅ Update completed successfully!");
        console.log(
          `   ${stats.updatedCount} videos updated, ${stats.unchangedCount} unchanged, ${stats.errorCount} errors`,
        );
      })
      .catch((err) => {
        console.error("Update failed:", err);
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
