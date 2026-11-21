"use client"

/**
 * @fileoverview Settings → General "Where each tool saves": every tool that
 * keeps data of its own, grouped like the sidebar (`TOOL_GROUPS`), with one
 * line on where it is saved and a status pill — **Saved to account** for a
 * tool with its own SQL table, otherwise the live sync state of its synced
 * collections (**This device only** while signed out, then **Syncing…**,
 * **Synced** or **Couldn't sync** with the reason under the row). A filter box
 * narrows the list by tool name or group. Shown signed in or out, so a guest
 * can see what stays on this device until they sign in.
 *
 * This is the only copy of the list. Settings used to render two of them back
 * to back — a grouped one inside `ToolSyncStatusPanel` and a flat, filterable
 * one here, from two parallel changes — so the grouping and the filter now
 * live together here, built from `buildToolStorageOverview`.
 *
 * Collapsed by default under a `<details>` so it doesn't push the rest of
 * General down. Reads sync state through `useToolSyncSnapshot` (never the
 * driving `useToolRecordSync`, whose cleanups stop the auto-sync watcher).
 *
 * @module components/tools/sync/ToolStorageList
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { TOOL_GROUPS } from "../../../routes/tools/tool-groups"
import { useToolSyncSnapshot } from "../../../lib/hooks/useToolSyncSnapshot"
import {
  buildToolStorageOverview,
  countToolStorageRows,
  toolStorageStatusLabel,
  type ToolStorageRowStatus,
} from "../../../lib/tools/tool-storage-overview"

export function ToolStorageList() {
  const { enabled, reconciled, results } = useToolSyncSnapshot()
  const [query, setQuery] = useState("")
  const sync = useMemo(() => ({ enabled, reconciled, results }), [enabled, reconciled, results])
  const all = useMemo(() => buildToolStorageOverview(TOOL_GROUPS, sync), [sync])
  const groups = useMemo(
    () => (query.trim() ? buildToolStorageOverview(TOOL_GROUPS, sync, { query }) : all),
    [all, sync, query],
  )
  const total = countToolStorageRows(all)
  const shown = countToolStorageRows(groups)
  const filtering = query.trim() !== ""

  return (
    <details
      id="tool-storage"
      className="group mb-4 rounded-lg border border-border bg-background p-4 text-sm"
      data-tool-storage-list
    >
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        Where each tool saves
        <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">({total})</span>
      </summary>
      <p className="mt-2 text-muted-foreground">
        {enabled
          ? "Your tools save to your account automatically."
          : "Signed out, synced tools keep their data on this device until you sign in."}
      </p>
      <label className="mt-3 block">
        <span className="sr-only">Filter tools by name or group</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter tools"
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </label>
      {filtering && (
        <p className="mt-2 text-xs text-muted-foreground" role="status" data-tool-storage-count>
          {shown === 0 ? `No tools match “${query.trim()}”.` : `Showing ${shown} of ${total} tools.`}
        </p>
      )}
      {groups.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.heading} data-tool-storage-group={group.heading}>
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
                      {row.status.kind === "failed" && row.status.error && (
                        <p className="text-xs text-amber-700 dark:text-amber-400" data-tool-storage-error>
                          {row.status.error}
                        </p>
                      )}
                    </div>
                    <StatusPill status={row.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </details>
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
      data-status={status.kind}
    >
      {toolStorageStatusLabel(status)}
    </span>
  )
}
