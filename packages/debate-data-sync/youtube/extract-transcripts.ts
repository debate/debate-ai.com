/**
 * Extract transcripts for all lectures using extract-youtube.
 * Reads debate-lectures.json, fetches transcripts for each video,
 * and saves them to data/transcripts.json as { videoId: transcriptText }
 *
 * Usage:
 *   bun run youtube/extract-transcripts.ts [--limit=50] [--overwrite]
 */

import { promises as fs } from "fs";
import path from "path";
import { YouTubeTranscriptApi } from "../node_modules/extract-youtube/src/youtube-transcript-api";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;
const overwrite = args.includes("--overwrite");

const dataDir = path.join(
  path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1"),
  "..",
  "data",
);
const lecturesPath = path.join(dataDir, "videos", "debate-lectures.json");
const transcriptsPath = path.join(dataDir, "transcripts.json");

async function main() {
  const lecturesFile = JSON.parse(await fs.readFile(lecturesPath, "utf-8"));
  const lectures: any[] = lecturesFile.data ?? lecturesFile;

  const toProcess = limit < Infinity ? lectures.slice(0, limit) : lectures;
  console.log(`Processing ${toProcess.length} lectures...`);

  // Load existing transcripts
  let existing: Record<string, { text: string; start: number; duration: number }[]> = {};
  try {
    existing = JSON.parse(await fs.readFile(transcriptsPath, "utf-8"));
    console.log(`Loaded ${Object.keys(existing).length} existing transcripts`);
  } catch {
    console.log("No existing transcripts.json, starting fresh");
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;
  const total = toProcess.length;
  const startTime = Date.now();

  const api = new YouTubeTranscriptApi();

  for (let i = 0; i < toProcess.length; i++) {
    const lecture = toProcess[i];
    const [id, title] = lecture;

    if (!overwrite && existing[id]) {
      skipped++;
      continue;
    }

    try {
      const transcript = await api.fetchTranscript(id);
      existing[id] = transcript.snippets.map((s) => ({
        text: typeof s.text === "string" ? s.text : "",
        start: s.start,
        duration: s.duration,
      }));

      const done = success + skipped + failed + 1;
      const pct = ((done / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (success + 1) / ((Date.now() - startTime) / 1000);
      const eta = ((total - done) / rate).toFixed(0);
      console.log(`[${done}/${total} ${pct}% | ${elapsed}s | ~${eta}s left] ✓ ${id} — ${title.slice(0, 50)}`);
      success++;
    } catch (err: any) {
      console.warn(`[${i + 1}/${total}] ✗ ${id} — ${title.slice(0, 50)}: ${err?.message ?? err}`);
      failed++;
    }
  }

  await fs.writeFile(transcriptsPath, JSON.stringify(existing, null, 2));

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${totalElapsed}s: ${success} saved, ${skipped} skipped, ${failed} failed`);
  console.log(`Transcripts written to: ${transcriptsPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
