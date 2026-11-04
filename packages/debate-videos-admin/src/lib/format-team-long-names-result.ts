/**
 * @fileoverview The progress line for the admin "Fill team last names"
 * button, which steps `POST /api/admin/videos/team-long-names` one season at
 * a time. Pure, so the wording has Vitest coverage (see
 * `format-recompute-stacks-result.ts` for why these live outside the panel).
 */

/** Running totals across the seasons handled so far. */
export interface TeamLongNamesProgress {
  /** Seasons handled so far. */
  done: number;
  /** Seasons with initials rounds when the run started. */
  total: number;
  /** Rows given a name. */
  updated: number;
  /** Initials teams still without one. */
  unresolved: number;
  /** Tables that failed to load, e.g. `"hspf 2019"`. */
  missingTables: string[];
  /** True once the last season is handled. */
  finished: boolean;
}

/** `"Filled 412 videos across 11 seasons; 230 teams not found in rankings."` */
export function formatTeamLongNamesProgress(p: TeamLongNamesProgress): string {
  const seasons = `${p.done.toLocaleString()} of ${p.total.toLocaleString()} season${p.total === 1 ? "" : "s"}`;
  if (p.total === 0) return "No initials-only teams left to fill.";
  const head = p.finished
    ? `Filled ${p.updated.toLocaleString()} video${p.updated === 1 ? "" : "s"} across ${seasons}`
    : `Working… ${seasons}, ${p.updated.toLocaleString()} video${p.updated === 1 ? "" : "s"} filled`;
  const tail = p.unresolved > 0 ? `; ${p.unresolved.toLocaleString()} team${p.unresolved === 1 ? "" : "s"} not found in that season's rankings` : "";
  const missing = p.missingTables.length > 0 ? ` (couldn't load ${p.missingTables.join(", ")})` : "";
  return `${head}${tail}${missing}.`;
}
