/**
 * @fileoverview Builds the SQL that writes recomputed stacked-playlist
 * membership (`stack_key`/`stack_position`) back into the `videos` table.
 *
 * Counterpart to `view-count-sql.ts`: touches only the two stack columns, so
 * a recompute run does not have to re-send titles and descriptions it did
 * not change. Values are inlined (via `video-seed-sql.ts`'s `sqlLiteral`)
 * rather than bound, matching that module's reasoning.
 * @module videos/video-stack-sql
 */

import { sqlLiteral } from "./video-seed-sql";

/** One video's recomputed stack placement. */
export interface VideoStackUpdate {
  /** YouTube video id, matching `videos.video_id`. */
  videoId: string;
  /** The stack's primary member's id, or `null` when this video is unstacked. */
  stackKey: string | null;
  /** Zero-based position within the stack; `0` when unstacked. */
  stackPosition: number;
}

/**
 * Updates per statement. A `CASE` arm is short (an 11-character video id, a
 * short key or a small integer), so the row cap — not the byte cap — is what
 * normally closes a batch here, mirroring `view-count-sql.ts`'s reasoning.
 */
export const DEFAULT_STACK_UPDATES_PER_STATEMENT = 100;

/** Byte ceiling for one generated statement, well under D1's 100 KB limit. */
export const DEFAULT_STACK_MAX_STATEMENT_BYTES = 50_000;

/** Batching limits for {@link buildVideoStackUpdateStatements}. */
export interface VideoStackUpdateOptions {
  /** Hard cap on updates per statement. */
  maxRows?: number;
  /** Approximate byte cap on one statement. */
  maxBytes?: number;
}

/**
 * Builds `UPDATE "videos" SET "stack_key" = CASE ... END, "stack_position" =
 * CASE ... END WHERE "video_id" IN (...)` statements, one per batch of
 * updates.
 *
 * Rewriting each row individually would cost one round trip per video and a
 * recompute run touches the whole library; a `CASE` over an `IN` list
 * collapses a whole batch into a single statement while still writing a
 * distinct placement per row. Duplicate ids keep their last occurrence, so an
 * id appearing twice can never produce two `WHEN` arms for the same key.
 *
 * @param updates - Videos whose placement changed, in any order.
 * @param options - Batching limits. See {@link VideoStackUpdateOptions}.
 * @returns One SQL statement per batch, without trailing semicolons.
 */
export function buildVideoStackUpdateStatements(
  updates: VideoStackUpdate[],
  options: VideoStackUpdateOptions = {},
): string[] {
  const maxRows = Math.max(1, options.maxRows ?? DEFAULT_STACK_UPDATES_PER_STATEMENT);
  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_STACK_MAX_STATEMENT_BYTES);

  const deduped = new Map<string, { stackKey: string | null; stackPosition: number }>();
  for (const update of updates) {
    if (!update.videoId) continue;
    deduped.set(update.videoId, { stackKey: update.stackKey, stackPosition: update.stackPosition });
  }

  const statements: string[] = [];
  let batch: Array<[string, { stackKey: string | null; stackPosition: number }]> = [];
  let bytes = 0;

  const flush = () => {
    if (batch.length === 0) return;
    const keyArms = batch
      .map(([videoId, placement]) => `    WHEN ${sqlLiteral(videoId)} THEN ${sqlLiteral(placement.stackKey)}`)
      .join("\n");
    const positionArms = batch
      .map(([videoId, placement]) => `    WHEN ${sqlLiteral(videoId)} THEN ${placement.stackPosition}`)
      .join("\n");
    const ids = batch.map(([videoId]) => sqlLiteral(videoId)).join(", ");
    statements.push(
      `UPDATE "videos" SET\n  "stack_key" = CASE "video_id"\n${keyArms}\n  END,\n` +
        `  "stack_position" = CASE "video_id"\n${positionArms}\n  END\nWHERE "video_id" IN (${ids})`,
    );
    batch = [];
    bytes = 0;
  };

  for (const entry of deduped) {
    const size = entry[0].length + (entry[1].stackKey?.length ?? 4) + 60;
    // Flush first when this entry would overflow, so an oversized entry still
    // gets a statement of its own rather than being dropped.
    if (batch.length > 0 && (batch.length >= maxRows || bytes + size > maxBytes)) flush();
    batch.push(entry);
    bytes += size;
  }
  flush();

  return statements;
}
