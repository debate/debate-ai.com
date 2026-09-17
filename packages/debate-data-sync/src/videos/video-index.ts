/**
 * @fileoverview The wire format of the whole-library video index, and the two
 * conversions either side of it.
 *
 * `/api/videos` serves the library a page at a time, which is right for a
 * cold first paint and wrong for everything after it: every filter change,
 * every season dropdown, every search is another round trip for rows the
 * browser has usually already seen. `/api/videos/index` ships the library
 * once instead, the client keeps it in `localStorage`, and the grid queries
 * it locally — so the second visit filters and searches without a network at
 * all, and the only request a page load makes is "what changed since?".
 *
 * ## Why a tuple and not a row
 *
 * The UI already speaks the positional tuple {@link videoRowToTuple} produces,
 * and an object-per-video index is roughly three times the bytes for the same
 * data — which matters when the whole thing has to fit in a 5 MB
 * `localStorage` quota and be parsed on a phone. So the index is the same
 * tuple with one extra slot:
 *
 * ```text
 * [ …the 20 UI slots…, sourceCode ]
 * ```
 *
 * `sourceCode` is the one field the UI tuple drops and the client cannot
 * derive: whether a video came from the rounds assets or the lectures asset.
 * It is not the same question as "does it have a numeric style" — the
 * lectures asset carries styled videos too — and the grid filters on it, so
 * without it a locally-served feed would quietly return the wrong library.
 *
 * @module videos/video-index
 */

import {
  tupleToVideoRow,
  videoRowToTuple,
  type VideoRow,
  type VideoSource,
  type VideoTuple,
} from "./video-rows";

/** One video as the index ships it: the UI tuple plus a source code. */
export type VideoIndexTuple = any[];

/** Index of the source-code slot appended to the UI tuple. */
export const VIDEO_INDEX_SOURCE_SLOT = 20;

/** How {@link VideoSource} is encoded in the index — a byte, not a word. */
export const VIDEO_INDEX_SOURCE_CODES: Record<VideoSource, number> = {
  round: 0,
  lecture: 1,
};

/**
 * Bumped whenever this format changes in a way that makes a stored index
 * unreadable. A client holding an older version throws its cache away and
 * fetches the library again rather than trying to interpret it.
 */
export const VIDEO_INDEX_FORMAT_VERSION = 1;

/** The payload `/api/videos/index` answers with. */
export interface VideoIndexResponse {
  /** Format version of {@link VideoIndexResponse.rows}. */
  version: number;
  /** The rows this response carries — the whole library, or just the changes. */
  rows: VideoIndexTuple[];
  /**
   * Whether `rows` is a delta rather than the whole library. A client that
   * asked for changes since a cursor and got `partial: false` — because the
   * backend cannot answer that question — replaces its cache outright.
   */
  partial: boolean;
  /**
   * How many videos the library holds in total. A client whose merged cache
   * does not match this has missed a deletion and refetches in full, which is
   * how removals propagate without a tombstone table.
   */
  total: number;
  /** Cursor to send as `since` on the next visit (epoch ms). */
  syncedAt: number;
  /** Which backend answered — `"sql"`, or `"json"` before the table is seeded. */
  backend: string;
}

/**
 * Converts a library row into its index tuple.
 *
 * @param row - A `videos` table row.
 * @returns The UI tuple, padded to its full width, with the source appended.
 */
export function videoRowToIndexTuple(row: VideoRow): VideoIndexTuple {
  // `videoRowToTuple` trims trailing nulls to keep paged responses small; the
  // source has to sit at a fixed index, so the padding comes back here. It is
  // two nulls per row in the common case, and it keeps the reader a plain
  // index lookup rather than a length-dependent guess.
  const tuple = videoRowToTuple(row);
  while (tuple.length < VIDEO_INDEX_SOURCE_SLOT) tuple.push(null);
  tuple[VIDEO_INDEX_SOURCE_SLOT] = VIDEO_INDEX_SOURCE_CODES[row.source] ?? 0;
  return tuple;
}

/**
 * Rebuilds a full library row from an index tuple.
 *
 * The derived fields — the season, the category slug, the lowercased search
 * text — are recomputed by {@link tupleToVideoRow}, the same function the
 * seed uses, so a locally-served query filters exactly as the server's would.
 *
 * @param tuple - One row of an index payload.
 * @returns The row, or `null` when the tuple carries no video id.
 */
export function indexTupleToVideoRow(tuple: VideoIndexTuple): VideoRow | null {
  const source: VideoSource =
    tuple?.[VIDEO_INDEX_SOURCE_SLOT] === VIDEO_INDEX_SOURCE_CODES.lecture ? "lecture" : "round";
  const row = tupleToVideoRow(tuple, source);
  if (!row) return null;
  // Stacks join two rows, so `tupleToVideoRow` cannot read them off one tuple
  // — but the index ships them in slots 18 and 19, already resolved by the
  // seed, and the grid folds a stack into one card from them.
  row.stackKey = typeof tuple[18] === "string" && tuple[18] !== "" ? tuple[18] : null;
  row.stackPosition = row.stackKey && typeof tuple[19] === "number" ? tuple[19] : 0;
  return row;
}

/**
 * Strips the index's extra slot, leaving the tuple the video UI reads.
 *
 * @param tuple - One row of an index payload.
 * @returns The UI tuple, trimmed of trailing empties as the API trims it.
 */
export function indexTupleToVideoTuple(tuple: VideoIndexTuple): VideoTuple {
  const plain = tuple.slice(0, VIDEO_INDEX_SOURCE_SLOT);
  let end = plain.length;
  while (end > 7 && (plain[end - 1] === null || plain[end - 1] === undefined)) end--;
  return plain.slice(0, end);
}
