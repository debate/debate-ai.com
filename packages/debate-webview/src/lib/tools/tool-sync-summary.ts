/**
 * @fileoverview Pure formatter for the one-sentence status line at the top of
 * Settings → General's **Account sync** panel (`ToolSyncStatusPanel`): still
 * reconciling, every syncing tool synced (with how many), or some collections
 * failing. The per-failure list below the line is the panel's own.
 *
 * @module lib/tools/tool-sync-summary
 */

export interface ToolSyncSummaryInput {
  /** Whether this tab's account merge has finished (or been skipped). */
  reconciled: boolean
  /**
   * How many tools save to the account (their own SQL table or a synced
   * collection), for the "all N tools" phrasing. `0` or less falls back to a
   * sentence without a count.
   */
  totalTools: number
  /** How many collections `summarizeToolSyncFailures` reported. */
  failureCount: number
}

/**
 * One sentence describing the account tool-data sync, in the three states
 * `ToolSyncStatusPanel` shows: still reconciling, fully synced, or some
 * collections failing.
 */
export function summarizeToolSyncStatus({
  reconciled,
  totalTools,
  failureCount,
}: ToolSyncSummaryInput): string {
  if (!reconciled) return "Syncing your tools to your account…"
  if (failureCount > 0) {
    return `${failureCount} tool${failureCount === 1 ? "" : "s"} couldn't sync just now.`
  }
  if (totalTools <= 0) return "Every tool's data is synced to your account."
  if (totalTools === 1) return "Your 1 tool that saves data is synced to your account."
  return `All ${totalTools} tools that save data are synced to your account.`
}
