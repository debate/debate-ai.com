/**
 * @fileoverview When this tab's account merge last finished, for the
 * "Last synced …" line in Settings → General's **Account sync** panel
 * (`ToolSyncStatusPanel`).
 *
 * The time is the same `sessionStorage` mark `useToolRecordSync` already
 * writes after a merge that reached the server cleanly (it is what the
 * 10-minute "already reconciled" check reads), so the panel and the merge can
 * never disagree. A merge that hit server errors leaves the mark alone, so the
 * line keeps showing the last *complete* sync while the failures list says
 * what went wrong. The shell document and every dock frame share one per-tab
 * store, so they all show the same time.
 *
 * Kept out of `useToolRecordSync` so the panel can read it without importing
 * the hook that drives the sync.
 *
 * @module lib/tools/tool-sync-last-merge
 */

/** `sessionStorage` key holding the epoch ms of the tab's last complete merge. */
export const TOOL_SYNC_HYDRATED_KEY = "toolRecordSyncHydratedAt"

/**
 * Epoch ms of this tab's last complete account merge, or `null` when there
 * is none (not merged yet, signed out, unreadable or blocked storage).
 */
export function readLastToolSyncAt(): number | null {
  if (typeof sessionStorage === "undefined") return null
  try {
    const raw = sessionStorage.getItem(TOOL_SYNC_HYDRATED_KEY)
    if (!raw) return null
    const at = Number(raw)
    return Number.isFinite(at) && at > 0 ? at : null
  } catch {
    return null
  }
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * "Last synced just now / 3 minutes ago / 2 hours ago / 1 day ago" for a
 * merge that finished at `at`, seen at `now`. A time slightly in the future
 * (clock skew between frames) reads as "just now" rather than a negative age.
 */
export function formatLastToolSync(at: number, now: number): string {
  const age = Math.max(0, now - at)
  if (age < MINUTE_MS) return "Last synced just now"
  if (age < HOUR_MS) return `Last synced ${plural(Math.floor(age / MINUTE_MS), "minute")} ago`
  if (age < DAY_MS) return `Last synced ${plural(Math.floor(age / HOUR_MS), "hour")} ago`
  return `Last synced ${plural(Math.floor(age / DAY_MS), "day")} ago`
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`
}
