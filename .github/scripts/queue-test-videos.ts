#!/usr/bin/env bun
/**
 * @fileoverview Prints the SQL that adds the curated round videos in the root
 * `test/` folder to the admin "Round videos" queue (`youtube_round_videos`),
 * with each round's topic and arguments kept in its description and split
 * into the 1AC / 2NR arguments publishing copies into the library. See
 * `debate-data-sync/src/videos/curated-round-queue.ts`.
 *
 * Titles and channels come from YouTube's keyless oEmbed endpoint when it
 * answers; otherwise the record's own event and title are used. Rounds
 * already published or removed by an admin are skipped by the SQL itself.
 *
 * Usage (from the repo root):
 * ```
 * bun run .github/scripts/queue-test-videos.ts > queue.sql
 * bun run .github/scripts/queue-test-videos.ts --no-oembed > queue.sql
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
} from "../../packages/debate-data-sync/src/videos/curated-round-queue";
import metadata from "../../test/video_metadata.json" with { type: "json" };
import deduplicated from "../../test/video_metadata_deduplicated.json" with { type: "json" };

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
  const useOEmbed = !process.argv.includes("--no-oembed");
  const records = uniqueCuratedRecords([...metadata, ...deduplicated] as CuratedRoundRecord[]);
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
  process.stdout.write(`${statements.join(";\n\n")};\n`);
  const found = [...oembeds.values()].filter(Boolean).length;
  console.error(`queue-test-videos: ${records.length} rounds${useOEmbed ? `, ${found} with YouTube titles` : ""}`);
}

await main();
