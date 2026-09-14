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
 *
 * Two things here are about the file *format* rather than the file list, and
 * both exist so an uploaded `.docx` stays a CardMirror file:
 *
 *  - {@link ReasonDocsContextValue.importFiles} converts an upload with
 *    CardMirror's own importer and stores the `.cmir` it produces, never card
 *    HTML — see `lib/cardmirror/stored-cmir.ts` for why that is the only shape
 *    that keeps a Verbatim document intact.
 *  - Editing such a file re-encodes it back to `.cmir` before the write, so
 *    the first keystroke doesn't silently downgrade the document to markup.
 *    The editor reports HTML, so the live copy of an open file is held as HTML
 *    in a ref (`openHtmlRef`) and encoded on the way out, on its own debounce —
 *    gzipping a card file on every keystroke would be felt.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DocumentSaveQueue, type SaveQueueState } from "@/lib/reason-docs/save-queue"
import { STORED_FORMATS } from "@/lib/cardmirror/format"
import { isCmirContent } from "@/lib/cardmirror/content-format"
import {
  CardMirrorImportError,
  fileToStoredCmir,
  htmlToStoredCmir,
  htmlToStoredCmirSync,
  storedContentToHtml,
} from "@/lib/cardmirror/stored-cmir"
import type { ReasonDocument } from "./types"
import type { TopicStarterItem } from "./TopicStarterTree"

/** How long an edit to a `.cmir` file waits before it is re-encoded. The write
 *  is queued once the encode resolves, so this sits in front of the save
 *  queue's own debounce rather than overlapping it — short enough that the
 *  extra wait is not felt, long enough that a burst of typing gzips the
 *  document once instead of per keystroke. */
const CMIR_ENCODE_DELAY_MS = 600

/** What one upload produced, for the caller that has to report it. */
export interface ImportOutcome {
  /** Documents created, in upload order. */
  created: ReasonDocument[]
  /** One message per file that could not be imported, ready to show. */
  failures: string[]
}

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
  /** True while an edit is queued but not yet acknowledged by the server. */
  unsaved: boolean
  /** True when the last write for some document failed and is being retried. */
  saveFailed: boolean
  /** True while an upload is being converted and stored. */
  importing: boolean
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
  /**
   * Imports uploaded files as CardMirror `.cmir` documents under `parentId`,
   * opening the first one. Never throws: a file that cannot be converted comes
   * back in `failures` so one bad file in a drop doesn't lose the rest.
   */
  importFiles: (files: readonly File[], parentId?: number | null) => Promise<ImportOutcome>
  /** The open document's content as HTML, whatever shape the row is stored in. */
  documentHtml: (doc: ReasonDocument) => string
  /**
   * Opens a public file by the name a URL carries, for a link whose file this
   * client hasn't loaded — the catalogue is capped, and a signed-out reader
   * following a shared link has no documents at all. Resolves to true when the
   * lookup found something.
   */
  openPublicByRef: (ref: string) => Promise<boolean>
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
  const [importing, setImporting] = useState(false)
  const [saveState, setSaveState] = useState<SaveQueueState>({
    pendingIds: [],
    saving: false,
    failedIds: [],
  })
  // One queue for the whole app: per-document debounces, merged patches,
  // retry on failure, and a flush when the page goes away. See
  // `lib/reason-docs/save-queue.ts` for why each of those is load-bearing.
  const saveQueueRef = useRef<DocumentSaveQueue | null>(null)
  if (!saveQueueRef.current) {
    saveQueueRef.current = new DocumentSaveQueue({ onStateChange: setSaveState })
  }
  const saveQueue = saveQueueRef.current
  // Guards the lazy fetch: `loaded` only flips once the request resolves, so
  // it can't dedupe the calls the editor page and the sidebar make together
  // on the same render.
  const loadStartedRef = useRef(false)

  // The live HTML of every document opened this session. A ref rather than
  // state because it is written on every keystroke and read only when the
  // editor mounts a document — putting it in state would re-render the whole
  // sidebar for each character typed.
  const openHtmlRef = useRef(new Map<number, string>())
  const encodeTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  // Edits to `.cmir` files whose encode hasn't run yet. Held separately from
  // `openHtmlRef` (which keeps every open file's HTML for the whole session)
  // because this is the set that would be *lost* if the page went away now.
  const pendingCmirRef = useRef(new Map<number, string>())

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

      // Drop queued writes first: a debounced PUT landing after the DELETE
      // would 404, and one landing before it would just be wasted work.
      for (const docId of idsToDelete) {
        saveQueue.cancel(docId)
        const timer = encodeTimersRef.current.get(docId)
        if (timer) clearTimeout(timer)
        encodeTimersRef.current.delete(docId)
        pendingCmirRef.current.delete(docId)
        openHtmlRef.current.delete(docId)
      }

      await Promise.all(idsToDelete.map((docId) => fetch(`/api/doc/documents/${docId}`, { method: "DELETE" })))

      setDocuments((prev) => prev.filter((d) => !idsToDelete.includes(d.id)))
      setOpenTabs((prev) => prev.filter((tabId) => !idsToDelete.includes(tabId)))
      if (activeId != null && idsToDelete.includes(activeId)) setActiveId(null)
    },
    [documents, activeId, saveQueue],
  )

  const moveDocument = useCallback(
    async (id: number, parentId: number | null) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, parentId } : d)))
      // Through the same queue as title/content edits: a re-parent now gets
      // retry-with-backoff and a `pagehide`/tab-hide flush instead of a
      // fire-and-forget PUT that silently drops on a network blip.
      saveQueue.queue(id, { parentId })
    },
    [saveQueue],
  )

  /**
   * Turns every edit still waiting to be gzipped into bytes and queues it,
   * on this thread.
   *
   * The debounced encode below is the reason this exists: without it an edit
   * made in the last half-second before the tab closes has no `content` for
   * `flushAll` to send, and is simply gone. A file that will not encode is
   * skipped rather than queued — leaving the stored `.cmir` alone beats
   * overwriting it with a failure on the way out.
   */
  const flushPendingEncodes = useCallback(() => {
    for (const [id, html] of pendingCmirRef.current) {
      const timer = encodeTimersRef.current.get(id)
      if (timer) clearTimeout(timer)
      encodeTimersRef.current.delete(id)
      try {
        saveQueue.queue(id, { content: htmlToStoredCmirSync(html) })
      } catch (error) {
        console.error("[reason-docs] could not re-encode document as .cmir", error)
      }
    }
    pendingCmirRef.current.clear()
  }, [saveQueue])

  // Nothing queued may be lost to a navigation: `pagehide` fires on tab
  // close, reload and bfcache entry, and `visibilitychange` is often the
  // last event a backgrounded mobile tab gets. Both send with `keepalive`
  // so the browser completes the write after the page is gone.
  useEffect(() => {
    const flush = () => {
      flushPendingEncodes()
      void saveQueue.flushAll({ keepalive: true })
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", flush)
      document.removeEventListener("visibilitychange", onVisibility)
      flush()
      saveQueue.dispose()
    }
  }, [saveQueue, flushPendingEncodes])

  const saveDocument = useCallback(
    (id: number, patch: { title?: string; content?: string }) => {
      saveQueue.queue(id, patch)
    },
    [saveQueue],
  )

  const updateTitle = useCallback(
    (id: number, title: string) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)))
      saveDocument(id, { title })
    },
    [saveDocument],
  )

  const documentHtml = useCallback((doc: ReasonDocument) => {
    // An edit made this session wins over the stored copy: switching tabs and
    // back must not hand the editor the version from before you typed.
    return openHtmlRef.current.get(doc.id) ?? storedContentToHtml(doc)
  }, [])

  const updateContent = useCallback(
    (id: number, html: string) => {
      openHtmlRef.current.set(id, html)
      const doc = documents.find((d) => d.id === id)

      if (!doc || !isCmirContent(doc)) {
        // HTML row: the editor's own output *is* the stored form.
        setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, content: html } : d)))
        saveDocument(id, { content: html })
        return
      }

      // `.cmir` row: gzip the document on its own debounce rather than on this
      // keystroke, and coalesce — only the last HTML for this document is ever
      // encoded.
      const existing = encodeTimersRef.current.get(id)
      if (existing) clearTimeout(existing)
      pendingCmirRef.current.set(id, html)
      encodeTimersRef.current.set(
        id,
        setTimeout(() => {
          encodeTimersRef.current.delete(id)
          const latest = pendingCmirRef.current.get(id)
          if (latest === undefined) return
          pendingCmirRef.current.delete(id)
          void htmlToStoredCmir(latest)
            .then((content) => {
              setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, content } : d)))
              saveDocument(id, { content })
            })
            .catch((error) => {
              // Leave the stored file alone rather than overwriting a readable
              // `.cmir` with something that failed to encode.
              console.error("[reason-docs] could not re-encode document as .cmir", error)
            })
        }, CMIR_ENCODE_DELAY_MS),
      )
    },
    [documents, saveDocument],
  )

  const selectTopicDocument = useCallback((item: TopicStarterItem) => {
    setTopicDocument(item)
    setActiveId(null)
  }, [])

  const importFiles = useCallback(
    async (files: readonly File[], parentId: number | null = null): Promise<ImportOutcome> => {
      const created: ReasonDocument[] = []
      const failures: string[] = []
      if (files.length === 0) return { created, failures }

      setImporting(true)
      try {
        for (const file of files) {
          try {
            // Convert before the request so a file that cannot be read leaves
            // no empty row behind.
            const imported = await fileToStoredCmir(file)
            const res = await fetch("/api/doc/documents", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...imported, parentId, isFolder: false }),
            })
            if (!res.ok) throw new Error(`the server refused it (${res.status})`)
            const row: ReasonDocument = await res.json()
            created.push({ ...row, format: STORED_FORMATS.cmir })
          } catch (error) {
            failures.push(
              error instanceof CardMirrorImportError
                ? error.message
                : `${file.name} could not be uploaded (${
                    error instanceof Error ? error.message : String(error)
                  }).`,
            )
          }
        }
      } finally {
        setImporting(false)
      }

      if (created.length > 0) {
        setDocuments((prev) => [...created, ...prev])
        openDocument(created[0]!.id)
      }
      return { created, failures }
    },
    [openDocument],
  )

  const openPublicByRef = useCallback(
    async (ref: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/topic-starters/by-path?path=${encodeURIComponent(ref)}`)
        if (!res.ok) return false
        const data = (await res.json()) as { item?: TopicStarterItem }
        if (!data.item) return false
        // Folded into the catalogue as well, so the sidebar can show and
        // re-address the file the link opened.
        setTopicItems((prev) => (prev.some((t) => t.id === data.item!.id) ? prev : [...prev, data.item!]))
        selectTopicDocument(data.item)
        return true
      } catch {
        return false
      }
    },
    [selectTopicDocument],
  )

  const value = useMemo<ReasonDocsContextValue>(
    () => ({
      documents,
      topicItems,
      openTabs,
      activeId,
      topicDocument,
      loading,
      loaded,
      saving: saveState.saving,
      unsaved: saveState.pendingIds.length > 0,
      saveFailed: saveState.failedIds.length > 0,
      importing,
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
      importFiles,
      documentHtml,
      openPublicByRef,
    }),
    [
      documents,
      topicItems,
      openTabs,
      activeId,
      topicDocument,
      loading,
      loaded,
      saveState,
      importing,
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
      importFiles,
      documentHtml,
      openPublicByRef,
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
