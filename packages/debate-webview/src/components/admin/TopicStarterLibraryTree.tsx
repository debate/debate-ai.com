"use client"

/**
 * The imported Topic Starter folders and files as a tree, under the importer
 * on the admin panel's Imports tab, so an admin can tidy up what an upload
 * produced without leaving the page: drag a row onto a folder (or use its
 * "Move to" menu) to re-file it, or delete a file or a whole folder.
 *
 * Edits go straight to `/api/admin/topic-starters/[id]`, which applies the
 * same change records as every other catalogue edit, so what CardMirror
 * shows everyone changes with them. Unlike the Topic starters tab, this tree
 * also lists rows imported with "Share publicly" off — they came from this
 * importer and need cleaning up too.
 *
 * @module components/admin/TopicStarterLibraryTree
 */

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { editorHrefForSelection } from "../../lib/reason-docs/route-selection"
import { TopicStarterTree, type TopicStarterItem } from "../reason-docs/TopicStarterTree"

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

  /** Sends one edit to the item endpoint, then reloads the tree. */
  const edit = async (id: number, init: RequestInit, done: string) => {
    setNotice(null)
    setError(null)
    const res = await fetch(`/api/admin/topic-starters/${id}`, init)
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(data.error || `The server refused it (${res.status}).`)
      return
    }
    setNotice(done)
    await load()
  }

  const move = (id: number, parentId: number | null) => {
    const target = parentId == null ? "the top level" : titleOf(parentId)
    void edit(
      id,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ parentId }) },
      `${titleOf(id)} moved to ${target}.`,
    )
  }

  const remove = (id: number) => {
    const isFolder = items.find((item) => item.id === id)?.isFolder
    if (!window.confirm(`Delete ${titleOf(id)}${isFolder ? " and everything in it" : ""}? It disappears from CardMirror for everyone.`)) return
    void edit(id, { method: "DELETE" }, `${titleOf(id)} deleted.`)
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
            {unpublished > 0 ? `, ${unpublished.toLocaleString()} not shared publicly` : ""}. Drag a row onto a folder or use its
            &ldquo;Move to&rdquo; menu to move it; delete a file or a folder with everything in it from the same menu.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      <div className="flex h-[420px] flex-col rounded-md border">
        <TopicStarterTree
          items={items as TopicStarterItem[]}
          onSelect={(item) => window.open(editorHrefForSelection({ kind: "topic", id: item.id }, items), "_blank")}
          onMove={move}
          onDelete={remove}
        />
      </div>
    </section>
  )
}
