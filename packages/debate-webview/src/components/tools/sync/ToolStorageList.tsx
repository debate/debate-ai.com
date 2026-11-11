"use client"

/**
 * @fileoverview Settings → General "Where each tool saves": a searchable list
 * of every tool that keeps data of its own, whether that data lives in the
 * account-synced tool collections or in the tool's own SQL table, and — for
 * synced tools — whether it is synced right now. Shown signed in or out, so a
 * guest can see what stays on this device until they sign in.
 *
 * Collapsed by default under a `<details>` so it doesn't push the rest of
 * General down. Reads sync state through `useToolSyncSnapshot` (never the
 * driving `useToolRecordSync`, whose cleanups stop the auto-sync watcher).
 *
 * @module components/tools/sync/ToolStorageList
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { Cloud, Database, HardDrive } from "lucide-react"
import { ALL_TOOLS } from "../../../routes/tools/tool-groups"
import { useToolSyncSnapshot } from "../../../lib/hooks/useToolSyncSnapshot"
import { buildToolStorageRows, toolStorageStatusLabel } from "../../../lib/tools/tool-storage-rows"

const STATUS_TONE: Record<string, string> = {
  local: "border-border text-muted-foreground",
  syncing: "border-border text-muted-foreground",
  synced: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  failed: "border-amber-500/50 text-amber-700 dark:text-amber-400",
}

export function ToolStorageList() {
  const { enabled, reconciled, results } = useToolSyncSnapshot()
  const [query, setQuery] = useState("")
  const rows = useMemo(
    () => buildToolStorageRows({ tools: ALL_TOOLS, sync: { enabled, reconciled, results }, query }),
    [enabled, reconciled, results, query],
  )

  return (
    <details id="tool-storage" className="mb-4 rounded-lg border border-border bg-background p-4 text-sm" data-tool-storage-list>
      <summary className="cursor-pointer font-medium text-foreground">Where each tool saves</summary>
      <p className="mt-2 text-muted-foreground">
        {enabled
          ? "Your tools save to your account automatically."
          : "Signed out, synced tools keep their data on this device until you sign in."}
      </p>
      <label className="mt-3 block">
        <span className="sr-only">Filter tools</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter tools"
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      {rows.length === 0 ? (
        <p className="mt-3 text-muted-foreground">No tools match “{query}”.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const status = toolStorageStatusLabel(row.status)
            const Icon = row.where === "sql" ? Database : enabled ? Cloud : HardDrive
            return (
              <li key={row.href} className="flex items-start gap-2 py-2" data-tool-storage-row={row.href}>
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Link href={row.href} className="font-medium text-foreground hover:underline">
                    {row.label}
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                  {row.status.kind === "failed" && row.status.error && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{row.status.error}</p>
                  )}
                </div>
                {status && (
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[row.status.kind] ?? ""}`}
                  >
                    {status}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}
