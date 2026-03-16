import { promises as fs } from "fs";
import path from "path";

const categoryMap: Record<number, string> = {
  1: "rounds-policy",
  2: "rounds-pf",
  3: "rounds-ld",
  4: "rounds-college",
};

async function main() {
  const dataDir = path.join(process.cwd(), "lib", "debate-data");
  const inputPath = path.join(dataDir, "debate-rounds-videos.json");
  const raw = JSON.parse(await fs.readFile(inputPath, "utf-8"));
  const videos: any[][] = raw.data;

  const buckets: Record<number, any[][]> = { 1: [], 2: [], 3: [], 4: [] };

  for (const video of videos) {
    const cat = video[6];
    if (buckets[cat]) {
      buckets[cat].push(video);
    } else {
      console.warn(`Unknown category ${cat} for video ${video[0]}`);
    }
  }

  for (const [cat, name] of Object.entries(categoryMap)) {
    const data = buckets[Number(cat)];
    const outPath = path.join(dataDir, `${name}.json`);
    await fs.writeFile(outPath, JSON.stringify({
      "$schema": "./schemas/debate-rounds-videos.schema.json",
      data,
    }, null, 2));
    console.log(`${name}.json: ${data.length} videos`);
  }

  console.log(`\nTotal: ${videos.length}`);
}

main().catch(console.error);
