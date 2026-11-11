"use client"

/**
 * @fileoverview "Restore from export…" under Settings → General → Saved to
 * your account. Picks a JSON file made by **Export** or **Export all as
 * JSON**, posts it to `POST /api/settings/saved-data`, and reports what came
 * back and what was skipped (items still in the account, invalid ones,
 * practice debates). The server only ever adds rows.
 *
 * @module components/settings/sections/RestoreSavedData
 */

import { useRef, useState } from "react"

type Kind = "docs" | "flows" | "rounds" | "practiceRounds"

interface RestoreReport {
  restored: Partial<Record<Kind, number>>
  skipped: Array<{ kind: Kind; title: string; reason: string }>
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
}

/** "Restored 2 flows and 1 document." — or the nothing-restored line. */
export function describeRestored(restored: RestoreReport["restored"]): string {
  const parts = (Object.keys(NOUNS) as Kind[])
    .filter((kind) => (restored[kind] ?? 0) > 0)
    .map((kind) => {
      const n = restored[kind] ?? 0
      return `${n} ${NOUNS[kind][n === 1 ? 0 : 1]}`
    })
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
      setState({ status: "done", report: { restored: body.restored, skipped: body.skipped ?? [] } })
      if (Object.values(body.restored).some((n) => (n ?? 0) > 0)) onRestored()
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
          <p>{describeRestored(state.report.restored)}</p>
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
