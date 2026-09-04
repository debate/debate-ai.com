"use client"

/**
 * Native REASON editor route — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * The sidebar (file tree + "Open Tabs") is ported from quick search's
 * REASON editor sidebar (`packages/reason-editor-sidebar`), adapted to this
 * app's document model and primitives — see FileTree.tsx/OpenTabsPanel.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FilePlus2, FolderPlus, Loader2, PanelLeft, PanelsTopLeft } from "lucide-react"
import { EditorWithToolbar } from "debate-editor"
import { cn } from "../../lib/ui/lib/utils"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import type { ReasonDocument } from "./types"

const AUTOSAVE_DELAY_MS = 800
type SidebarPanel = "files" | "openTabs"

export default function ReasonEditorPage() {
  const [documents, setDocuments] = useState<ReasonDocument[]>([])
  const [openTabs, setOpenTabs] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("files")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = useMemo(
    () => documents.find((d) => d.id === activeId) ?? null,
    [documents, activeId],
  )

  const loadDocuments = useCallback(async (selectFirst = false) => {
    setLoading(true)
    try {
      const res = await fetch("/api/doc/documents")
      const rows: ReasonDocument[] = await res.json()
      setDocuments(rows)
      if (selectFirst) {
        const firstFile = rows.find((d) => !d.isFolder)
        if (firstFile) {
          setOpenTabs([firstFile.id])
          setActiveId(firstFile.id)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments(true)
  }, [loadDocuments])

  const openDocument = useCallback((id: number) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveId(id)
  }, [])

  const closeTab = useCallback(
    (id: number) => {
      setOpenTabs((prev) => {
        const idx = prev.indexOf(id)
        const next = prev.filter((tabId) => tabId !== id)
        if (activeId === id) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null
          setActiveId(fallback ?? null)
        }
        return next
      })
    },
    [activeId],
  )

  const createDocument = useCallback(
    async (parentId: number | null = null, isFolder = false) => {
      const res = await fetch("/api/doc/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: isFolder ? "New Folder" : "Untitled",
          content: "",
          parentId,
          isFolder,
        }),
      })
      const created: ReasonDocument = await res.json()
      setDocuments((prev) => [created, ...prev])
      if (!isFolder) openDocument(created.id)
    },
    [openDocument],
  )

  const deleteDocument = useCallback(
    async (id: number) => {
      // Folders cascade: this app has no FK-enforced cascade delete, so
      // gather every descendant client-side before deleting.
      const idsToDelete: number[] = []
      const collect = (targetId: number) => {
        idsToDelete.push(targetId)
        for (const doc of documents) {
          if (doc.parentId === targetId) collect(doc.id)
        }
      }
      collect(id)

      await Promise.all(idsToDelete.map((docId) => fetch(`/api/doc/documents/${docId}`, { method: "DELETE" })))

      setDocuments((prev) => prev.filter((d) => !idsToDelete.includes(d.id)))
      setOpenTabs((prev) => prev.filter((tabId) => !idsToDelete.includes(tabId)))
      if (activeId != null && idsToDelete.includes(activeId)) setActiveId(null)
    },
    [documents, activeId],
  )

  const moveDocument = useCallback(async (id: number, parentId: number | null) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, parentId } : d)))
    await fetch(`/api/doc/documents/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentId }),
    })
  }, [])

  const saveDocument = useCallback((id: number, patch: { title?: string; content?: string }) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/doc/documents/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        })
      } finally {
        setSaving(false)
      }
    }, AUTOSAVE_DELAY_MS)
  }, [])

  const updateTitle = useCallback(
    (id: number, title: string) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)))
      saveDocument(id, { title })
    },
    [saveDocument],
  )

  const updateContent = useCallback(
    (id: number, content: string) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, content } : d)))
      saveDocument(id, { content })
    },
    [saveDocument],
  )

  return (
    <div className="h-dvh flex overflow-hidden pt-14 lg:pt-0 pb-20 lg:pb-0">
      <aside className="w-64 shrink-0 border-r flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h2 className="text-sm font-semibold">Reason Editor</h2>
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" onClick={() => createDocument(null, false)} title="New document">
              <FilePlus2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => createDocument(null, true)} title="New folder">
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 py-1.5 border-b">
          <button
            type="button"
            onClick={() => setSidebarPanel("files")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
              sidebarPanel === "files" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <PanelLeft className="h-3.5 w-3.5" />
            Files
          </button>
          <button
            type="button"
            onClick={() => setSidebarPanel("openTabs")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
              sidebarPanel === "openTabs" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" />
            Open Tabs
            {openTabs.length > 0 && <span className="text-muted-foreground">({openTabs.length})</span>}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sidebarPanel === "files" ? (
          <FileTree
            documents={documents}
            activeId={activeId}
            onSelect={openDocument}
            onAdd={createDocument}
            onRename={updateTitle}
            onDelete={deleteDocument}
            onMove={moveDocument}
          />
        ) : (
          <OpenTabsPanel
            documents={documents}
            openTabs={openTabs}
            activeId={activeId}
            onSelect={setActiveId}
            onClose={closeTab}
          />
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {openTabs.length > 0 && (
          <div className="flex items-center border-b overflow-x-auto shrink-0">
            {openTabs.map((id) => {
              const doc = documents.find((d) => d.id === id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveId(id)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 text-sm border-r shrink-0 max-w-[180px]",
                    id === activeId ? "bg-background font-medium" : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  <span className="truncate">{doc?.title || "Untitled"}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(id)
                    }}
                    className="shrink-0 h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  >
                    ×
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {selected ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <Input
                value={selected.title}
                onChange={(e) => updateTitle(selected.id, e.target.value)}
                className="max-w-sm h-8 text-sm font-medium"
                placeholder="Untitled"
              />
              {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <EditorWithToolbar
                key={selected.id}
                content={selected.content}
                contentKey={String(selected.id)}
                title={selected.title}
                showAiTools
                showOutline
                onChange={(html) => updateContent(selected.id, html)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {documents.length === 0 ? "Create a document to start writing." : "Select a file to open it."}
          </div>
        )}
      </div>
    </div>
  )
}
