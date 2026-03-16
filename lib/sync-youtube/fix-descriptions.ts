import { promises as fs } from "fs";
import path from "path";
import { fetchFullDescriptions } from "./lib/sync-debate-sites/youtube-api";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: bun run fix-descriptions.ts <path-to-json>");
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);
  const raw = JSON.parse(await fs.readFile(fullPath, "utf-8"));

  // Support both plain arrays and { data: [...] } wrapper
  const isWrapped = !Array.isArray(raw) && Array.isArray(raw.data);
  const videos: any[][] = isWrapped ? raw.data : raw;

  // Find videos with truncated descriptions
  const truncated = videos.filter((v) => v[5]?.endsWith("..."));
  console.log(`Found ${truncated.length} videos with truncated descriptions out of ${videos.length} total`);

  if (truncated.length === 0) {
    console.log("No truncated descriptions to fix.");
    return;
  }

  const videoIds = truncated.map((v) => v[0]);
  const descriptions = await fetchFullDescriptions(videoIds);

  let updated = 0;
  for (const video of videos) {
    if (descriptions[video[0]] !== undefined && video[5]?.endsWith("...")) {
      video[5] = descriptions[video[0]];
      updated++;
    }
  }

  await fs.writeFile(fullPath, JSON.stringify(isWrapped ? raw : videos, null, 2));
  console.log(`Updated ${updated} descriptions. ${videoIds.length - updated} not found on YouTube.`);
}

main().catch(console.error);
