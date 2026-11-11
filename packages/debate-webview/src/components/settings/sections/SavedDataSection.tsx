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

/** Kinds the server lets a user list and delete one by one (`saved-data-items.ts`). */
const MANAGEABLE_KINDS = new Set(["docs", "flows", "rounds", "practiceRounds"])

interface ManagedItem {
  id: number
  title: string
  updatedAt: string
  href: string | null
}

/** Fetches one page of a kind's items after `offset` rows; `hasMore` is absent from servers that predate paging. */
async function fetchKindPage(kind: string, offset: number) {
  const res = await fetch(`/api/settings/saved-data/${kind}${offset > 0 ? `?offset=${offset}` : ""}`)
  if (!res.ok) throw new Error(String(res.status))
  return (await res.json()) as { items: ManagedItem[]; hasMore?: boolean }
}

/**
 * Expandable per-item list for one kind, with open links and a confirmed delete.
 * A failed first load offers **Try again**; a failed delete or **Load more**
 * keeps the rows already shown and reports the failure inline.
 */
function ManageKind({ kind, label, onDeleted }: { kind: string; label: string; onDeleted: () => void }) {
  const [items, setItems] = useState<ManagedItem[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  /** Bumped by **Try again** to re-run the first-page load. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoadFailed(false)
    fetchKindPage(kind, 0)
      .then((body) => {
        if (cancelled) return
        setItems(body.items)
        setHasMore(Boolean(body.hasMore))
      })
      .catch(() => !cancelled && setLoadFailed(true))
    return () => {
      cancelled = true
    }
  }, [kind, attempt])

  async function loadMore() {
    if (!items) return
    setLoadingMore(true)
    setActionError(null)
    try {
      // Deleted rows are gone server-side too, so the rows still shown are exactly the offset; the id filter below guards any other drift.
      const body = await fetchKindPage(kind, items.length)
      setItems((current) => {
        const seen = new Set((current ?? []).map((i) => i.id))
        return [...(current ?? []), ...body.items.filter((i) => !seen.has(i.id))]
      })
      setHasMore(Boolean(body.hasMore))
    } catch {
      setActionError(`Couldn't load more ${label.toLowerCase()}. Try again.`)
    } finally {
      setLoadingMore(false)
    }
  }

  async function remove(item: ManagedItem) {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${item.title}" from your account? This can't be undone.`)) return
    setActionError(null)
    try {
      const res = await fetch(`/api/settings/saved-data/${kind}?id=${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(String(res.status))
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? null)
      onDeleted()
    } catch {
      setActionError(`Couldn't delete "${item.title}". Try again.`)
    }
  }

  if (loadFailed) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        Couldn't load {label.toLowerCase()}.{" "}
        <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </p>
    )
  }
  if (!items) return <p className="mt-1 text-xs text-muted-foreground">Loading…</p>
  return (
    <>
    <ul className="mt-1 space-y-1" aria-label={`Saved ${label.toLowerCase()}`}>
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
          {item.href ? (
            <a href={item.href} className="truncate underline">{item.title}</a>
          ) : (
            <span className="truncate">{item.title}</span>
          )}
          <a href={`/api/settings/saved-data/${kind}?id=${item.id}`} download className="shrink-0 underline">
            Export
          </a>
          <button type="button" className="shrink-0 text-destructive hover:underline" onClick={() => void remove(item)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
    {actionError && (
      <p role="alert" className="mt-1 text-xs text-destructive">
        {actionError}
      </p>
    )}
    {hasMore && (
      <button type="button" className="mt-1 text-xs underline" disabled={loadingMore} onClick={() => void loadMore()}>
        {loadingMore ? "Loading…" : "Load more"}
      </button>
    )}
    </>
  )
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: SavedDataSummary }

export function SavedDataSection() {
  const { user, isLoading } = useSession()
  const signedIn = Boolean(user)
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [managing, setManaging] = useState<string | null>(null)

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
            <div key={item.key} className="col-span-2 sm:col-span-1">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-medium tabular-nums">
                  {MANAGEABLE_KINDS.has(item.key) && item.count > 0 && (
                    <button
                      type="button"
                      className="mr-2 text-xs font-normal underline"
                      aria-expanded={managing === item.key}
                      onClick={() => setManaging(managing === item.key ? null : item.key)}
                    >
                      {managing === item.key ? "Hide" : "Manage"}
                    </button>
                  )}
                  {item.count}
                </dd>
              </div>
              {managing === item.key && (
                <ManageKind
                  kind={item.key}
                  label={item.label}
                  onDeleted={() =>
                    setState((s) =>
                      s.status === "ready"
                        ? {
                            status: "ready",
                            summary: {
                              ...s.summary,
                              total: Math.max(0, s.summary.total - 1),
                              items: s.summary.items.map((i) => (i.key === item.key ? { ...i, count: Math.max(0, i.count - 1) } : i)),
                            },
                          }
                        : s,
                    )
                  }
                />
              )}
            </div>
          ))}
        </dl>
      )}
      {state.status === "ready" && signedIn && state.summary.total > 0 && (
        <a href="/api/settings/saved-data?export=all" download className="mt-3 inline-block text-xs underline">
          Export all as JSON
        </a>
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
