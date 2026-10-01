/**
 * @fileoverview JSON fallback for the video feed.
 *
 * `/api/videos` serves from the `videos` SQL table (D1 in production, local
 * SQLite in development). Until that table has been seeded — a fresh clone, a
 * fresh preview database — this module used to rebuild the same rows
 * from the `debate-data-sync` JSON assets. Those assets were removed, so it
 * now returns no rows.
 * @module lib/videos/video-json-source
 */

import type { VideoRow } from "debate-data-sync/src/videos/video-rows";

/**
 * Loads every video row from the JSON assets.
 *
 * The `debate-data-sync/data/videos/*.json` assets were removed from the repo,
 * so the `videos` table is now the only source and this fallback has nothing
 * to serve: an unseeded table shows an empty library rather than failing the
 * build on the missing files.
 *
 * @returns No rows.
 */
export async function getVideoRowsFromJson(): Promise<VideoRow[]> {
  return [];
}
