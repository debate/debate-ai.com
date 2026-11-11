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
 * Signed in, it also lists where each tool saves ("Where each tool saves",
 * collapsed by default) from `buildToolStorageOverview`, so the per-tool
 * storage answer that used to sit in each tool's header lives in one place.
 *
 * Reads the state through `useToolSyncSnapshot`, never `useToolRecordSync`:
 * that hook drives the sync and must run only in `ToolRecordSyncProvider`,
 * because its cleanups stop the global auto-sync watcher when it unmounts.
 *
 * @module components/tools/sync/ToolSyncStatusPanel
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, RotateCw } from "lucide-react"
import { useToolSyncSnapshot } from "../../../lib/hooks/useToolSyncSnapshot"
import { summarizeToolSyncFailures } from "../../../lib/tools/tool-sync-status"
import {
  buildToolStorageOverview,
  toolStorageStatusLabel,
  type ToolStorageRowStatus,
} from "../../../lib/tools/tool-storage-overview"
import { TOOL_GROUPS } from "../../../routes/tools/tool-groups"
import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "../../../lib/sign-in-prompt-preference"

export function ToolSyncStatusPanel() {
  const { enabled, reconciled, results, resync } = useToolSyncSnapshot()
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

  return (
    <section
      id="tool-sync"
      className="mb-4 rounded-lg border border-border bg-background p-4 text-sm"
      data-tool-sync-status
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">Account sync</h2>
          <p className="text-muted-foreground">
            {!reconciled
              ? "Syncing your tools to your account…"
              : failures.length === 0
                ? "Every tool's data is synced to your account."
                : `${failures.length} tool${failures.length === 1 ? "" : "s"} couldn't sync just now.`}
          </p>
        </div>
        <button
          type="button"
          onClick={resync}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Sync now
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
      {overview.length > 0 && (
        <details className="group mt-3 border-t border-border pt-3" data-tool-storage-overview>
          <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
            Where each tool saves
          </summary>
          <div className="mt-2 flex flex-col gap-3">
            {overview.map((group) => (
              <div key={group.heading}>
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </h3>
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {group.rows.map((row) => (
                    <li
                      key={row.href}
                      className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-2"
                      data-tool-storage-row={row.href}
                    >
                      <div className="min-w-0 flex-1">
                        <Link href={row.href} className="font-medium text-foreground hover:underline">
                          {row.label}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.where}</p>
                      </div>
                      <StatusPill status={row.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

const PILL_TONE: Record<ToolStorageRowStatus["kind"], string> = {
  account: "border-border text-foreground",
  synced: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  syncing: "border-border text-muted-foreground",
  local: "border-border text-muted-foreground",
  failed: "border-amber-500/50 text-amber-700 dark:text-amber-400",
}

function StatusPill({ status }: { status: ToolStorageRowStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${PILL_TONE[status.kind]}`}
      title={status.kind === "failed" ? status.error : undefined}
      data-status={status.kind}
    >
      {toolStorageStatusLabel(status)}
    </span>
  )
}
