"use client"

/**
 * The imported Topic Starter folders and files as a tree, under the importer
 * on the admin panel's Imports tab, so an admin can tidy up what an upload
 * produced without leaving the page. Right-click a row (or use its "…"
 * button) to rename, copy, paste, move or delete it, or add a folder; rows
 * also move by dragging one onto a folder.
 *
 * Edits go straight to `/api/admin/topic-starters/[id]` (rename, move,
 * delete), `[id]/copy` (paste) and `items` (new folder), which apply the
 * same change records as every other catalogue edit, so what Debate Editor
 * shows everyone changes with them. Unlike the Topic starters tab, this tree
 * also lists rows imported with "Share publicly" off — they came from this
 * importer and need cleaning up too.
 *
 * @module components/admin/topic-starters/TopicStarterLibraryTree
 */

import { useCallback, useEffect, useState } from "react"
import { FolderPlus, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@debate-ai/ui/primitives/button"
import { editorHrefForSelection } from "../../../lib/reason-docs/route-selection"
import { TopicStarterTree, type TopicStarterItem } from "../../reason-docs/topic-starters/TopicStarterTree"
import { NewTopicFolderDialog } from "../../reason-docs/topic-starters/TopicStarterDialogs"

type LibraryItem = Omit<TopicStarterItem, "content"> & { published?: boolean }

/**
 * @param props.reloadKey - Bumped by the importer after each upload so the
 *   tree shows what was just imported.
 */
export function TopicStarterLibraryTree({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ id: number; title: string } | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<number | null | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/topic-starters")
      if (!res.ok) throw new Error(`the server answered ${res.status}`)
      const data = (await res.json()) as { items?: LibraryItem[] }
      setItems(data.items ?? [])
      setError(null)
    } catch (err) {
      setError(`The imported files could not be loaded (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  const titleOf = (id: number) => items.find((item) => item.id === id)?.title ?? "Item"

  /** Sends one edit to an admin Topic Starter endpoint, then reloads the tree. */
  const edit = async (path: string, init: RequestInit, done: string) => {
    setNotice(null)
    setError(null)
    const res = await fetch(`/api/admin/topic-starters/${path}`, init)
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(data.error || `The server refused it (${res.status}).`)
      return
    }
    setNotice(done)
    await load()
  }

  const send = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const placeOf = (parentId: number | null) => (parentId == null ? "the top level" : titleOf(parentId))

  const move = (id: number, parentId: number | null) => {
    void edit(String(id), send("PATCH", { parentId }), `${titleOf(id)} moved to ${placeOf(parentId)}.`)
  }

  const rename = (id: number, title: string) => {
    void edit(String(id), send("PATCH", { title }), `Renamed to ${title}.`)
  }

  const paste = (parentId: number | null) => {
    if (!copied) return
    void edit(`${copied.id}/copy`, send("POST", { parentId }), `Pasted a copy of ${copied.title} into ${placeOf(parentId)}.`)
  }

  const createFolder = (title: string, parentId: number | null) => {
    void edit("items", send("POST", { title, parentId, isFolder: true }), `Folder ${title} created.`)
  }

  const remove = (id: number) => {
    const isFolder = items.find((item) => item.id === id)?.isFolder
    if (!window.confirm(`Delete ${titleOf(id)}${isFolder ? " and everything in it" : ""}? It disappears from Debate Editor for everyone.`)) return
    if (copied?.id === id) setCopied(null)
    void edit(String(id), { method: "DELETE" }, `${titleOf(id)} deleted.`)
  }

  const files = items.filter((item) => !item.isFolder).length
  const unpublished = items.filter((item) => !item.isFolder && item.published === false).length

  return (
    <section aria-label="Imported files" className="flex flex-col gap-2 border-t pt-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <p className="font-medium">Imported files</p>
          <p className="text-muted-foreground">
            {files.toLocaleString()} file{files === 1 ? "" : "s"}
            {unpublished > 0 ? `, ${unpublished.toLocaleString()} not shared publicly` : ""}. Right-click a row to rename, copy,
            paste, move or delete it; drag a row onto a folder to move it.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewFolderParent(null)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New folder
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <div className="flex h-[420px] flex-col rounded-md border">
        <TopicStarterTree
          items={items as TopicStarterItem[]}
          onSelect={(item) => window.open(editorHrefForSelection({ kind: "topic", id: item.id }, items), "_blank")}
          onMove={move}
          onRename={rename}
          onDelete={remove}
          onCreateFolder={setNewFolderParent}
          onCopy={(item) => {
            setCopied({ id: item.id, title: item.title })
            setNotice(`Copied ${item.title}. Right-click a folder and choose Paste.`)
          }}
          onPaste={paste}
          clipboardTitle={copied?.title ?? null}
        />
      </div>
      <NewTopicFolderDialog
        parentId={newFolderParent}
        canEdit
        onClose={() => setNewFolderParent(undefined)}
        onCreate={createFolder}
      />
    </section>
  )
}
