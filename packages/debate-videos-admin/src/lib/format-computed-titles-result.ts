/**
 * @fileoverview The progress line for the admin "Fill computed titles"
 * button, which steps `POST /api/admin/videos/computed-titles` one season at
 * a time. Pure, so the wording has Vitest coverage.
 */

/** Running totals across the seasons handled so far. */
export interface ComputedTitlesProgress {
  /** Seasons handled so far. */
  done: number;
  /** Seasons with videos when the run started. */
  total: number;
  /** Videos whose title was written. */
  updated: number;
  /** Videos that have a computed title. */
  titled: number;
  /** Teams shown with a rank. */
  ranked: number;
  /** Tables that failed to load, e.g. `"hspf 2019"`. */
  missingTables: string[];
  /** True once the last season is handled. */
  finished: boolean;
}

/** `"Done: 9,120 videos titled across 18 seasons (412 updated, 3,050 teams ranked)."` */
export function formatComputedTitlesProgress(p: ComputedTitlesProgress): string {
  if (p.total === 0) return "No videos to title.";
  const seasons = `${p.done.toLocaleString()} of ${p.total.toLocaleString()} season${p.total === 1 ? "" : "s"}`;
  const head = p.finished
    ? `Done: ${p.titled.toLocaleString()} video${p.titled === 1 ? "" : "s"} titled across ${seasons}`
    : `Working… ${seasons}, ${p.titled.toLocaleString()} video${p.titled === 1 ? "" : "s"} titled`;
  const detail = ` (${p.updated.toLocaleString()} updated, ${p.ranked.toLocaleString()} team${p.ranked === 1 ? "" : "s"} ranked)`;
  const missing = p.missingTables.length > 0 ? ` Couldn't load ${p.missingTables.join(", ")}.` : "";
  return `${head}${detail}.${missing}`;
}
