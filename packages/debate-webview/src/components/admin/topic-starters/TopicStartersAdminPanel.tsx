"use client"

/**
 * The admin panel's Topic starters section, for moderators and admins.
 *
 * Two cards: the queue of edits readers proposed from the docs sidebar
 * (moves, renames, deletes, new folders, file submissions and AI
 * reorganizations), each approved — which applies it — or rejected; and the
 * public catalogue itself as a tree, which staff rearrange directly through
 * the same change endpoint (their edits never queue).
 *
 * @module components/admin/topic-starters/TopicStartersAdminPanel
 */

import { useCallback, useEffect, useState } from "react"
import { Check, FolderPlus, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@debate-ai/ui/primitives/button"
import { Badge } from "@debate-ai/ui/primitives/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@debate-ai/ui/primitives/card"
import type { TopicStarterChange, TopicStarterChangeRow } from "@debate-ai/reason-docs/lib/topic-starters/changes"
import { editorHrefForSelection } from "@debate-ai/reason-docs/lib/reason-docs/route-selection"
import { TopicStarterTree, type TopicStarterItem } from "@debate-ai/reason-docs/docs/topic-starters/TopicStarterTree"
import { NewTopicFolderDialog } from "@debate-ai/reason-docs/docs/topic-starters/TopicStarterDialogs"

const KIND_LABELS: Record<TopicStarterChange["kind"], string> = {
  move: "Move",
  rename: "Rename",
  delete: "Delete",
  "create-folder": "New folder",
  submit: "New file",
  reorganize: "AI organize",
}

type AdminItem = Omit<TopicStarterItem, "content"> & { content?: string; published?: boolean }

export function TopicStartersAdminPanel() {
  const [changes, setChanges] = useState<TopicStarterChangeRow[]>([])
  const [items, setItems] = useState<AdminItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<number | null | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [changesRes, itemsRes] = await Promise.all([
        fetch("/api/admin/topic-starters/changes"),
        fetch("/api/admin/topic-starters"),
      ])
      if (!changesRes.ok || !itemsRes.ok) throw new Error(`the server answered ${changesRes.ok ? itemsRes.status : changesRes.status}`)
      const changesData = (await changesRes.json()) as { changes?: TopicStarterChangeRow[] }
      const itemsData = (await itemsRes.json()) as { items?: AdminItem[] }
      setChanges(changesData.changes ?? [])
      setItems((itemsData.items ?? []).filter((item) => item.published !== false))
    } catch (err) {
      setError(`Topic Starters could not be loaded (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const review = async (id: number, decision: "approve" | "reject") => {
    setBusyId(id)
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    try {
      const res = await fetch(`/api/admin/topic-starters/changes/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setRowErrors((prev) => ({ ...prev, [id]: data.error || `The server refused it (${res.status}).` }))
        return
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  /** A staff edit to the tree — applied at once by the change endpoint. */
  const edit = async (change: TopicStarterChange, done: string) => {
    setNotice(null)
    setError(null)
    const res = await fetch("/api/topic-starters/changes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(change),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(data.error || `The server refused it (${res.status}).`)
      return
    }
    setNotice(done)
    await load()
  }

  const titleOf = (id: number) => items.find((item) => item.id === id)?.title ?? "Item"
  const files = items.filter((item) => !item.isFolder).length

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Changes waiting for approval</CardTitle>
              <CardDescription>
                Edits readers proposed to the public Topic Starters from the docs sidebar. Approving applies the change.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading && changes.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting for review.</p>}
          {changes.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
              <Badge variant="secondary">{KIND_LABELS[row.change.kind]}</Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate">{row.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {row.submittedBy ?? "Unknown reader"} · {new Date(row.createdAt).toLocaleString()}
                </p>
                {(rowErrors[row.id] ?? row.error) && (
                  <p className="text-xs text-destructive">{rowErrors[row.id] ?? row.error}</p>
                )}
              </div>
              <Button size="sm" onClick={() => void review(row.id, "approve")} disabled={busyId === row.id} aria-label={`Approve: ${row.summary}`}>
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void review(row.id, "reject")}
                disabled={busyId === row.id}
                aria-label={`Reject: ${row.summary}`}
              >
                <X className="mr-1 h-4 w-4" />
                Reject
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Public Topic Starters</CardTitle>
              <CardDescription>
                Every shared topic starter that is public ({files.toLocaleString()} file{files === 1 ? "" : "s"}). Rename, move
                (drag a row onto a folder), delete or add folders — your edits apply right away.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setNewFolderParent(null)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New folder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          {notice && <p className="mb-2 text-sm text-muted-foreground">{notice}</p>}
          <div className="flex h-[420px] flex-col rounded-md border">
            <TopicStarterTree
              items={items as TopicStarterItem[]}
              onSelect={(item) => window.open(editorHrefForSelection({ kind: "topic", id: item.id }, items), "_blank")}
              onMove={(id, parentId) => void edit({ kind: "move", itemId: id, parentId }, `${titleOf(id)} moved.`)}
              onRename={(id, title) => void edit({ kind: "rename", itemId: id, title }, `Renamed to ${title}.`)}
              onDelete={(id) => {
                if (!window.confirm(`Delete ${titleOf(id)}${items.find((i) => i.id === id)?.isFolder ? " and everything in it" : ""}?`)) return
                void edit({ kind: "delete", itemId: id }, `${titleOf(id)} deleted.`)
              }}
              onCreateFolder={setNewFolderParent}
            />
          </div>
        </CardContent>
      </Card>

      <NewTopicFolderDialog
        parentId={newFolderParent}
        canEdit
        onClose={() => setNewFolderParent(undefined)}
        onCreate={(title, parentId) => void edit({ kind: "create-folder", title, parentId }, `Folder ${title} created.`)}
      />
    </>
  )
}
