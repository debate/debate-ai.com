"use client"

/**
 * @fileoverview A one-line summary of the account tool-data sync in
 * Preferences, next to `TeamCoachingSection`: whether
 * every tool's local data is synced, and a link to `/tools`'s
 * `ToolSyncStatusPanel` for the per-collection failure list and a manual
 * retry. Deliberately stays this compact rather than re-duplicating that
 * panel here — see its own doc comment for why the full status list moved
 * off `/settings` to `/tools` in the first place; this just gives `/settings`
 * a way back to it instead of leaving the sync unobservable from here.
 *
 * @module components/settings/ToolSyncSection
 */

import Link from "next/link"
import { Wrench } from "lucide-react"
import { TOOL_RECORD_COLLECTIONS } from "@debate/data-sync/src/state/toolRecordCollections"
import { useToolRecordSync } from "../../lib/hooks/useToolRecordSync"
import { summarizeToolSyncFailures } from "../../lib/tools/tool-sync-status"
import { summarizeToolSyncStatus } from "../../lib/tools/tool-sync-summary"

const boxStyle = {
  marginBottom: 16,
  padding: 14,
  borderRadius: 10,
  border: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
} as const

/** Renders nothing signed out, matching `TeamCoachingSection`. */
export function ToolSyncSection() {
  const { enabled, reconciled, results } = useToolRecordSync()
  if (!enabled) return null

  const failureCount = summarizeToolSyncFailures(results).length
  const status = summarizeToolSyncStatus({
    reconciled,
    totalTools: TOOL_RECORD_COLLECTIONS.length,
    failureCount,
  })

  return (
    <section aria-label="Tools" style={boxStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <Wrench size={16} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tools &amp; data sync</h4>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.6 }}>{status}</p>
      <Link
        href="/tools"
        style={{ fontSize: 13, fontWeight: 600, color: "#24A0ED", textDecoration: "none" }}
      >
        {failureCount > 0 ? "Review and retry on the Tools page →" : "View your saved tool data →"}
      </Link>
    </section>
  )
}
