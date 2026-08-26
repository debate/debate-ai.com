/**
 * @fileoverview JSON fallback for the video feed.
 *
 * `/api/videos` serves from the `videos` SQL table (D1 in production, local
 * SQLite in development). Until that table has been seeded — a fresh clone, a
 * fresh preview database — this module rebuilds the same rows from the
 * `debate-data-sync` JSON assets so the page still works. The assets are
 * pulled in through a dynamic import so they stay out of the hot path when
 * the table is populated.
 * @module lib/videos/video-json-source
 */

import type { VideoRow } from "debate-data-sync/src/videos/video-rows";

let cachedRows: VideoRow[] | null = null;

/**
 * Loads (and memoises) every video row from the JSON assets.
 *
 * @returns All rows, de-duplicated by video id, rounds before lectures.
 */
export async function getVideoRowsFromJson(): Promise<VideoRow[]> {
  if (cachedRows) return cachedRows;

  const [
    { buildVideoRows },
    roundsPolicy,
    roundsPf,
    roundsLd,
    roundsCollege,
    lectures,
    topPicks,
  ] = await Promise.all([
    import("debate-data-sync/src/videos/video-rows"),
    import("debate-data-sync/data/videos/rounds-policy.json"),
    import("debate-data-sync/data/videos/rounds-pf.json"),
    import("debate-data-sync/data/videos/rounds-ld.json"),
    import("debate-data-sync/data/videos/rounds-college.json"),
    import("debate-data-sync/data/videos/debate-lectures.json"),
    import("debate-data-sync/data/videos/debate-top-picks.json"),
  ]);

  const unwrap = <T,>(mod: T | { default: T }): T =>
    (mod as { default?: T }).default ?? (mod as T);

  cachedRows = buildVideoRows({
    rounds: [roundsPolicy, roundsPf, roundsLd, roundsCollege].map((m) => unwrap(m) as any),
    lectures: unwrap(lectures) as any,
    topPicks: unwrap(topPicks) as any,
  });

  return cachedRows;
}
