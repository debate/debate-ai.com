"use client"

/**
 * @fileoverview Settings → General → "Saved to your account": how many
 * documents, flows, rounds and practice debates are stored in SQL under the
 * signed-in user. Counts only, from `/api/settings/saved-data`; signed-out
 * visitors see a sign-in hint instead of a request.
 *
 * @module components/settings/sections/SavedDataSection
 */

import { useEffect, useState } from "react"
import { Database } from "lucide-react"
import { useSession } from "../../../lib/hooks/useSession"

interface SavedDataItem {
  key: string
  label: string
  count: number
}

interface SavedToolCollection {
  collection: string
  label: string
  count: number
}

interface SavedDataSummary {
  items: SavedDataItem[]
  /** Absent from servers that predate tool-record counts. */
  tools?: SavedToolCollection[]
  total: number
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: SavedDataSummary }

export function SavedDataSection() {
  const { user, isLoading } = useSession()
  const signedIn = Boolean(user)
  const [state, setState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    setState({ status: "loading" })
    fetch("/api/settings/saved-data")
      .then((res) => (res.ok ? (res.json() as Promise<SavedDataSummary>) : Promise.reject(new Error(String(res.status)))))
      .then((summary) => !cancelled && setState({ status: "ready", summary }))
      .catch(() => !cancelled && setState({ status: "error" }))
    return () => {
      cancelled = true
    }
  }, [signedIn])

  return (
    <section
      id="saved-data"
      aria-labelledby="saved-data-heading"
      className="mb-4 rounded-lg border border-border p-4"
    >
      <h4
        id="saved-data-heading"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <Database className="h-4 w-4" aria-hidden="true" />
        Saved to your account
      </h4>
      {isLoading ? null : !signedIn ? (
        <p className="text-sm text-muted-foreground">
          Sign in to save your documents, flows and debates to your account and use them on any device.
        </p>
      ) : state.status === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : state.status === "error" ? (
        <p className="text-sm text-muted-foreground">Couldn't load your saved data. Try again later.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {state.summary.items.map((item) => (
            <div key={item.key} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd className="font-medium tabular-nums">{item.count}</dd>
            </div>
          ))}
        </dl>
      )}
      {state.status === "ready" && signedIn && (state.summary.tools?.length ?? 0) > 0 && (
        <>
          <h5 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tool data
          </h5>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {state.summary.tools?.map((tool) => (
              <div key={tool.collection} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{tool.label}</dt>
                <dd className="font-medium tabular-nums">{tool.count}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
