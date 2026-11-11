/**
 * @fileoverview Rows for the Settings → General "Where each tool saves" list
 * (`components/tools/sync/ToolStorageList.tsx`): every tool in the catalog
 * that keeps something of its own, where that is (account-synced collections
 * or its own SQL table), and — for synced tools — its live sync state.
 *
 * Joins three things that already existed but were shown nowhere once the
 * per-tool header badge was removed: `resolveToolStorage` /
 * `describeToolStorage` (`tool-storage.ts`) and `toolSyncBadgeState`
 * (`tool-sync-status.ts`). Tools that store nothing of their own (`derived`)
 * or declare no storage are left out, so the list never pads itself with rows
 * that have nothing to say.
 *
 * @module lib/tools/tool-storage-rows
 */

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"
import { describeToolStorage, resolveToolStorage } from "./tool-storage"
import { toolSyncBadgeState, type ToolSyncBadgeState } from "./tool-sync-status"

export interface ToolStorageRow {
  href: string
  label: string
  /** `synced`: tool-record collections; `sql`: its own account table. */
  where: "synced" | "sql"
  /** The plain-language line from `describeToolStorage`. */
  description: string
  /** Live state for synced tools; `{ kind: "none" }` for SQL-backed ones. */
  status: ToolSyncBadgeState
}

export interface ToolStorageRowsInput {
  tools: readonly { href: string; label: string }[]
  sync: {
    enabled: boolean
    reconciled: boolean
    results: readonly ToolRecordHydrationResult[]
  }
  /** Case-insensitive match against the label; blank keeps every row. */
  query?: string
}

/**
 * One row per tool that stores data of its own, in catalog order. A tool
 * listed twice in the catalog (same `href`) appears once.
 */
export function buildToolStorageRows({ tools, sync, query = "" }: ToolStorageRowsInput): ToolStorageRow[] {
  const needle = query.trim().toLowerCase()
  const seen = new Set<string>()
  const rows: ToolStorageRow[] = []
  for (const tool of tools) {
    if (seen.has(tool.href)) continue
    seen.add(tool.href)
    if (needle && !tool.label.toLowerCase().includes(needle)) continue
    const storage = resolveToolStorage(tool.href)
    const description = describeToolStorage(storage)
    if (!storage || storage.kind === "derived" || !description) continue
    rows.push({
      href: tool.href,
      label: tool.label,
      where: storage.kind,
      description,
      status:
        storage.kind === "synced"
          ? toolSyncBadgeState(tool.href, sync, storage.collections)
          : { kind: "none" },
    })
  }
  return rows
}

/** Short status text for a row's badge; `null` when there is nothing live to say. */
export function toolStorageStatusLabel(status: ToolSyncBadgeState): string | null {
  switch (status.kind) {
    case "none":
      return null
    case "local":
      return "On this device"
    case "syncing":
      return "Syncing…"
    case "synced":
      return "Synced"
    case "failed":
      return "Couldn't sync"
  }
}
