"use client"

/**
 * Shared state for the REASON docs sidebar — the files tree, the "Open Tabs"
 * list and the topic-starter catalogue — lifted out of `/reason-editor`'s
 * page so the app's persistent sidebar (`AppSidebarShell`) can render those
 * panels on every tool route while `/reason-editor` renders the editor for
 * whatever they select.
 *
 * This mirrors how quick search's REASON sidebar
 * (`packages/reason-editor-sidebar`) is wired: the sidebar components are
 * pure views over a document list and tab list owned above them, so the same
 * panels can be mounted in a different shell without duplicating the CRUD.
 *
 * Loading is lazy: the provider mounts in the root layout (so the sidebar and
 * the editor share one copy of the state) but doesn't touch `/api/doc/...`
 * until someone calls {@link ReasonDocsContextValue.ensureLoaded} — the
 * editor page on mount, or the sidebar when its Documents section is opened.
 * Tool pages that never expand it pay for no fetch.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import type { ReasonDocument } from "./types"
import type { TopicStarterItem } from "./TopicStarterTree"

const AUTOSAVE_DELAY_MS = 800

export interface ReasonDocsContextValue {
  documents: ReasonDocument[]
  topicItems: TopicStarterItem[]
  openTabs: number[]
  activeId: number | null
  /** A read-only public topic starter shown in place of an owned document. */
  topicDocument: TopicStarterItem | null
  /** True while the initial document fetch is in flight. */
  loading: boolean
  /** True once that fetch has resolved (successfully or not). */
  loaded: boolean
  /** True while a debounced autosave is being flushed. */
  saving: boolean
  /** Fetches documents and topic starters once, on first request. */
  ensureLoaded: () => void
  /** Opens a document in a tab and makes it active. */
  openDocument: (id: number) => void
  /** Switches to an already-open tab. */
  selectTab: (id: number) => void
  closeTab: (id: number) => void
  createDocument: (parentId?: number | null, isFolder?: boolean) => Promise<void>
  deleteDocument: (id: number) => Promise<void>
  moveDocument: (id: number, parentId: number | null) => Promise<void>
  updateTitle: (id: number, title: string) => void
  updateContent: (id: number, content: string) => void
  selectTopicDocument: (item: TopicStarterItem) => void
}

const ReasonDocsContext = createContext<ReasonDocsContextValue | null>(null)

export function ReasonDocsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<ReasonDocument[]>([])
  const [topicItems, setTopicItems] = useState<TopicStarterItem[]>([])
  const [openTabs, setOpenTabs] = useState<number[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [topicDocument, setTopicDocument] = useState<TopicStarterItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards the lazy fetch: `loaded` only flips once the request resolves, so
  // it can't dedupe the calls the editor page and the sidebar make together
  // on the same render.
  const loadStartedRef = useRef(false)

  const ensureLoaded = useCallback(() => {
    if (loadStartedRef.current) return
    loadStartedRef.current = true
    setLoading(true)

    void fetch("/api/doc/documents")
      .then((res) => (res.ok ? (res.json() as Promise<ReasonDocument[]>) : []))
      .then((rows) => setDocuments(Array.isArray(rows) ? rows : []))
      .catch(() => setDocuments([]))
      .finally(() => {
        setLoading(false)
        setLoaded(true)
      })

    void fetch("/api/topic-starters")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setTopicItems(data.items ?? []))
      .catch(() => setTopicItems([]))
  }, [])

  const openDocument = useCallback((id: number) => {
    setTopicDocument(null)
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveId(id)
  }, [])

  const selectTab = useCallback((id: number) => {
    setTopicDocument(null)
    setActiveId(id)
  }, [])

  const closeTab = useCallback(
    (id: number) => {
      const idx = openTabs.indexOf(id)
      const next = openTabs.filter((tabId) => tabId !== id)
      setOpenTabs(next)
      // Closing the active tab falls through to its neighbour, preferring the
      // one that slid into its slot.
      if (activeId === id) setActiveId(next[idx] ?? next[idx - 1] ?? next[0] ?? null)
    },
    [openTabs, activeId],
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

  const selectTopicDocument = useCallback((item: TopicStarterItem) => {
    setTopicDocument(item)
    setActiveId(null)
  }, [])

  const value = useMemo<ReasonDocsContextValue>(
    () => ({
      documents,
      topicItems,
      openTabs,
      activeId,
      topicDocument,
      loading,
      loaded,
      saving,
      ensureLoaded,
      openDocument,
      selectTab,
      closeTab,
      createDocument,
      deleteDocument,
      moveDocument,
      updateTitle,
      updateContent,
      selectTopicDocument,
    }),
    [
      documents,
      topicItems,
      openTabs,
      activeId,
      topicDocument,
      loading,
      loaded,
      saving,
      ensureLoaded,
      openDocument,
      selectTab,
      closeTab,
      createDocument,
      deleteDocument,
      moveDocument,
      updateTitle,
      updateContent,
      selectTopicDocument,
    ],
  )

  return <ReasonDocsContext.Provider value={value}>{children}</ReasonDocsContext.Provider>
}

/** Throws outside the provider — every consumer renders under the root layout. */
export function useReasonDocs(): ReasonDocsContextValue {
  const ctx = useContext(ReasonDocsContext)
  if (!ctx) throw new Error("useReasonDocs must be used inside <ReasonDocsProvider>")
  return ctx
}
