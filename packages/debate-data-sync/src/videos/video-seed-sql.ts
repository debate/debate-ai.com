/**
 * @fileoverview Builds the SQL that loads the video JSON assets into the
 * `videos` table.
 *
 * Shared by the CLI seed script (`apps/debate-ai.com/scripts/seed-videos.ts`,
 * which writes a `.sql` file for `wrangler d1 execute`) and the admin seed
 * endpoint (which runs the same statements straight against the D1 binding
 * from inside the Worker). Values are escaped here, in code, so both callers
 * produce identical statements.
 * @module videos/video-seed-sql
 */

import type { VideoRow } from "./video-rows";

/** Column order used by every generated `INSERT`. */
export const VIDEO_SEED_COLUMNS = [
  "video_id",
  "source",
  "title",
  "published_at",
  "published_ms",
  "channel",
  "view_count",
  "description",
  "style",
  "category",
  "category_key",
  "tournament",
  "round_level",
  "aff_team",
  "neg_team",
  "aff_win",
  "judge_decision",
  "arg_1ac",
  "arg_2nr",
  "is_top_pick",
  "speech_docs_url",
  "season_year",
  "search_text",
] as const;

/**
 * Rows per multi-row `INSERT`. Values are inlined rather than bound, so the
 * binding parameter limit does not apply — statement *size* is the real
 * constraint, hence {@link DEFAULT_MAX_STATEMENT_BYTES}.
 */
export const DEFAULT_ROWS_PER_STATEMENT = 50;

/**
 * Byte ceiling for one generated statement.
 *
 * D1 rejects a SQL statement over 100 KB, and video descriptions vary enough
 * that a fixed row count is no guarantee: 100 rows of the widest descriptions
 * produce ~112 KB. Batching on bytes keeps every statement comfortably under
 * the limit, and since the largest single row is ~9 KB, no row is ever too
 * big to place.
 */
export const DEFAULT_MAX_STATEMENT_BYTES = 50_000;

/** Batching limits for {@link buildVideoSeedStatements}. */
export interface VideoSeedOptions {
  /** Hard cap on rows per statement. */
  maxRows?: number;
  /** Approximate byte cap on one statement's `VALUES` list. */
  maxBytes?: number;
}

/**
 * Renders a value as a SQLite literal, doubling quotes in text.
 *
 * @param value - Column value.
 * @returns The literal, or `NULL`.
 */
export function sqlLiteral(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Projects a row onto {@link VIDEO_SEED_COLUMNS}, in order.
 *
 * @param row - The video row.
 * @returns Column values, positionally matching the column list.
 */
export function videoSeedValues(row: VideoRow): (string | number | boolean | null)[] {
  return [
    row.videoId,
    row.source,
    row.title,
    row.publishedAt,
    row.publishedMs,
    row.channel,
    row.viewCount,
    row.description,
    row.style,
    row.category,
    row.categoryKey,
    row.tournament,
    row.roundLevel,
    row.affTeam,
    row.negTeam,
    row.affWin,
    row.judgeDecision,
    row.arg1ac,
    row.arg2nr,
    row.isTopPick,
    row.speechDocsUrl,
    row.seasonYear,
    row.searchText,
  ];
}

/**
 * Builds the seed statements: upsert every row, then prune anything the JSON
 * no longer carries.
 *
 * Batches are bounded by both row count and byte size, because a statement
 * over D1's 100 KB limit is rejected outright and description lengths vary
 * by two orders of magnitude.
 *
 * Every row present in the assets is stamped with the current time by the
 * upsert, so a row still older than `seededAt` has been removed upstream and
 * is deleted. That makes a re-run mirror the assets exactly without ever
 * emptying the table mid-run.
 *
 * @param rows - Rows built from the JSON assets.
 * @param seededAt - Unix seconds captured before the upserts; the prune threshold.
 * @param options - Batching limits. See {@link VideoSeedOptions}.
 * @returns One SQL statement per array entry, without trailing semicolons.
 */
export function buildVideoSeedStatements(
  rows: VideoRow[],
  seededAt: number,
  options: VideoSeedOptions = {},
): string[] {
  const maxRows = Math.max(1, options.maxRows ?? DEFAULT_ROWS_PER_STATEMENT);
  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_MAX_STATEMENT_BYTES);

  const statements: string[] = [];
  const columnList = VIDEO_SEED_COLUMNS.map((c) => `"${c}"`).join(", ");
  const updateList = VIDEO_SEED_COLUMNS.filter((c) => c !== "video_id")
    .map((c) => `"${c}" = excluded."${c}"`)
    .join(", ");

  let batch: string[] = [];
  let bytes = 0;

  const flush = () => {
    if (batch.length === 0) return;
    statements.push(
      `INSERT INTO "videos" (${columnList}) VALUES\n  ${batch.join(",\n  ")}\n` +
        `ON CONFLICT("video_id") DO UPDATE SET ${updateList}, "updated_at" = unixepoch()`,
    );
    batch = [];
    bytes = 0;
  };

  for (const row of rows) {
    const values = `(${videoSeedValues(row).map(sqlLiteral).join(", ")})`;
    // Flush first when this row would overflow, so a single oversized row
    // still gets a statement of its own rather than being dropped.
    if (batch.length > 0 && (batch.length >= maxRows || bytes + values.length > maxBytes)) {
      flush();
    }
    batch.push(values);
    bytes += values.length + 4;
  }
  flush();

  statements.push(`DELETE FROM "videos" WHERE "updated_at" < ${seededAt}`);

  return statements;
}
