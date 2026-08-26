/**
 * @fileoverview Loads the bundled video JSON assets into the `videos` table
 * from inside the Worker.
 *
 * The CLI script (`scripts/seed-videos.ts`) needs a machine with wrangler
 * credentials; this runs the same shared statements against the request's own
 * D1 binding, so a deploy can be seeded from the admin page instead. Both
 * paths build their SQL with `buildVideoSeedStatements`, so they load
 * identical data.
 * @module lib/videos/seed-videos-to-db
 */

import { sql } from "drizzle-orm";
import { buildVideoSeedStatements } from "debate-data-sync/src/videos/video-seed-sql";
import { getVideoRowsFromJson } from "./video-json-source";

/** Outcome of one seed run. */
export interface VideoSeedResult {
  /** Rows built from the JSON assets and upserted. */
  rows: number;
  /** Number of SQL statements executed (upsert batches plus the prune). */
  statements: number;
  /** Milliseconds the run took. */
  durationMs: number;
}

/**
 * Batching limits. Values are inlined rather than bound, so D1's per-query
 * parameter limit does not apply — but its 100 KB statement limit does, and
 * descriptions vary enough that only a byte budget reliably stays under it.
 */
const SEED_BATCH = { maxRows: 100, maxBytes: 50_000 };

/**
 * Upserts every video from the bundled JSON assets into the `videos` table,
 * then prunes rows the assets no longer carry.
 *
 * Safe to re-run: rows are keyed by video id, and the prune only removes rows
 * this run did not touch.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @returns Counts and timing for the run. See {@link VideoSeedResult}.
 */
export async function seedVideosIntoDb(db: any): Promise<VideoSeedResult> {
  const startedAt = Date.now();
  const rows = await getVideoRowsFromJson();
  const statements = buildVideoSeedStatements(rows, Math.floor(startedAt / 1000), SEED_BATCH);

  for (const statement of statements) {
    await db.run(sql.raw(statement));
  }

  return {
    rows: rows.length,
    statements: statements.length,
    durationMs: Date.now() - startedAt,
  };
}
