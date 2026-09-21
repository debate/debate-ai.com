/**
 * @fileoverview Formats `GET`/`POST /api/admin/videos/seed`'s responses for
 * the admin page's "Seed videos" button, mirroring
 * `format-recompute-stacks-result.ts`'s reasoning: `AdminDashboard.tsx` has
 * no rendering tests of its own (this repo does not use
 * `@testing-library/react`), so the display text is pulled into pure,
 * directly-testable functions instead of built inline.
 */

/** The `GET /api/admin/videos/seed` payload — the table's current state. */
export interface SeedVideosStatus {
  rows: number;
  /** ISO timestamp of the most recently touched row, or `null` if unseeded. */
  lastSeededAt: string | null;
  servingFrom: "sql" | "json";
}

/** The `POST /api/admin/videos/seed` payload — one run's counts. */
export interface SeedVideosRunResult {
  rows: number;
  statements: number;
  durationMs: number;
}

/**
 * @param date - An ISO timestamp.
 * @returns A `YYYY-MM-DD` day, in UTC so the result does not depend on the
 * reader's timezone or locale the way `toLocaleDateString()` would.
 */
function formatSeedDay(date: string): string {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toISOString().slice(0, 10);
}

/**
 * @param status - The endpoint's `{ rows, lastSeededAt, servingFrom }` payload.
 * @returns A one-line summary for the admin page to render next to the button.
 */
export function formatSeedVideosStatus(status: SeedVideosStatus): string {
  if (status.rows === 0) {
    return "Not seeded yet — the public feed is serving from the JSON fallback.";
  }
  const serving = status.servingFrom === "sql" ? "serving from SQL" : "serving from the JSON fallback";
  const lastSeeded = status.lastSeededAt ? formatSeedDay(status.lastSeededAt) : "unknown";
  return `${status.rows.toLocaleString()} videos seeded (${serving}) — last touched ${lastSeeded}.`;
}

/**
 * @param result - The endpoint's `{ rows, statements, durationMs }` payload.
 * @returns A one-line summary for the admin page to render after a run.
 */
export function formatSeedVideosResult(result: SeedVideosRunResult): string {
  const seconds = (result.durationMs / 1000).toFixed(1);
  const statementWord = result.statements === 1 ? "statement" : "statements";
  return `Seeded ${result.rows.toLocaleString()} videos in ${seconds}s (${result.statements.toLocaleString()} ${statementWord}).`;
}
