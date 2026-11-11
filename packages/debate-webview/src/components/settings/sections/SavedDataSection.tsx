"use client"

/**
 * @fileoverview Settings → General → "Saved to your account": how many
 * documents, flows, rounds, practice debates and drill sets are stored in SQL
 * under the signed-in user, from `/api/settings/saved-data`; signed-out
 * visitors see a sign-in hint instead of a request. **Manage** lists the rows
 * of one kind (`/api/settings/saved-data/[kind]`) with open / export links,
 * plus Delete for every kind the server marks `deletable`.
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
  /** Tool page for this kind; absent from servers that predate open links. */
  href?: string | null
}

interface SavedToolCollection {
  collection: string
  label: string
  count: number
  /** Tool page that owns the collection; null when that page is gone. */
  href?: string | null
}

/** A summary label, linked to its tool when there is one so the count leads straight to the work. */
function SavedLabel({ label, href }: { label: string; href?: string | null }) {
  return (
    <dt className="text-muted-foreground">
      {href ? (
        <a href={href} className="hover:text-foreground hover:underline" title={`Open ${label.toLowerCase()} in its tool`}>
          {label}
        </a>
      ) : (
        label
      )}
    </dt>
  )
}

interface SavedDataSummary {
  items: SavedDataItem[]
  /** Absent from servers that predate tool-record counts. */
  tools?: SavedToolCollection[]
  total: number
}

/** Kinds the server lets a user list one by one (`ITEM_KINDS` in `saved-data-items.ts`). */
const MANAGEABLE_KINDS = new Set(["docs", "flows", "rounds", "practiceRounds", "drills"])

/** Where to remove rows of a kind Settings can't delete, shown in place of Delete. */
const REMOVE_ELSEWHERE_HINTS: Record<string, string> = {
  drills: "To remove a drill set, use Clear on the Drill Sets page — that clears it on this device and in your account.",
}

interface ManagedPage {
  items: ManagedItem[]
  hasMore?: boolean
  /** Absent from servers that predate it, which only listed deletable kinds. */
  deletable?: boolean
}

/** Longest search the server accepts (`MAX_QUERY_LENGTH` in `saved-data-items.ts`). */
const MAX_QUERY_LENGTH = 100

/**
 * Kinds whose title can be renamed from here. Only documents: their title is
 * stored in SQL and read back by the REASON editor, so `PUT
 * /api/doc/documents/[id]` is the source of truth. Flow and round labels live
 * in the browser's flow store and are pushed up on every sync, so a rename
 * here would be overwritten — they are renamed in the flow tool instead.
 */
const RENAMABLE_KINDS = new Set(["docs"])

/** Longest title accepted from the Rename prompt. */
export const MAX_TITLE_LENGTH = 200

/** Cleans a typed title: trimmed and capped; `null` when it is blank or unchanged, so no request is sent. */
export function normalizeRenameTitle(input: string | null, current: string): string | null {
  if (input === null) return null
  const next = input.trim().slice(0, MAX_TITLE_LENGTH).trim()
  return next && next !== current ? next : null
}

interface ManagedItem {
  id: number
  title: string
  updatedAt: string
  href: string | null
}

/** Builds the Manage-list URL for one page; `q` filters by title on the server (`saved-data-items.ts`). */
export function manageListUrl(kind: string, offset: number, query: string): string {
  const params = new URLSearchParams()
  if (offset > 0) params.set("offset", String(offset))
  const q = query.trim()
  if (q) params.set("q", q)
  const search = params.toString()
  return `/api/settings/saved-data/${kind}${search ? `?${search}` : ""}`
}

/** Expandable per-item list for one kind, with title search, open links and a confirmed delete. */
function ManageKind({ kind, label, onDeleted }: { kind: string; label: string; onDeleted: () => void }) {
  const [items, setItems] = useState<ManagedItem[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [deletable, setDeletable] = useState(true)
  const [error, setError] = useState(false)
  /** Text in the search box, and the query the shown list was actually fetched with. */
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState("")

  /** Fetches one page after `offset` rows; `hasMore` and `deletable` are absent from servers that predate them. */
  async function fetchPage(offset: number) {
    const res = await fetch(manageListUrl(kind, offset, query))
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()) as ManagedPage
  }

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(false)
    fetchPage(0)
      .then((body) => {
        if (cancelled) return
        setItems(body.items)
        setHasMore(Boolean(body.hasMore))
        setDeletable(body.deletable !== false)
      })
      .catch(() => !cancelled && setLoadFailed(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchPage only closes over `kind` and `query`
  }, [kind, query])

  async function loadMore() {
    if (!items) return
    setLoadingMore(true)
    setActionError(null)
    try {
      // Deleted rows are gone server-side too, so the rows still shown are exactly the offset; the id filter below guards any other drift.
      const body = await fetchPage(items.length)
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

  async function rename(item: ManagedItem) {
    if (typeof window === "undefined") return
    const title = normalizeRenameTitle(window.prompt(`Rename "${item.title}"`, item.title), item.title)
    if (!title) return
    try {
      const res = await fetch(`/api/doc/documents/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const saved = (await res.json().catch(() => null)) as { title?: unknown } | null
      const nextTitle = typeof saved?.title === "string" && saved.title ? saved.title : title
      setItems((current) => current?.map((i) => (i.id === item.id ? { ...i, title: nextTitle } : i)) ?? null)
    } catch {
      setError(true)
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

  const noun = label.toLowerCase()
  const search = (
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
        value={draft}
        maxLength={MAX_QUERY_LENGTH}
        onChange={(event) => {
          setDraft(event.target.value)
          // Clearing the box (or its built-in clear button) shows everything again without a submit.
          if (!event.target.value.trim() && query) setQuery("")
        }}
        placeholder={`Search ${noun} by title`}
        aria-label={`Search saved ${noun} by title`}
        className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
      />
      <button type="submit" className="shrink-0 text-xs underline">
        Search
      </button>
    </form>
  )

  if (error) return <p className="mt-1 text-xs text-muted-foreground">Couldn't update {noun}. Try again later.</p>
  if (!items) return <>{search}<p className="mt-1 text-xs text-muted-foreground">Loading…</p></>
  return (
    <>
    {search}
    {items.length === 0 && query && (
      <p className="mt-1 text-xs text-muted-foreground">No saved {noun} match "{query}".</p>
    )}
    <ul className="mt-1 space-y-1" aria-label={`Saved ${noun}`}>
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
          {deletable && (
            <button type="button" className="shrink-0 text-destructive hover:underline" onClick={() => void remove(item)}>
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
    {!deletable && REMOVE_ELSEWHERE_HINTS[kind] && <p className="mt-1 text-xs text-muted-foreground">{REMOVE_ELSEWHERE_HINTS[kind]}</p>}
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
                <SavedLabel label={item.label} href={item.href} />
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
                <SavedLabel label={tool.label} href={tool.href} />
                <dd className="font-medium tabular-nums">{tool.count}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
