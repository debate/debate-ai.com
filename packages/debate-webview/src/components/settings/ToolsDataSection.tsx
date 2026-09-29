"use client"

import Link from "next/link"
import { Database } from "lucide-react"
import { useToolRecordSync } from "../../lib/hooks/useToolRecordSync"
import { summarizeToolSyncFailures } from "../../lib/tools/tool-sync-status"

/**
 * A compact link into `/tools`' full account-sync status and "My Saved
 * Items", at the top of the Preferences tab, next to `PlanUpgradeSection`
 * and `TeamCoachingSection`.
 *
 * Deliberately not a second copy of `ToolSyncStatusPanel` — same
 * `useToolRecordSync` state, but just a status line and a link, so `/tools`
 * stays the one place with the per-tool retry list and the "My Saved
 * Items" browser across all ~20 synced kinds (flows, docs, debates,
 * evidence, drills, …). Renders nothing signed out, matching
 * `ToolSyncStatusPanel`'s own signed-out behavior.
 */
export function ToolsDataSection() {
  const { enabled, reconciled, results } = useToolRecordSync()
  if (!enabled) return null

  const failures = summarizeToolSyncFailures(results)
  const status = !reconciled
    ? "Syncing your saved flows, docs and debates…"
    : failures.length === 0
      ? "All your saved flows, docs and debates are synced to your account."
      : `${failures.length} tool${failures.length === 1 ? "" : "s"} couldn't sync just now.`

  return (
    <section
      aria-label="Tools & data"
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 10,
        border: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <Database size={16} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tools &amp; data</h4>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.6 }}>{status}</p>
      <Link
        href="/tools"
        style={{
          display: "inline-block",
          padding: "6px 14px",
          borderRadius: 8,
          background: "#24A0ED",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Manage saved flows, docs &amp; debates
      </Link>
    </section>
  )
}
