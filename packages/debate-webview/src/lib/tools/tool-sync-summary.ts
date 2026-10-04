/**
 * @fileoverview Pure formatter for the compact tool-sync status line shown in
 * Preferences (the former Preferences tool-sync section) — the same signal
 * `/tools`' full `ToolSyncStatusPanel` shows, condensed to one sentence with
 * no per-failure retry list, since that still lives only on `/tools`.
 *
 * @module lib/tools/tool-sync-summary
 */

export interface ToolSyncSummaryInput {
  /** Whether this tab's account merge has finished (or been skipped). */
  reconciled: boolean
  /** The full tool catalog's size, for the "all N tools" phrasing. */
  totalTools: number
  /** How many collections `summarizeToolSyncFailures` reported. */
  failureCount: number
}

/**
 * One sentence describing the account tool-data sync, in the same three
 * states `ToolSyncStatusPanel` shows on `/tools`: still reconciling, fully
 * synced, or some collections failing.
 */
export function summarizeToolSyncStatus({
  reconciled,
  totalTools,
  failureCount,
}: ToolSyncSummaryInput): string {
  if (!reconciled) return "Syncing your tools to your account…"
  if (failureCount === 0) return `All ${totalTools} tools are synced to your account.`
  return `${failureCount} tool${failureCount === 1 ? "" : "s"} couldn't sync just now.`
}
