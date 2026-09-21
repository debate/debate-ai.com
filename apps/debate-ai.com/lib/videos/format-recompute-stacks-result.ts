/**
 * @fileoverview Formats `recomputeVideoStacks`'s result for the admin page's
 * "Recompute stacks" button, mirroring `handleResyncViewCounts`'s inline
 * count message and `handlePurgeReuseCheckLog`'s "nothing to do" phrasing.
 * Pulled into its own pure function (rather than built inline in
 * `AdminDashboard.tsx`, which has no rendering tests of its own — this repo
 * does not use `@testing-library/react`) so the two-way message — "nothing
 * moved" vs "N of M updated" — has direct Vitest coverage.
 */

/** The counts `POST /api/admin/videos/recompute-stacks` returns. */
export interface RecomputeStacksCounts {
  rows: number;
  updated: number;
}

/**
 * @param result - The endpoint's `{ rows, updated }` payload.
 * @returns A one-line summary for the admin page to render next to the button.
 */
export function formatRecomputeStacksResult(result: RecomputeStacksCounts): string {
  if (result.updated === 0) {
    return `No changes — checked ${result.rows.toLocaleString()} videos.`;
  }
  return `Updated ${result.updated.toLocaleString()} of ${result.rows.toLocaleString()} videos.`;
}
