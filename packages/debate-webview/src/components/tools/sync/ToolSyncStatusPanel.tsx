"use client"

/**
 * @fileoverview Surfaces the account tool-data sync in Settings → General,
 * next to "Saved to your account": whether every tool's local data is synced,
 * a manual retry when a collection's merge failed, and a way back in for a
 * guest who opted out of the sign-in reminder.
 *
 * It used to sit on `/tools`; that catalog page is gone, which left the panel
 * mounted nowhere and the sync invisible again (the "Nothing surfaces the sync"
 * Known gap in `packages/debate-help-docs/dev-docs/internals/tool-data-sync.mdx`).
 *
 * The status line counts the tools that save to the account (from the same
 * overview), and **Sync now** turns into a disabled "Syncing…" while a merge
 * runs, so a second click can't queue another one. Under the status line,
 * "Last synced 3 minutes ago" says when this tab's last complete merge
 * finished (`readLastToolSyncAt`), refreshed every 30 seconds.
 *
 * The per-tool "Where each tool saves" list is not here: it is
 * `ToolStorageList`, mounted right after this panel, which also shows signed
 * out. This panel used to render its own copy of it, so Settings showed the
 * list twice.
 *
 * Reads the state through `useToolSyncSnapshot`, never `useToolRecordSync`:
 * that hook drives the sync and must run only in `ToolRecordSyncProvider`,
 * because its cleanups stop the global auto-sync watcher when it unmounts.
 *
 * @module components/tools/sync/ToolSyncStatusPanel
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"
import { useToolSyncSnapshot } from "../../../lib/hooks/useToolSyncSnapshot"
import { summarizeToolSyncFailures } from "../../../lib/tools/tool-sync-status"
import { summarizeToolSyncStatus } from "../../../lib/tools/tool-sync-summary"
import { formatLastToolSync, readLastToolSyncAt } from "../../../lib/tools/tool-sync-last-merge"
import { buildToolStorageOverview } from "../../../lib/tools/tool-storage-overview"
import { TOOL_GROUPS } from "../../../routes/tools/tool-groups"
import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "../../../lib/sign-in-prompt-preference"

export function ToolSyncStatusPanel() {
  const { enabled, reconciled, results, resync } = useToolSyncSnapshot()
  const lastSync = useLastToolSync(enabled && reconciled)
  // Starts false so a signed-out first render matches the server (no
  // localStorage there) instead of only matching once `useEffect` below runs,
  // the same guard `MySavedItems`'s cloud-item fetch uses for the same reason.
  const [optedOut, setOptedOut] = useState(false)

  useEffect(() => {
    if (!enabled) setOptedOut(isSignInPromptOptedOut())
  }, [enabled])

  if (!enabled) {
    if (!optedOut) return null
    return (
      <section id="tool-sync" className="mb-4 rounded-lg border border-border bg-background p-4 text-sm">
        <p className="text-muted-foreground">
          Sign-in reminders are off on this browser, so your tools save here only.
        </p>
        <button
          type="button"
          onClick={() => {
            setSignInPromptOptedOut(false)
            setOptedOut(false)
          }}
          className="mt-2 h-8 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Turn sign-in reminders back on
        </button>
      </section>
    )
  }

  const failures = summarizeToolSyncFailures(results)
  const overview = buildToolStorageOverview(TOOL_GROUPS, { enabled, reconciled, results })
  // Tools that save to the account: their own SQL table or a synced
  // collection. Device-only ("local") tools are not part of the sync.
  const accountToolCount = overview.reduce(
    (count, group) => count + group.rows.filter((row) => row.status.kind !== "local").length,
    0,
  )
  const syncing = !reconciled

  return (
    <section
      id="tool-sync"
      className="mb-4 rounded-lg border border-border bg-background p-4 text-sm"
      data-tool-sync-status
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Account sync</h2>
          <p className="text-muted-foreground" role="status" data-tool-sync-summary>
            {summarizeToolSyncStatus({
              reconciled,
              totalTools: accountToolCount,
              failureCount: failures.length,
            })}
          </p>
          {!syncing && lastSync && (
            <p className="text-xs text-muted-foreground" data-tool-sync-last>
              <time dateTime={new Date(lastSync.at).toISOString()} title={new Date(lastSync.at).toLocaleString()}>
                {formatLastToolSync(lastSync.at, lastSync.now)}
              </time>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={resync}
          disabled={syncing}
          aria-busy={syncing}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
        >
          <RotateCw className={`h-3.5 w-3.5${syncing ? " animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
      {failures.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {failures.map((failure) => (
            <li key={failure.key} className="flex items-start gap-1.5 text-muted-foreground">
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <span>
                <Link href={failure.href} className="font-medium text-foreground hover:underline">
                  {failure.label}
                </Link>{" "}
                &mdash; {failure.error}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** How often the "Last synced …" line re-reads the mark and its age. */
const LAST_SYNC_REFRESH_MS = 30 * 1000

/**
 * The tab's last complete merge time and the "now" to age it against, while
 * `active` (signed in, merge finished); `null` otherwise or when there is no
 * mark. Re-reads the mark on every tick too, so a merge finished by another
 * frame of the same tab (they share `sessionStorage`) shows up.
 */
function useLastToolSync(active: boolean): { at: number; now: number } | null {
  const [state, setState] = useState<{ at: number; now: number } | null>(null)

  useEffect(() => {
    if (!active) {
      setState(null)
      return
    }
    const refresh = () => {
      const at = readLastToolSyncAt()
      setState(at === null ? null : { at, now: Date.now() })
    }
    refresh()
    const timer = setInterval(refresh, LAST_SYNC_REFRESH_MS)
    return () => clearInterval(timer)
  }, [active])

  return state
}
