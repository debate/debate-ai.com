"use client"

/**
 * @fileoverview "Restore from export…" under Settings → General → Saved to
 * your account. Picks a JSON file made by **Export** or **Export all as
 * JSON**, posts it to `POST /api/settings/saved-data`, and reports what came
 * back (documents, flows, rounds, practice debates vs AI, word-count rounds,
 * drill sets, judge decisions, sent speeches and synced tool data) and what
 * was skipped (items still in the account, invalid ones). The server only
 * ever adds rows. Restored tool data starts a tool-record merge right away
 * (`resync` from `lib/tools/tool-sync-store`), so this device adopts it
 * without a reload.
 *
 * @module components/settings/sections/RestoreSavedData
 */

import { useRef, useState } from "react"
import { getToolSyncSnapshot } from "../../../lib/tools/tool-sync-store"

type Kind = "docs" | "flows" | "rounds" | "practiceRounds" | "wordCountRounds" | "drills" | "judgeDecisions" | "speeches"

interface RestoreReport {
  restored: Partial<Record<Kind, number>>
  /** Tool-data records written (opponent profiles, pinned debates, shortcuts…), across every tool. */
  restoredToolRecords?: number
  skipped: Array<{ kind: Kind | "toolRecords"; title: string; reason: string }>
}

type RestoreState =
  | { status: "idle" }
  | { status: "restoring" }
  | { status: "error"; message: string }
  | { status: "done"; report: RestoreReport }

const NOUNS: Record<Kind, [string, string]> = {
  docs: ["document", "documents"],
  flows: ["flow", "flows"],
  rounds: ["round", "rounds"],
  practiceRounds: ["practice debate", "practice debates"],
  wordCountRounds: ["word-count round", "word-count rounds"],
  drills: ["drill set", "drill sets"],
  judgeDecisions: ["judge decision", "judge decisions"],
  speeches: ["sent speech", "sent speeches"],
}

/** "Restored 2 flows, 1 document and 5 tool data records." — or the nothing-restored line. */
export function describeRestored(restored: RestoreReport["restored"], restoredToolRecords = 0): string {
  const parts = (Object.keys(NOUNS) as Kind[])
    .filter((kind) => (restored[kind] ?? 0) > 0)
    .map((kind) => {
      const n = restored[kind] ?? 0
      return `${n} ${NOUNS[kind][n === 1 ? 0 : 1]}`
    })
  if (restoredToolRecords > 0) parts.push(`${restoredToolRecords} tool data ${restoredToolRecords === 1 ? "record" : "records"}`)
  if (parts.length === 0) return "Nothing new to restore."
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
  return `Restored ${list}.`
}

export function RestoreSavedData({ onRestored }: { onRestored: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<RestoreState>({ status: "idle" })

  async function restore(file: File) {
    setState({ status: "restoring" })
    try {
      const res = await fetch("/api/settings/saved-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      })
      const body = (await res.json().catch(() => null)) as (RestoreReport & { error?: string }) | null
      if (!res.ok || !body || !body.restored) {
        setState({ status: "error", message: body?.error ?? "Couldn't restore this file. Try again later." })
        return
      }
      const restoredToolRecords = typeof body.restoredToolRecords === "number" ? body.restoredToolRecords : 0
      setState({ status: "done", report: { restored: body.restored, restoredToolRecords, skipped: body.skipped ?? [] } })
      if (restoredToolRecords > 0 || Object.values(body.restored).some((n) => (n ?? 0) > 0)) onRestored()
      // The tool-record merge adopts records only the account holds, so run
      // it now rather than waiting for the next page load or the 10-minute TTL.
      if (restoredToolRecords > 0) getToolSyncSnapshot().resync()
    } catch {
      setState({ status: "error", message: "Couldn't restore this file. Try again later." })
    }
  }

  return (
    <div className="mt-2 text-xs">
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Export file to restore"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void restore(file)
        }}
      />
      <button type="button" className="underline" disabled={state.status === "restoring"} onClick={() => input.current?.click()}>
        {state.status === "restoring" ? "Restoring…" : "Restore from export…"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <div role="status" className="mt-1 text-muted-foreground">
          <p>{describeRestored(state.report.restored, state.report.restoredToolRecords)}</p>
          {(state.report.restoredToolRecords ?? 0) > 0 && (
            <p>Restored tool data is syncing to this device now. On your other devices it shows up the next time they sync.</p>
          )}
          {state.report.skipped.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer">Skipped {state.report.skipped.length}</summary>
              <ul className="mt-1 space-y-0.5" aria-label="Skipped items">
                {state.report.skipped.map((skip, i) => (
                  <li key={i}>
                    <span className="text-foreground">{skip.title}</span> — {skip.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
