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

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Copy, FilePlus2, FolderPlus, Library, Loader2, PanelLeft, PanelsTopLeft, Share2 } from "lucide-react"
import { toast } from "sonner"
import { EditorWithToolbar } from "debate-editor"
import { copySharedFileToDocuments, fetchSharedFile, shareDocument } from "debate-round"
import { useSession } from "@/lib/hooks/useSession"
import { cn } from "../../lib/ui/lib/utils"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import { TopicStarterTree, type TopicStarterItem } from "./TopicStarterTree"
import type { ReasonDocument } from "./types"

const AUTOSAVE_DELAY_MS = 800
type SidebarPanel = "files" | "topicStarters" | "openTabs"

/**
 * `/reason-editor` accepts two query params so `/library` (and any other
 * surface) can deep-link straight into a file: `?doc=<id>` opens one of the
 * user's own documents, `?shared=<id>` opens a shared-library file
 * read-only. `useSearchParams` needs a Suspense boundary above it.
 */
export default function ReasonEditorPage() {
  return (
    <Suspense>
      <ReasonEditorWorkspace />
    </Suspense>
  )
}

function ReasonEditorWorkspace() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedDocId = Number(searchParams.get("doc")) || null
  const requestedSharedId = Number(searchParams.get("shared")) || null
  const { isAuthenticated } = useSession()
  const [documents, setDocuments] = useState<ReasonDocument[]>([])
  const [openTabs, setOpenTabs] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("files")
  const [topicItems, setTopicItems] = useState<TopicStarterItem[]>([])
  const [topicDocument, setTopicDocument] = useState<TopicStarterItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = useMemo(
    () => documents.find((d) => d.id === activeId) ?? null,
    [documents, activeId],
  )

  const loadDocuments = useCallback(async (selectFirst = false, preferredId: number | null = null) => {
    setLoading(true)
    try {
      const res = await fetch("/api/doc/documents")
      const rows: ReasonDocument[] = await res.json()
      setDocuments(rows)
      if (selectFirst) {
        const preferred = preferredId !== null ? rows.find((d) => d.id === preferredId && !d.isFolder) : undefined
        const firstFile = preferred ?? rows.find((d) => !d.isFolder)
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
    // A `?shared=` deep link opens the shared file instead of the first document.
    loadDocuments(requestedSharedId === null, requestedDocId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link params are read once on mount
  }, [loadDocuments])

  // Every shared file this viewer can see: published packs/files from
  // everyone plus the viewer's own unpublished ones (`scope=all`).
  const loadSharedFiles = useCallback(() => {
    return fetch("/api/shared-files?scope=all").then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => setTopicItems(data.items ?? [])).catch(() => setTopicItems([]))
  }, [])

  useEffect(() => {
    void loadSharedFiles()
  }, [loadSharedFiles, isAuthenticated])

  useEffect(() => {
    if (requestedSharedId === null) return
    let cancelled = false
    fetchSharedFile(requestedSharedId).then((item) => {
      if (cancelled) return
      if (!item) {
        toast.error("That shared file isn't available.")
        return
      }
      setTopicDocument(item)
      setActiveId(null)
      setSidebarPanel("topicStarters")
    }).catch(() => toast.error("That shared file isn't available."))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link param is read once on mount
  }, [])

  const [sharing, setSharing] = useState(false)

  /** Publishes the open document to the shared library (re-sharing updates the same shared copy). */
  const shareCurrentDocument = useCallback(async (doc: ReasonDocument) => {
    setSharing(true)
    try {
      await shareDocument(doc.id)
      await loadSharedFiles()
      toast.success("Shared to the library.", { action: { label: "Manage", onClick: () => router.push("/library?tab=shared") } })
    } catch (error) {
      toast.error((error as Error).message || "Could not share this document.")
    } finally {
      setSharing(false)
    }
  }, [loadSharedFiles, router])

  /** Copies the open shared file into the viewer's own documents and switches to the copy. */
  const copySharedToDocuments = useCallback(async (item: TopicStarterItem) => {
    setSharing(true)
    try {
      const created = await copySharedFileToDocuments(item.id)
      setTopicDocument(null)
      await loadDocuments(true, created.id)
      setSidebarPanel("files")
      toast.success(`Saved "${created.title}" to your documents.`)
    } catch (error) {
      toast.error((error as Error).message || "Could not copy this file.")
    } finally {
      setSharing(false)
    }
  }, [loadDocuments])

  const openDocument = useCallback((id: number) => {
    setTopicDocument(null)
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
            <Button size="icon" variant="ghost" asChild title="My Library — manage documents, flows, and shared files">
              <Link href="/library" aria-label="My Library"><Library className="h-4 w-4" /></Link>
            </Button>
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
            onClick={() => setSidebarPanel("topicStarters")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
              sidebarPanel === "topicStarters" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
            Shared Files
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
        ) : sidebarPanel === "topicStarters" ? (
          <TopicStarterTree
            items={topicItems}
            onSelect={(item) => {
              setTopicDocument(item)
              setActiveId(null)
            }}
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

        {selected || topicDocument ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <Input
                value={topicDocument?.title ?? selected?.title ?? ""}
                onChange={(e) => selected && updateTitle(selected.id, e.target.value)}
                readOnly={Boolean(topicDocument)}
                className="max-w-sm h-8 text-sm font-medium"
                placeholder="Untitled"
              />
              {topicDocument ? (
                <>
                  <span className="text-xs text-muted-foreground">{topicDocument.ownerId === null ? "Topic Starter (read-only)" : "Shared file (read-only)"}</span>
                  <Button size="sm" variant="outline" className="ml-auto" disabled={sharing} onClick={() => copySharedToDocuments(topicDocument)} title="Save an editable copy to my documents">
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Save a copy
                  </Button>
                </>
              ) : (
                <>
                  {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={sharing || !isAuthenticated}
                    onClick={() => selected && shareCurrentDocument(selected)}
                    title={isAuthenticated ? "Publish this document to the shared library" : "Sign in to share documents"}
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share to library
                  </Button>
                </>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <EditorWithToolbar
                key={topicDocument ? `topic-${topicDocument.id}` : selected!.id}
                content={topicDocument?.content ?? selected!.content}
                contentKey={topicDocument ? `topic-${topicDocument.id}` : String(selected!.id)}
                title={topicDocument?.title ?? selected!.title}
                showAiTools={!topicDocument}
                showOutline
                showToolbar={!topicDocument}
                onChange={topicDocument ? undefined : (html) => updateContent(selected!.id, html)}
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
