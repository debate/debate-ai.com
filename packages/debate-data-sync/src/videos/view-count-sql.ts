/**
 * @fileoverview Builds the SQL that writes refreshed YouTube view counts back
 * into a video table.
 *
 * Counterpart to `video-seed-sql.ts`: the seed rewrites whole rows from the
 * JSON assets, while this touches one column so a "resync view counts" run
 * does not have to re-send titles and descriptions it did not fetch. Values
 * are inlined (via the seed builder's {@link sqlLiteral}) rather than bound,
 * so D1's per-statement parameter limit does not apply — statement *size*
 * does, hence the byte budget below.
 * @module videos/view-count-sql
 */

import { sqlLiteral } from "./video-seed-sql";

/** One video's freshly fetched view count. */
export interface ViewCountUpdate {
  /** YouTube video id, matching the target table's id column. */
  videoId: string;
  /** View count as reported by the YouTube API. */
  viewCount: number;
}

/** Which table and columns an update batch writes to. */
export interface ViewCountTarget {
  table: string;
  /** Primary-key column holding the YouTube video id. */
  idColumn: string;
  /** Integer column holding the view count. */
  viewColumn: string;
  /** Timestamp column stamped with `unixepoch()`, when the table has one. */
  updatedAtColumn?: string;
}

/** The public feed's table — what `/api/videos` reads when seeded. */
export const VIDEOS_VIEW_COUNT_TARGET: ViewCountTarget = {
  table: "videos",
  idColumn: "video_id",
  viewColumn: "view_count",
  updatedAtColumn: "updated_at",
};

/** The admin resync queue, whose rows are not published yet. */
export const ROUND_QUEUE_VIEW_COUNT_TARGET: ViewCountTarget = {
  table: "youtube_round_videos",
  idColumn: "id",
  viewColumn: "views",
  updatedAtColumn: "updated_at",
};

/**
 * Updates per statement. A `CASE` arm is ~30 bytes, so the row cap — not the
 * byte cap — is what normally closes a batch here.
 */
export const DEFAULT_UPDATES_PER_STATEMENT = 100;

/** Byte ceiling for one generated statement, well under D1's 100 KB limit. */
export const DEFAULT_MAX_STATEMENT_BYTES = 50_000;

/** Batching limits for {@link buildViewCountUpdateStatements}. */
export interface ViewCountUpdateOptions {
  /** Hard cap on updates per statement. */
  maxRows?: number;
  /** Approximate byte cap on one statement. */
  maxBytes?: number;
}

/**
 * Builds `UPDATE ... SET view_count = CASE video_id WHEN ... END` statements,
 * one per batch of updates.
 *
 * Rewriting each row individually would cost one round trip per video and a
 * few thousand of them per run; a `CASE` over an `IN` list collapses a whole
 * batch into a single statement while still writing a distinct value per row.
 *
 * Updates with a non-finite or negative count are dropped rather than written
 * as zero: a video whose statistics the API withheld should keep the count it
 * already has. Duplicate ids keep their last occurrence, so an id appearing
 * twice can never produce two `WHEN` arms for the same key.
 *
 * @param updates - Videos to write, in any order. See {@link ViewCountUpdate}.
 * @param target - Table and columns to write. See {@link ViewCountTarget}.
 * @param options - Batching limits. See {@link ViewCountUpdateOptions}.
 * @returns One SQL statement per array entry, without trailing semicolons.
 */
export function buildViewCountUpdateStatements(
  updates: ViewCountUpdate[],
  target: ViewCountTarget,
  options: ViewCountUpdateOptions = {},
): string[] {
  const maxRows = Math.max(1, options.maxRows ?? DEFAULT_UPDATES_PER_STATEMENT);
  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_MAX_STATEMENT_BYTES);

  const deduped = new Map<string, number>();
  for (const update of updates) {
    if (!update.videoId) continue;
    if (!Number.isFinite(update.viewCount) || update.viewCount < 0) continue;
    deduped.set(update.videoId, Math.trunc(update.viewCount));
  }

  const statements: string[] = [];
  let batch: Array<[string, number]> = [];
  let bytes = 0;

  const flush = () => {
    if (batch.length === 0) return;
    const arms = batch
      .map(([videoId, viewCount]) => `    WHEN ${sqlLiteral(videoId)} THEN ${viewCount}`)
      .join("\n");
    const ids = batch.map(([videoId]) => sqlLiteral(videoId)).join(", ");
    const stamp = target.updatedAtColumn
      ? `,\n  "${target.updatedAtColumn}" = unixepoch()`
      : "";
    statements.push(
      `UPDATE "${target.table}" SET\n  "${target.viewColumn}" = CASE "${target.idColumn}"\n` +
        `${arms}\n  END${stamp}\nWHERE "${target.idColumn}" IN (${ids})`,
    );
    batch = [];
    bytes = 0;
  };

  for (const entry of deduped) {
    const size = entry[0].length + String(entry[1]).length + 40;
    // Flush first when this entry would overflow, so an oversized entry still
    // gets a statement of its own rather than being dropped.
    if (batch.length > 0 && (batch.length >= maxRows || bytes + size > maxBytes)) flush();
    batch.push(entry);
    bytes += size;
  }
  flush();

  return statements;
}
