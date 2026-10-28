/**
 * @fileoverview How an organizer narrows the judge pool to the judges who
 * could work their tournament.
 *
 * Runs in the browser over the pool the board already loaded — the pool is
 * capped server-side, so filtering it locally costs nothing and needs no
 * round trip per click.
 *
 * @module debate-practice-rounds/judge-pool/filter
 */

import type { PracticeFormat } from "../practice-partners/types";
import type { JudgePoolEntry, UsState } from "./types";

export interface JudgePoolFilter {
  /** Saturday ISO key, or empty for any weekend. */
  weekend?: string;
  /** Where the tournament is, or empty for anywhere. */
  state?: UsState | "";
  format?: PracticeFormat | "";
}

/**
 * The judges that fit the filter, in-state judges before travellers, then
 * most recently updated.
 *
 * A judge fits a state if they list it, or if they're willing to travel —
 * an organizer in Texas can still hire a Californian who'll fly in.
 */
export function filterJudgePool(pool: readonly JudgePoolEntry[], filter: JudgePoolFilter): JudgePoolEntry[] {
  const { weekend, state, format } = filter;
  const local = (entry: JudgePoolEntry) => Boolean(state) && entry.states.includes(state as UsState);
  return pool
    .filter(
      (entry) =>
        (!weekend || entry.weekends.includes(weekend)) &&
        (!format || entry.formats.includes(format)) &&
        (!state || local(entry) || entry.canTravel),
    )
    .sort((a, b) => Number(local(b)) - Number(local(a)) || b.updatedAt - a.updatedAt);
}
