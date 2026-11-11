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

/** URL of one page of a kind's Manage list; `q` narrows it to matching titles. */
export function savedItemsPageUrl(kind: string, offset = 0, query = ""): string {
  const params = new URLSearchParams()
  if (offset > 0) params.set("offset", String(offset))
  const q = query.trim()
  if (q) params.set("q", q)
  const search = params.toString()
  return `/api/settings/saved-data/${kind}${search ? `?${search}` : ""}`
}

/** Expandable per-item list for one kind, with a title search, open links and a confirmed delete. */
function ManageKind({ kind, label, onDeleted }: { kind: string; label: string; onDeleted: () => void }) {
  const [items, setItems] = useState<ManagedItem[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  /** Search text being typed, and the search the list currently shows. */
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")

  /** Fetches one page after `offset` rows; `hasMore` is absent from servers that predate paging. */
  async function fetchPage(offset: number) {
    const res = await fetch(savedItemsPageUrl(kind, offset, query))
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as { items: ManagedItem[]; hasMore?: boolean }
  }

  useEffect(() => {
    let cancelled = false
    setItems(null)
    fetchPage(0)
      .then((body) => {
        if (cancelled) return
        setItems(body.items)
        setHasMore(Boolean(body.hasMore))
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage only closes over `kind` and `query`
  }, [kind, query])

  async function loadMore() {
    if (!items) return
    setLoadingMore(true)
    try {
      // Deleted rows are gone server-side too, so the rows still shown are exactly the offset; the id filter below guards any other drift.
      const body = await fetchPage(items.length)
      setItems((current) => {
        const seen = new Set((current ?? []).map((i) => i.id))
        return [...(current ?? []), ...body.items.filter((i) => !seen.has(i.id))]
      })
      setHasMore(Boolean(body.hasMore))
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  async function remove(item: ManagedItem) {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${item.title}" from your account? This can't be undone.`)) return
    try {
      const res = await fetch(`/api/settings/saved-data/${kind}?id=${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(String(res.status))
      setItems((current) => current?.filter((i) => i.id !== item.id) ?? null)
      onDeleted()
    } catch {
      setError(true)
    }
  }

  if (error) return <p className="mt-1 text-xs text-muted-foreground">Couldn't update {label.toLowerCase()}. Try again later.</p>
  const searchLabel = `Search saved ${label.toLowerCase()}`
  return (
    <>
    <form
      role="search"
      className="mt-1 flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        setQuery(draft.trim())
      }}
    >
      <input
        type="search"
        aria-label={searchLabel}
        placeholder="Search titles"
        maxLength={100}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          // Clearing the box (including the native ✕) goes straight back to the full list.
          if (!event.target.value.trim() && query) setQuery("")
        }}
        className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
      />
      <button type="submit" className="shrink-0 text-xs underline">
        Search
      </button>
    </form>
    {!items ? (
      <p className="mt-1 text-xs text-muted-foreground">Loading…</p>
    ) : items.length === 0 && query ? (
      <p className="mt-1 text-xs text-muted-foreground">No saved {label.toLowerCase()} match "{query}".</p>
    ) : (
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
    )}
    {items && hasMore && (
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
