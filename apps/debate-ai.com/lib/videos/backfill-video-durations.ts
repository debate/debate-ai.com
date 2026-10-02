/**
 * @fileoverview Fetches every stored video's length from YouTube and keeps it
 * in `video_durations`, so the library can be totalled in hours.
 *
 * Covers both video tables — the published `videos` table (rounds, lectures
 * and top picks) and the `youtube_round_videos` admin queue — by id, so a
 * round that is queued and published alike is fetched once.
 *
 * A run is one page of ids, walked in id order with a cursor: the admin
 * button calls it repeatedly until `nextCursor` comes back `null`. Paging
 * keeps each request well inside the Worker's subrequest budget, and the
 * cursor (rather than "whatever still has no duration") guarantees the walk
 * ends even when YouTube never returns some ids — deleted and private videos
 * simply stay without a duration. By default only ids that have no duration
 * yet are fetched, so re-running after new videos land costs a request or
 * two; `refresh` refetches everything.
 * @module lib/videos/backfill-video-durations
 */

import { sql } from "drizzle-orm";
import { sqlLiteral } from "@debate/data-sync/src/videos/video-seed-sql";
import {
  fetchVideoDurations,
  setYouTubeApiKey,
} from "@debate/data-sync/src/youtube/youtube-api";
import { getEnv } from "@/lib/env";

/** Default ids per run: 40 YouTube requests, a handful of D1 writes. */
export const DURATION_PAGE_SIZE = 2000;

/** Rows per `INSERT` — values are inlined, so statement size is the limit. */
const WRITE_BATCH = 200;

/** Options for one backfill page. */
export interface DurationBackfillOptions {
  /** Resume after this video id; omit to start from the beginning. */
  after?: string | null;
  /** Ids to fetch this run. Defaults to {@link DURATION_PAGE_SIZE}. */
  limit?: number;
  /** Refetch ids that already have a duration, not just the missing ones. */
  refresh?: boolean;
}

/** Library-wide duration coverage and total running time. */
export interface DurationStatus {
  /** Distinct video ids across `videos` and the round queue. */
  videos: number;
  /** Ids with a stored duration. */
  withDuration: number;
  /** Ids still without one. */
  withoutDuration: number;
  /** Summed length of every published video, in seconds. */
  publishedSeconds: number;
  /** Summed length of every queued video, in seconds. */
  queuedSeconds: number;
  /** Summed length across both tables, each id counted once. */
  totalSeconds: number;
}

/** Outcome of one backfill page. */
export interface DurationBackfillResult {
  /** Ids asked of YouTube this run. */
  checked: number;
  /** Durations written. */
  stored: number;
  /** Ids YouTube returned nothing for — deleted or private. */
  missing: number;
  /** Cursor for the next page, or `null` when the walk is finished. */
  nextCursor: string | null;
  /** Coverage and totals after this run. See {@link DurationStatus}. */
  status: DurationStatus;
  /** Milliseconds the run took. */
  durationMs: number;
}

/**
 * Creates `video_durations` if this database does not have it yet.
 *
 * Production D1 only receives schema changes through migrations that are no
 * longer tracked in the repo, so the action that needs the table brings it.
 */
export async function ensureVideoDurationsTable(db: any): Promise<void> {
  await db.run(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS "video_durations" ("video_id" text PRIMARY KEY NOT NULL, "duration_seconds" integer NOT NULL, "fetched_at" integer DEFAULT (unixepoch()) NOT NULL)`,
    ),
  );
}

/** Every stored id, published or queued, deduplicated. */
const ALL_IDS = `SELECT "video_id" AS id FROM "videos" UNION SELECT "id" AS id FROM "youtube_round_videos"`;

/**
 * Reads coverage and total running time.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 */
export async function getVideoDurationStatus(db: any): Promise<DurationStatus> {
  await ensureVideoDurationsTable(db);
  const [row] = (await db.all(
    sql.raw(
      `SELECT
        (SELECT COUNT(*) FROM (${ALL_IDS})) AS videos,
        (SELECT COUNT(*) FROM (${ALL_IDS}) a JOIN "video_durations" d ON d."video_id" = a.id) AS withDuration,
        (SELECT COALESCE(SUM(d."duration_seconds"), 0) FROM "videos" v JOIN "video_durations" d ON d."video_id" = v."video_id") AS publishedSeconds,
        (SELECT COALESCE(SUM(d."duration_seconds"), 0) FROM "youtube_round_videos" q JOIN "video_durations" d ON d."video_id" = q."id") AS queuedSeconds,
        (SELECT COALESCE(SUM(d."duration_seconds"), 0) FROM (${ALL_IDS}) a JOIN "video_durations" d ON d."video_id" = a.id) AS totalSeconds`,
    ),
  )) as Array<Record<string, number | null>>;

  const videos = Number(row?.videos ?? 0);
  const withDuration = Number(row?.withDuration ?? 0);
  return {
    videos,
    withDuration,
    withoutDuration: videos - withDuration,
    publishedSeconds: Number(row?.publishedSeconds ?? 0),
    queuedSeconds: Number(row?.queuedSeconds ?? 0),
    totalSeconds: Number(row?.totalSeconds ?? 0),
  };
}

/**
 * Fetches durations for one page of ids and stores them.
 *
 * @param db - Drizzle handle bound to D1 (or local SQLite in development).
 * @param options - Cursor, page size and refresh mode. See
 *   {@link DurationBackfillOptions}.
 * @returns What this page did, and the cursor for the next one.
 * @throws When no YouTube API key is configured or YouTube declines a
 *   request; nothing from the failed batch is written.
 */
export async function backfillVideoDurations(
  db: any,
  options: DurationBackfillOptions = {},
): Promise<DurationBackfillResult> {
  const apiKey = getEnv("YOUTUBE_API_KEY");
  if (!apiKey) {
    throw new Error("YouTube API key not configured");
  }
  // See resync-view-counts.ts: the Worker's key lives on `env`, not
  // `process.env`, so the shared client has to be handed it.
  setYouTubeApiKey(apiKey);

  const startedAt = Date.now();
  await ensureVideoDurationsTable(db);

  const limit = Math.max(1, Math.min(options.limit ?? DURATION_PAGE_SIZE, DURATION_PAGE_SIZE));
  const conditions: string[] = [];
  if (options.after) conditions.push(`a.id > ${sqlLiteral(options.after)}`);
  if (!options.refresh) conditions.push(`d."video_id" IS NULL`);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = (await db.all(
    sql.raw(
      `SELECT a.id AS id FROM (${ALL_IDS}) a LEFT JOIN "video_durations" d ON d."video_id" = a.id ${where} ORDER BY a.id LIMIT ${limit}`,
    ),
  )) as Array<{ id: string }>;
  const ids = rows.map((row) => row.id).filter(Boolean);

  const { durations, missing } =
    ids.length > 0 ? await fetchVideoDurations(ids) : { durations: {}, missing: [] };

  const entries = Object.entries(durations);
  for (let i = 0; i < entries.length; i += WRITE_BATCH) {
    const values = entries
      .slice(i, i + WRITE_BATCH)
      .map(([id, seconds]) => `(${sqlLiteral(id)}, ${sqlLiteral(seconds)}, unixepoch())`)
      .join(", ");
    await db.run(
      sql.raw(
        `INSERT INTO "video_durations" ("video_id", "duration_seconds", "fetched_at") VALUES ${values} ON CONFLICT ("video_id") DO UPDATE SET "duration_seconds" = excluded."duration_seconds", "fetched_at" = excluded."fetched_at"`,
      ),
    );
  }

  return {
    checked: ids.length,
    stored: entries.length,
    missing: missing.length,
    nextCursor: ids.length === limit ? ids[ids.length - 1] : null,
    status: await getVideoDurationStatus(db),
    durationMs: Date.now() - startedAt,
  };
}
