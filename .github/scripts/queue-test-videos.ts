#!/usr/bin/env bun
/**
 * @fileoverview Prints the SQL that adds curated round videos (records shaped
 * like `video_metadata.json` / `video_metadata_deduplicated.json`) to the
 * admin "Round videos" queue (`youtube_round_videos`),
 * with each round's topic and arguments kept in its description and split
 * into the 1AC / 2NR arguments publishing copies into the library. See
 * `debate-videos-admin/src/sync/videos/curated-round-queue.ts`.
 *
 * Titles and channels come from YouTube's keyless oEmbed endpoint when it
 * answers; otherwise the record's own event and title are used. Rounds
 * already published or removed by an admin are skipped by the SQL itself.
 *
 * Statements are separated by `--> statement-breakpoint`, so the output can be
 * dropped into a package `migrations/` folder and applied by
 * `.github/scripts/migrate-d1.ts` (as
 * `packages/debate-videos-admin/migrations/0002_curated_round_queue.sql` was), or
 * run once by hand.
 *
 * Usage (from the repo root):
 * ```
 * bun run .github/scripts/queue-test-videos.ts video_metadata.json video_metadata_deduplicated.json > queue.sql
 * bun run .github/scripts/queue-test-videos.ts --no-oembed records.json > queue.sql
 * wrangler d1 execute debate-ai-db --remote --file=queue.sql
 * ```
 * @module .github/scripts/queue-test-videos
 */

import {
  buildCuratedQueueStatement,
  curatedRecordToQueueRow,
  uniqueCuratedRecords,
  type CuratedRoundOEmbed,
  type CuratedRoundRecord,
} from "../../packages/debate-videos-admin/src/sync/videos/curated-round-queue";
import { readFileSync } from "node:fs";

async function fetchOEmbed(videoId: string): Promise<CuratedRoundOEmbed | null> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as CuratedRoundOEmbed) : null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const useOEmbed = !args.includes("--no-oembed");
  const files = args.filter((arg) => !arg.startsWith("--"));
  if (!files.length) {
    console.error("usage: queue-test-videos.ts [--no-oembed] <records.json>...");
    process.exit(1);
  }
  const records = uniqueCuratedRecords(
    files.flatMap((file) => JSON.parse(readFileSync(file, "utf8")) as CuratedRoundRecord[]),
  );
  const oembeds = new Map<string, CuratedRoundOEmbed | null>();
  if (useOEmbed) {
    for (let i = 0; i < records.length; i += 8) {
      const batch = records.slice(i, i + 8);
      const results = await Promise.all(batch.map((record) => fetchOEmbed(record.video_id)));
      batch.forEach((record, index) => oembeds.set(record.video_id, results[index]));
    }
  }
  const statements = records.map((record) =>
    buildCuratedQueueStatement(curatedRecordToQueueRow(record, oembeds.get(record.video_id))),
  );
  process.stdout.write(`${statements.join(";\n--> statement-breakpoint\n")};\n`);
  const found = [...oembeds.values()].filter(Boolean).length;
  console.error(`queue-test-videos: ${records.length} rounds${useOEmbed ? `, ${found} with YouTube titles` : ""}`);
}

await main();
