"use client"

/**
 * @fileoverview Surfaces the account tool-data sync on `/tools`: whether
 * every tool's local data is synced, a manual retry when a collection's
 * merge failed, and a way back in for a guest who opted out of the sign-in
 * reminder.
 *
 * Closes the "nothing surfaces the sync any more" Known gap in
 * `packages/debate-help-docs/content/docs/internals/tool-data-sync.mdx`: the
 * status list this rendered on used to live at `/settings`, which is now
 * CardMirror-editor settings only (see that page's own doc comment). Both
 * the sync results and the retry function this renders already existed on
 * `useToolRecordSync` — this is that state finally getting somewhere to
 * render again.
 *
 * @module components/tools/ToolSyncStatusPanel
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"
import { useToolRecordSync } from "@/lib/hooks/useToolRecordSync"
import { summarizeToolSyncFailures } from "@/lib/tools/tool-sync-status"
import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "@/lib/sign-in-prompt-preference"

export function ToolSyncStatusPanel() {
  const { enabled, reconciled, results, resync } = useToolRecordSync()
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
      <section className="mb-8 rounded-lg border border-border bg-background p-4 text-sm">
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

  return (
    <section
      className="mb-8 rounded-lg border border-border bg-background p-4 text-sm"
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
    </section>
  )
}
