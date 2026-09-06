"use client"

/**
 * Native REASON editor route — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * The sidebar (file tree + "Open Tabs") is ported from quick search's
 * REASON editor sidebar (`packages/reason-editor-sidebar`), adapted to this
 * app's document model and primitives — see FileTree.tsx/OpenTabsPanel.tsx.
 * As in that sidebar, the enabled panels stack vertically (Files above Open
 * Tabs by default) instead of switching exclusively, and CardMirror is
 * mounted with `defaultNavPaneHidden` so the engine's own outline nav pane
 * doesn't claim a second sidebar's worth of the column — this page's docs
 * sidebar owns the side, and the outline stays one pull-tab / View-menu
 * toggle away.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookOpen, FilePlus2, FolderPlus, Loader2, PanelLeft, PanelsTopLeft } from "lucide-react"
import { EditorWithToolbar } from "debate-editor"
import { cn } from "../../lib/ui/lib/utils"
import { Button } from "../../lib/ui/primitives/button"
import { Input } from "../../lib/ui/primitives/input"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import { TopicStarterTree, type TopicStarterItem } from "./TopicStarterTree"
import type { ReasonDocument } from "./types"

const AUTOSAVE_DELAY_MS = 800
type SidebarPanel = "files" | "topicStarters" | "openTabs"

/** Which sidebar panels are shown, stacked top-to-bottom like the REASON
 *  sidebar this page is ported from (quick search's
 *  `packages/reason-editor-sidebar` stacks its enabled panels vertically
 *  rather than switching between them). Files + Open Tabs both visible is
 *  that sidebar's default view. */
const DEFAULT_PANELS: SidebarPanel[] = ["files", "openTabs"]
const PANELS_STORAGE_KEY = "reason-editor-sidebar-panels"

function loadPanels(): SidebarPanel[] {
  try {
    const raw = localStorage.getItem(PANELS_STORAGE_KEY)
    if (!raw) return DEFAULT_PANELS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_PANELS
    const valid = parsed.filter(
      (p): p is SidebarPanel => p === "files" || p === "topicStarters" || p === "openTabs",
    )
    return valid.length > 0 ? valid : DEFAULT_PANELS
  } catch {
    return DEFAULT_PANELS
  }
}

export default function ReasonEditorPage() {
  const [documents, setDocuments] = useState<ReasonDocument[]>([])
  const [openTabs, setOpenTabs] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [sidebarPanels, setSidebarPanels] = useState<SidebarPanel[]>(DEFAULT_PANELS)
  const [topicItems, setTopicItems] = useState<TopicStarterItem[]>([])
  const [topicDocument, setTopicDocument] = useState<TopicStarterItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Panel choice is a per-device view preference (same as the source
  // sidebar's persisted panel list); read after mount so SSR markup stays
  // deterministic.
  useEffect(() => {
    setSidebarPanels(loadPanels())
  }, [])

  const togglePanel = useCallback((panel: SidebarPanel) => {
    setSidebarPanels((prev) => {
      const next = prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
      if (next.length === 0) return prev // always keep at least one panel
      try {
        localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable (private mode) — the toggle still works for
        // this visit, it just won't be remembered.
      }
      return next
    })
  }, [])

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

  useEffect(() => {
    fetch("/api/topic-starters").then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => setTopicItems(data.items ?? [])).catch(() => setTopicItems([]))
  }, [])

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
            <Button size="icon" variant="ghost" onClick={() => createDocument(null, false)} title="New document">
              <FilePlus2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => createDocument(null, true)} title="New folder">
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Panel toggles — multi-select, so Files and Open Tabs stack
            together like the source REASON sidebar's default view. */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b">
          <button
            type="button"
            onClick={() => togglePanel("files")}
            aria-pressed={sidebarPanels.includes("files")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
              sidebarPanels.includes("files") ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <PanelLeft className="h-3.5 w-3.5" />
            Files
          </button>
          <button
            type="button"
            onClick={() => togglePanel("topicStarters")}
            aria-pressed={sidebarPanels.includes("topicStarters")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
              sidebarPanels.includes("topicStarters") ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Topic Starters
          </button>
          <button
            type="button"
            onClick={() => togglePanel("openTabs")}
            aria-pressed={sidebarPanels.includes("openTabs")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors",
              sidebarPanels.includes("openTabs") ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
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
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {sidebarPanels.includes("files") && (
              <div className="flex-1 min-h-0 flex flex-col">
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                  Files
                </p>
                <FileTree
                  documents={documents}
                  activeId={activeId}
                  onSelect={openDocument}
                  onAdd={createDocument}
                  onRename={updateTitle}
                  onDelete={deleteDocument}
                  onMove={moveDocument}
                />
              </div>
            )}
            {sidebarPanels.includes("topicStarters") && (
              <div className="flex-1 min-h-0 flex flex-col border-t first:border-t-0">
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                  Topic Starters
                </p>
                <TopicStarterTree
                  items={topicItems}
                  onSelect={(item) => {
                    setTopicDocument(item)
                    setActiveId(null)
                  }}
                />
              </div>
            )}
            {sidebarPanels.includes("openTabs") && (
              <div
                className={cn(
                  "min-h-0 flex flex-col border-t first:border-t-0",
                  // Alone it fills the sidebar; stacked under another panel
                  // it keeps to the lower portion like the source sidebar's
                  // vertical split.
                  sidebarPanels.length === 1 ? "flex-1" : "shrink-0 max-h-[40%]",
                )}
              >
                <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Open Tabs{openTabs.length > 0 && ` (${openTabs.length})`}
                  </p>
                  <button
                    type="button"
                    onClick={() => createDocument(null, false)}
                    title="New File"
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <OpenTabsPanel
                  documents={documents}
                  openTabs={openTabs}
                  activeId={activeId}
                  onSelect={setActiveId}
                  onClose={closeTab}
                />
              </div>
            )}
          </div>
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
              {topicDocument ? <span className="text-xs text-muted-foreground">Public topic starter</span> : saving && <span className="text-xs text-muted-foreground">Saving…</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* No React `key` here on purpose: `contentKey` already gives
                  each document a fresh claim (and undo history) inside the
                  CardMirror singleton, and a keyed remount would also rerun
                  the editor's mount effects — re-hiding a nav pane the user
                  pulled back open — on every document switch. */}
              <EditorWithToolbar
                content={topicDocument?.content ?? selected!.content}
                contentKey={topicDocument ? `topic-${topicDocument.id}` : String(selected!.id)}
                title={topicDocument?.title ?? selected!.title}
                showAiTools={!topicDocument}
                showOutline
                showToolbar={!topicDocument}
                defaultNavPaneHidden
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
