/**
 * @fileoverview Pure model for the "Where each tool saves" list in Settings →
 * General's Account sync panel (`components/tools/sync/ToolSyncStatusPanel`).
 *
 * The per-tool header line and badge were removed from `ToolPageHeader` on
 * purpose (auto-sync is the model; no per-page Save now), which left
 * `describeToolStorage` and `toolSyncBadgeState` with no caller. This puts the
 * same answers in one place instead: for every tool in the catalog that keeps
 * anything of its own, where it is saved and whether its synced collections
 * are currently in sync. Tools that only show other tools' or public data
 * (`kind: "derived"`) are left out.
 *
 * @module lib/tools/tool-storage-overview
 */

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"
import { describeToolStorage, resolveToolStorage } from "./tool-storage"
import { toolSyncBadgeState } from "./tool-sync-status"

/** Row status: a synced collection's state, or `"account"` for a tool with its own SQL table. */
export type ToolStorageRowStatus =
  | { kind: "account" }
  | { kind: "local" }
  | { kind: "syncing" }
  | { kind: "synced" }
  | { kind: "failed"; error: string }

export interface ToolStorageRow {
  href: string
  label: string
  /** `describeToolStorage`'s plain-language line. */
  where: string
  status: ToolStorageRowStatus
}

export interface ToolStorageGroup {
  heading: string
  rows: ToolStorageRow[]
}

export interface ToolStorageOverviewSync {
  enabled: boolean
  reconciled: boolean
  results: readonly ToolRecordHydrationResult[]
}

/** Minimal catalog shape, so this stays testable without the icon-laden `TOOL_GROUPS`. */
export interface ToolStorageCatalogGroup {
  heading: string
  tools: readonly { href: string; label: string }[]
}

/**
 * One group per catalog heading, in catalog order, each listing the tools that
 * store something. A tool listed under two headings appears once, under the
 * first. Empty groups are dropped.
 */
export function buildToolStorageOverview(
  groups: readonly ToolStorageCatalogGroup[],
  sync: ToolStorageOverviewSync,
): ToolStorageGroup[] {
  const seen = new Set<string>()
  const out: ToolStorageGroup[] = []
  for (const group of groups) {
    const rows: ToolStorageRow[] = []
    for (const tool of group.tools) {
      if (seen.has(tool.href)) continue
      seen.add(tool.href)
      const storage = resolveToolStorage(tool.href)
      const where = describeToolStorage(storage)
      if (!storage || !where) continue
      let status: ToolStorageRowStatus
      if (storage.kind === "sql") {
        status = { kind: "account" }
      } else {
        const badge = toolSyncBadgeState(tool.href, sync, storage.kind === "synced" ? storage.collections : [])
        // `none` cannot happen for a resolved synced tool unless every key was
        // dropped as unknown; treat it as kept on this device.
        status = badge.kind === "none" ? { kind: "local" } : badge
      }
      rows.push({ href: tool.href, label: tool.label, where, status })
    }
    if (rows.length > 0) out.push({ heading: group.heading, rows })
  }
  return out
}

/** Short status label shown beside each row. */
export function toolStorageStatusLabel(status: ToolStorageRowStatus): string {
  switch (status.kind) {
    case "account":
      return "Saved to account"
    case "local":
      return "This device only"
    case "syncing":
      return "Syncing…"
    case "synced":
      return "Synced"
    case "failed":
      return "Couldn't sync"
  }
}
