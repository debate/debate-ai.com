"use client"

/**
 * Shared state for the REASON docs sidebar — the files tree, the open tabs
 * (shown as the tab strip above the editor) and the topic-starter catalogue — lifted out of `/reason-editor`'s
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
 * both exist so an uploaded `.docx` stays a Debate Editor file:
 *
 *  - {@link ReasonDocsContextValue.importFiles} converts an upload with
 *    Debate Editor's own importer and stores the `.cmir` it produces, never card
 *    HTML — see `lib/debate-editor/stored-cmir.ts` for why that is the only shape
 *    that keeps a Verbatim document intact.
 *  - Editing such a file re-encodes it back to `.cmir` before the write, so
 *    the first keystroke doesn't silently downgrade the document to markup.
 *    The editor reports HTML, so the live copy of an open file is held as HTML
 *    in a ref (`openHtmlRef`) and encoded on the way out, on its own debounce —
 *    gzipping a card file on every keystroke would be felt.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DocumentSaveQueue, type SaveQueueState } from "../../lib/reason-docs/save-queue"
import {
  canReopenTab as canReopen,
  closeAllTabs as closeAll,
  closeOtherTabs as closeOthers,
  closeTabs,
  closeTabsToRight as closeToRight,
  reopenClosedTab as reopenClosed,
  type TabState,
} from "../../lib/reason-docs/tab-actions"
import { isTopicTab, topicIdOfTab, topicTabId } from "../../lib/reason-docs/tab-ids"
import { STORED_FORMATS } from "../../lib/debate-editor/format"
import { isCmirContent } from "../../lib/debate-editor/content-format"
// Debate Editor's engine is loaded on demand (`lazy-stored-cmir`), not imported:
// this provider wraps every page, and only opening, saving, importing or
// downloading a `.cmir` needs it.
import { DebateEditorImportError, docxDownloadFilename } from "../../lib/debate-editor/import-files"
import { loadStoredCmir, storedCmirIfLoaded, type StoredCmir } from "../../lib/debate-editor/lazy-stored-cmir"
import type { ReasonDocument } from "./types"
import type { TopicStarterChange } from "../../lib/topic-starters/changes"
import type { TopicStarterItem } from "./topic-starters/TopicStarterTree"
import {
  downloadFullTopicStarterLibrary,
  getCachedItems,
  isExtensionInstalled,
  resolveCachedTopic,
  upsertCachedItem,
} from "../../lib/topic-starters/local-cache"

/** How long an edit to a `.cmir` file waits before it is re-encoded. The write
 *  is queued once the encode resolves, so this sits in front of the save
 *  queue's own debounce rather than overlapping it — short enough that the
 *  extra wait is not felt, long enough that a burst of typing gzips the
 *  document once instead of per keystroke. */
const CMIR_ENCODE_DELAY_MS = 600

/** Triggers a browser download of `.docx` bytes under `filename` — shared by
 *  `downloadDocument` and `downloadTopicDocument`, which differ only in where
 *  the bytes and filename come from. */
function triggerDocxDownload(bytes: Uint8Array, filename: string): void {
  // `Blob` wants an `ArrayBuffer`-backed part; `toDocx`'s `Uint8Array` is
  // typed over the wider `ArrayBufferLike`, so slice out a concrete one.
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** What one upload produced, for the caller that has to report it. */
export interface ImportOutcome {
  /** Documents created, in upload order. */
  created: ReasonDocument[]
  /** One message per file that could not be imported, ready to show. */
  failures: string[]
}

/** The result of {@link ReasonDocsContextValue.downloadDocument} — a plain
 *  result rather than a throw, so a failed conversion can be shown next to
 *  the tree the same way an import failure is. */
export type DownloadOutcome = { ok: true } | { ok: false; error: string }

/** The result of copying rows between the sidebar's two areas — the rows
 *  made, or why nothing was. */
export type CopyOutcome = { ok: true; created: ReasonDocument[] } | { ok: false; error: string }

/** The result of {@link ReasonDocsContextValue.publishToTopics}: `pending`
 *  when the file went to the moderators rather than straight into the catalogue. */
export type PublishOutcome = { ok: true; pending: boolean; title: string } | { ok: false; error: string }

/** The result of an edit to Topic Starters: applied at once for moderators
 *  and admins, `pending` (waiting on a moderator) for everyone else. */
export type TopicChangeOutcome = { ok: true; pending: boolean } | { ok: false; error: string }

/** The AI's proposed reorganization — `change` is null when nothing would move. */
export type OrganizeOutcome =
  | { ok: true; change: TopicStarterChange | null; summary: string; moves: number }
  | { ok: false; error: string }

export interface ReasonDocsContextValue {
  documents: ReasonDocument[]
  topicItems: TopicStarterItem[]
  /** Every open tab, owned documents and Topic Starters alike, in strip
   *  order. A Topic Starter's tab id is negative (`lib/reason-docs/tab-ids.ts`). */
  openTabs: number[]
  /** The tab on screen — a document's or a Topic Starter's. */
  activeTab: number | null
  /** The owned document on screen; null while a Topic Starter's tab is. */
  activeId: number | null
  /** The read-only public topic starter on screen, when its tab is active. */
  topicDocument: TopicStarterItem | null
  /** What a tab in the strip is called. */
  tabTitle: (tabId: number) => string
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
  /** Switches to an already-open tab (a document's or a Topic Starter's). */
  selectTab: (id: number) => void
  closeTab: (id: number) => void
  /** The tab strip's right-click menu (`lib/reason-docs/tab-actions.ts`). */
  closeOtherTabs: (id: number) => void
  closeTabsToRight: (id: number) => void
  closeAllTabs: () => void
  /** Reopens the most recently closed tab that still exists. */
  reopenClosedTab: () => void
  /** Whether {@link reopenClosedTab} has anything to bring back. */
  canReopenTab: boolean
  createDocument: (parentId?: number | null, isFolder?: boolean) => Promise<void>
  deleteDocument: (id: number) => Promise<void>
  moveDocument: (id: number, parentId: number | null) => Promise<void>
  updateTitle: (id: number, title: string) => void
  updateContent: (id: number, content: string) => void
  /** Opens a Topic Starter in its own tab — beside the open documents rather
   *  than in place of the one on screen — and makes it active. A starter that
   *  is already open is switched to, so each keeps one tab and one undo
   *  history. */
  selectTopicDocument: (item: TopicStarterItem) => void
  /**
   * Imports uploaded files as Debate Editor `.cmir` documents under `parentId`,
   * opening the first one. Never throws: a file that cannot be converted comes
   * back in `failures` so one bad file in a drop doesn't lose the rest.
   */
  importFiles: (files: readonly File[], parentId?: number | null) => Promise<ImportOutcome>
  /** The open document's content as HTML, whatever shape the row is stored in. */
  documentHtml: (doc: ReasonDocument) => string
  /**
   * Converts an owned document to `.docx` and triggers a browser download,
   * so the sidebar can offer a file without opening it in Debate Editor first.
   * Includes any edit made this session, the same as `documentHtml`. Never
   * throws — a missing/folder id or a conversion failure comes back as
   * `{ ok: false }` for the caller to show.
   */
  downloadDocument: (id: number) => Promise<DownloadOutcome>
  /**
   * Converts a public topic starter to `.docx` and triggers a browser
   * download, mirroring {@link downloadDocument} for the read-only catalogue.
   * Never throws — a folder or a conversion failure comes back as
   * `{ ok: false }` for the caller to show.
   */
  downloadTopicDocument: (item: TopicStarterItem) => Promise<DownloadOutcome>
  /**
   * Copies a public topic starter — a file, or a folder with everything in
   * it — into the reader's own files under `parentId`. This is what dragging a
   * row from Topic Starters onto Files does, and what "Save to my files" and
   * "Edit a copy" do: the catalogue is read-only, so a file is edited by
   * editing your own copy of it. Keeps the stored format, so a `.cmir` stays a
   * `.cmir`. Never throws.
   */
  copyTopicToDocuments: (item: TopicStarterItem, parentId?: number | null) => Promise<CopyOutcome>
  /**
   * Makes a copy of one of the reader's own files (or a folder and its
   * contents) under `parentId` — the same folder when omitted — named
   * "<title> copy". Never throws.
   */
  duplicateDocument: (id: number, parentId?: number | null) => Promise<CopyOutcome>
  /**
   * Submits one of the reader's own files to the public Topic Starters, under
   * the catalogue folder `topicParentId` (top level when null). This is what
   * dropping a file onto Topic Starters does. Applied at once for moderators
   * and admins; anyone else's submission waits for a moderator (`pending`).
   */
  publishToTopics: (id: number, topicParentId?: number | null) => Promise<PublishOutcome>
  /** Removes a Topic Starter (a folder with everything in it) — or, for a
   *  reader who isn't staff, asks the moderators to. */
  deleteTopicStarter: (id: number) => Promise<TopicChangeOutcome>
  /** Re-files a Topic Starter under another folder, or the top level. A
   *  folder moves with its subtree. Moderated like every catalogue edit. */
  moveTopicStarter: (id: number, parentId: number | null) => Promise<TopicChangeOutcome>
  /** Renames a Topic Starter. Moderated like every catalogue edit. */
  renameTopicStarter: (id: number, title: string) => Promise<TopicChangeOutcome>
  /** Adds a folder to Topic Starters. Moderated like every catalogue edit. */
  createTopicFolder: (title: string, parentId: number | null) => Promise<TopicChangeOutcome>
  /** Sends any catalogue edit — what the AI organizer's proposal is applied with. */
  proposeTopicChange: (change: TopicStarterChange) => Promise<TopicChangeOutcome>
  /** Asks the AI to sort every public file into Aff/Neg argument folders.
   *  Only proposes: apply the result with {@link proposeTopicChange}. */
  organizeTopicStarters: () => Promise<OrganizeOutcome>
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
  const [activeTab, setActiveTab] = useState<number | null>(null)
  const [closedTabs, setClosedTabs] = useState<number[]>([])
  // Every Topic Starter opened in a tab this session, by row id — including
  // closed ones, so "Undo close" can bring them back. Not looked up in
  // `topicItems`: a shared link can open a starter the catalogue never listed.
  const [topicTabItems, setTopicTabItems] = useState<ReadonlyMap<number, TopicStarterItem>>(() => new Map())
  const activeId = activeTab != null && !isTopicTab(activeTab) ? activeTab : null
  const topicDocument =
    activeTab != null && isTopicTab(activeTab) ? topicTabItems.get(topicIdOfTab(activeTab)) ?? null : null
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

  // Returns nothing (not the load's promise): callers fire and forget, and a
  // returned promise turns a caller's `act(() => ensureLoaded())` async.
  const ensureLoaded = useCallback(() => {
    if (loadStartedRef.current) return
    loadStartedRef.current = true
    setLoading(true)
    void loadAll()
  }, [])

  const loadAll = async () => {
    // Paint the cached catalogue instantly; the network copy refreshes it.
    const cached = await getCachedItems()
    if (cached) setTopicItems(cached.map(({ cachedAt, ...rest }) => rest))

    await Promise.all([
      fetch("/api/doc/documents")
        .then((res) => (res.ok ? (res.json() as Promise<ReasonDocument[]>) : []))
        .then((rows) => setDocuments(Array.isArray(rows) ? rows : []))
        .catch(() => setDocuments([])),
      fetch("/api/topic-starters")
        .then(async (res) => {
          if (!res.ok) return
          const data = (await res.json()) as { items?: TopicStarterItem[] }
          setTopicItems(data.items ?? [])
          for (const item of data.items ?? []) void upsertCachedItem(item)
        })
        .catch(() => {}),
    ])

    setLoading(false)
    setLoaded(true)

    // When the browser extension is installed, pull the whole published
    // library (~60 MB) into this device's IndexedDB copy in the background,
    // so every topic starter opens instantly — even offline.
    void (async () => {
      if (await isExtensionInstalled()) {
        try {
          await downloadFullTopicStarterLibrary()
        } catch (error) {
          console.error("[topic-starters] could not prime the local library", error)
        }
      }
    })()
  }

  const openDocument = useCallback((id: number) => {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveTab(id)
  }, [])

  const selectTab = useCallback((id: number) => {
    setActiveTab(id)
  }, [])

  /** Runs one of the tab-strip transitions in `lib/reason-docs/tab-actions.ts`
   *  over the open tabs, the active one and the closed-tab stack together. */
  const applyTabs = useCallback(
    (transition: (state: TabState) => TabState) => {
      const next = transition({ openTabs, activeId: activeTab, closed: closedTabs })
      setOpenTabs(next.openTabs)
      setActiveTab(next.activeId)
      setClosedTabs(next.closed)
    },
    [openTabs, activeTab, closedTabs],
  )

  // Closing the active tab falls through to its neighbour, preferring the one
  // that slid into its slot.
  const closeTab = useCallback((id: number) => applyTabs((state) => closeTabs(state, [id])), [applyTabs])
  const closeOtherTabs = useCallback((id: number) => applyTabs((state) => closeOthers(state, id)), [applyTabs])
  const closeTabsToRight = useCallback((id: number) => applyTabs((state) => closeToRight(state, id)), [applyTabs])
  const closeAllTabs = useCallback(() => applyTabs(closeAll), [applyTabs])

  const tabExists = useCallback(
    (id: number) =>
      isTopicTab(id)
        ? topicTabItems.has(topicIdOfTab(id))
        : documents.some((doc) => doc.id === id && !doc.isFolder),
    [documents, topicTabItems],
  )
  const reopenClosedTab = useCallback(() => {
    applyTabs((state) => reopenClosed(state, tabExists))
  }, [applyTabs, tabExists])
  const canReopenTab = useMemo(
    () => canReopen({ openTabs, activeId: activeTab, closed: closedTabs }, tabExists),
    [openTabs, activeTab, closedTabs, tabExists],
  )

  const tabTitle = useCallback(
    (id: number) =>
      (isTopicTab(id)
        ? topicTabItems.get(topicIdOfTab(id))?.title
        : documents.find((doc) => doc.id === id)?.title) || "Untitled",
    [documents, topicTabItems],
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
      // A refused write (signed-out quota, server error) answers with an
      // error body, not a row — adding that to the tree would show a
      // nameless file that 404s on every edit.
      if (!res.ok) return
      const created: ReasonDocument = await res.json()
      if (typeof created?.id !== "number") return
      setDocuments((prev) => [created, ...prev])
      if (!isFolder) openDocument(created.id)
    },
    [openDocument],
  )

  /**
   * Writes `rows` (a file, or a folder followed by its descendants, each
   * pointing at its parent by *source* id) as new documents under
   * `parentId`, re-pointing each child at its new parent. Shared by the
   * topic-starter copy and duplicate, which differ only in where the rows
   * come from.
   */
  const copyRows = useCallback(
    async (
      rows: readonly { id: number; title: string; content: string; format?: string; parentId: number | null; isFolder: boolean }[],
      rootId: number,
      parentId: number | null,
      rootTitle: string,
    ): Promise<CopyOutcome> => {
      const created: ReasonDocument[] = []
      const newIds = new Map<number, number>()
      try {
        for (const row of rows) {
          const isRoot = row.id === rootId
          const res = await fetch("/api/doc/documents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: isRoot ? rootTitle : row.title,
              content: row.isFolder ? "" : row.content ?? "",
              format: row.isFolder ? undefined : row.format,
              parentId: isRoot ? parentId : (newIds.get(row.parentId ?? -1) ?? parentId),
              isFolder: row.isFolder,
            }),
          })
          if (!res.ok) throw new Error(`the server refused it (${res.status})`)
          const saved: ReasonDocument = await res.json()
          newIds.set(row.id, saved.id)
          created.push({ ...saved, format: saved.format ?? row.format })
        }
      } catch (error) {
        if (created.length > 0) setDocuments((prev) => [...created, ...prev])
        return {
          ok: false,
          error: `${rootTitle || "That file"} could not be copied (${error instanceof Error ? error.message : String(error)}).`,
        }
      }
      setDocuments((prev) => [...created, ...prev])
      return { ok: true, created }
    },
    [],
  )

  const copyTopicToDocuments = useCallback(
    async (item: TopicStarterItem, parentId: number | null = null): Promise<CopyOutcome> => {
      const rows = subtreeOf(topicItems, item)
      return copyRows(rows, item.id, parentId, item.title)
    },
    [topicItems, copyRows],
  )

  const duplicateDocument = useCallback(
    async (id: number, parentId?: number | null): Promise<CopyOutcome> => {
      const doc = documents.find((d) => d.id === id)
      if (!doc) return { ok: false, error: "That file could not be found." }
      return copyRows(subtreeOf(documents, doc), doc.id, parentId === undefined ? doc.parentId : parentId, `${doc.title} copy`)
    },
    [documents, copyRows],
  )

  /** Re-reads the public catalogue — after an edit a moderator applied, whose
   *  effect (a cascade delete, a whole reorganization) is the server's to say. */
  const refreshTopics = useCallback(async () => {
    try {
      const res = await fetch("/api/topic-starters")
      if (!res.ok) return
      const data = (await res.json()) as { items?: TopicStarterItem[] }
      setTopicItems(data.items ?? [])
      for (const item of data.items ?? []) void upsertCachedItem(item)
    } catch {
      // The tree keeps what it had; the next load corrects it.
    }
  }, [])

  const proposeTopicChange = useCallback(
    async (change: TopicStarterChange): Promise<TopicChangeOutcome> => {
      try {
        const res = await fetch("/api/topic-starters/changes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(change),
        })
        const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string }
        if (res.status === 401) return { ok: false, error: data.error || "Sign in to suggest changes to Topic Starters." }
        if (!res.ok) return { ok: false, error: data.error || `The server refused it (${res.status}).` }
        if (data.status === "pending") return { ok: true, pending: true }
        await refreshTopics()
        return { ok: true, pending: false }
      } catch (error) {
        return { ok: false, error: `The change could not be sent (${error instanceof Error ? error.message : String(error)}).` }
      }
    },
    [refreshTopics],
  )

  const publishToTopics = useCallback(
    async (id: number, topicParentId: number | null = null): Promise<PublishOutcome> => {
      const doc = documents.find((d) => d.id === id)
      if (!doc || doc.isFolder) return { ok: false, error: "Only a file can be added to Topic Starters." }
      const result = await proposeTopicChange({
        kind: "submit",
        title: doc.title,
        content: doc.content ?? "",
        format: doc.format ?? "html",
        parentId: topicParentId,
        year: null,
      })
      if (!result.ok) return { ok: false, error: `${doc.title || "This file"} could not be submitted: ${result.error}` }
      return { ok: true, pending: result.pending, title: doc.title }
    },
    [documents, proposeTopicChange],
  )

  const deleteTopicStarter = useCallback(
    async (id: number): Promise<TopicChangeOutcome> => {
      if (!topicItems.some((row) => row.id === id)) return { ok: false, error: "That topic starter could not be found." }
      return proposeTopicChange({ kind: "delete", itemId: id })
    },
    [topicItems, proposeTopicChange],
  )

  const moveTopicStarter = useCallback(
    async (id: number, parentId: number | null): Promise<TopicChangeOutcome> => {
      const item = topicItems.find((row) => row.id === id)
      if (!item) return { ok: false, error: "That topic starter could not be found." }
      if (item.isFolder && parentId != null && subtreeOf(topicItems, item).some((row) => row.id === parentId)) {
        return { ok: false, error: "A folder cannot be moved into its own subtree." }
      }
      if ((item.parentId ?? null) === parentId) return { ok: true, pending: false }
      return proposeTopicChange({ kind: "move", itemId: id, parentId })
    },
    [topicItems, proposeTopicChange],
  )

  const renameTopicStarter = useCallback(
    async (id: number, title: string): Promise<TopicChangeOutcome> => {
      const item = topicItems.find((row) => row.id === id)
      if (!item) return { ok: false, error: "That topic starter could not be found." }
      if (!title.trim() || title.trim() === item.title) return { ok: true, pending: false }
      return proposeTopicChange({ kind: "rename", itemId: id, title: title.trim() })
    },
    [topicItems, proposeTopicChange],
  )

  const createTopicFolder = useCallback(
    (title: string, parentId: number | null): Promise<TopicChangeOutcome> =>
      proposeTopicChange({ kind: "create-folder", title, parentId }),
    [proposeTopicChange],
  )

  const organizeTopicStarters = useCallback(async (): Promise<OrganizeOutcome> => {
    try {
      const res = await fetch("/api/topic-starters/organize", { method: "POST" })
      const data = (await res.json().catch(() => ({}))) as {
        change?: TopicStarterChange | null
        summary?: string
        moves?: number
        error?: string
      }
      if (!res.ok) return { ok: false, error: data.error || `The organizer failed (${res.status}).` }
      return { ok: true, change: data.change ?? null, summary: data.summary ?? "", moves: data.moves ?? 0 }
    } catch (error) {
      return { ok: false, error: `The organizer could not be reached (${error instanceof Error ? error.message : String(error)}).` }
    }
  }, [])

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
      if (activeTab != null && idsToDelete.includes(activeTab)) setActiveTab(null)
    },
    [documents, activeTab, saveQueue],
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
        // A `.cmir` only gets a pending encode after the editor reported an
        // edit, so the engine is loaded by now; if it somehow is not, the
        // stored file is left alone, as for a failed encode.
        const engine = storedCmirIfLoaded()
        if (!engine) throw new Error("Debate Editor is not loaded")
        saveQueue.queue(id, { content: engine.htmlToStoredCmirSync(html) })
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

  // Set once the engine arrives, so `documentHtml` changes identity and a
  // `.cmir` asked for before then is rendered again with it.
  const [storedCmir, setStoredCmir] = useState<StoredCmir | null>(storedCmirIfLoaded)

  const documentHtml = useCallback(
    (doc: ReasonDocument) => {
      // An edit made this session wins over the stored copy: switching tabs and
      // back must not hand the editor the version from before you typed.
      const open = openHtmlRef.current.get(doc.id)
      if (open !== undefined) return open
      const converter = storedCmir ?? storedCmirIfLoaded()
      if (converter) return converter.storedContentToHtml(doc)
      // An HTML row needs no conversion. A `.cmir` does: the editor screen
      // imports the engine itself, so this is only reached if it has not run
      // yet, and it renders again once the engine is in.
      if (!isCmirContent(doc)) return doc.content ?? ""
      void loadStoredCmir().then(setStoredCmir)
      return ""
    },
    [storedCmir],
  )

  const downloadDocument = useCallback(
    async (id: number): Promise<DownloadOutcome> => {
      const doc = documents.find((d) => d.id === id)
      if (!doc || doc.isFolder) return { ok: false, error: "That file could not be found." }
      try {
        const { htmlToDocxBytes } = await loadStoredCmir()
        const bytes = await htmlToDocxBytes(documentHtml(doc))
        triggerDocxDownload(bytes, docxDownloadFilename(doc.title))
        return { ok: true }
      } catch (error) {
        console.error("[reason-docs] could not convert document to .docx", error)
        return {
          ok: false,
          error: `${doc.title || "This file"} could not be downloaded (${
            error instanceof Error ? error.message : String(error)
          }).`,
        }
      }
    },
    [documents, documentHtml],
  )

  // Read-only, so no `documentHtml`-style live-edit lookup: a topic starter's
  // `content`/`format` are whatever the catalogue handed the tree, unlike an
  // owned document which may have an unsaved in-session edit.
  const downloadTopicDocument = useCallback(async (item: TopicStarterItem): Promise<DownloadOutcome> => {
    if (item.isFolder) return { ok: false, error: "That file could not be found." }
    try {
      // `topicStarterHtml` is `storedContentToHtml` under another name.
      const { htmlToDocxBytes, storedContentToHtml } = await loadStoredCmir()
      const bytes = await htmlToDocxBytes(storedContentToHtml(item))
      triggerDocxDownload(bytes, docxDownloadFilename(item.title))
      return { ok: true }
    } catch (error) {
      console.error("[reason-docs] could not convert topic starter to .docx", error)
      return {
        ok: false,
        error: `${item.title || "This file"} could not be downloaded (${
          error instanceof Error ? error.message : String(error)
        }).`,
      }
    }
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
          void loadStoredCmir()
            .then(({ htmlToStoredCmir }) => htmlToStoredCmir(latest))
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
    const tab = topicTabId(item.id)
    setTopicTabItems((prev) => new Map(prev).set(item.id, item))
    setOpenTabs((prev) => (prev.includes(tab) ? prev : [...prev, tab]))
    setActiveTab(tab)
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
            const { fileToStoredCmir } = await loadStoredCmir()
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
              error instanceof DebateEditorImportError
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
      // A shared link to a file this client already has — cached or fully
      // mirrored when the extension is installed — opens without the network.
      const cached = await resolveCachedTopic(ref)
      if (cached) {
        setTopicItems((prev) => (prev.some((t) => t.id === cached.id) ? prev : [...prev, cached]))
        selectTopicDocument(cached)
        return true
      }
      try {
        const res = await fetch(`/api/topic-starters/by-path?path=${encodeURIComponent(ref)}`)
        if (!res.ok) return false
        const data = (await res.json()) as { item?: TopicStarterItem }
        if (!data.item) return false
        void upsertCachedItem(data.item)
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
      activeTab,
      activeId,
      topicDocument,
      tabTitle,
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
      closeOtherTabs,
      closeTabsToRight,
      closeAllTabs,
      reopenClosedTab,
      canReopenTab,
      createDocument,
      deleteDocument,
      moveDocument,
      updateTitle,
      updateContent,
      selectTopicDocument,
      importFiles,
      documentHtml,
      downloadDocument,
      downloadTopicDocument,
      openPublicByRef,
      copyTopicToDocuments,
      duplicateDocument,
      publishToTopics,
      deleteTopicStarter,
      moveTopicStarter,
      renameTopicStarter,
      createTopicFolder,
      proposeTopicChange,
      organizeTopicStarters,
    }),
    [
      documents,
      topicItems,
      openTabs,
      activeTab,
      activeId,
      topicDocument,
      tabTitle,
      loading,
      loaded,
      saveState,
      importing,
      ensureLoaded,
      openDocument,
      selectTab,
      closeTab,
      closeOtherTabs,
      closeTabsToRight,
      closeAllTabs,
      reopenClosedTab,
      canReopenTab,
      createDocument,
      deleteDocument,
      moveDocument,
      updateTitle,
      updateContent,
      selectTopicDocument,
      importFiles,
      documentHtml,
      downloadDocument,
      downloadTopicDocument,
      openPublicByRef,
      copyTopicToDocuments,
      duplicateDocument,
      publishToTopics,
      deleteTopicStarter,
      moveTopicStarter,
      renameTopicStarter,
      createTopicFolder,
      proposeTopicChange,
      organizeTopicStarters,
    ],
  )

  return <ReasonDocsContext.Provider value={value}>{children}</ReasonDocsContext.Provider>
}

/** `item` followed by every row under it, parents before children — the
 *  order a copy has to be written in so each child's new parent exists.
 *  Only folders have children: a row pointing at a *file* as its parent is
 *  stray data, and is not copied along with that file. */
function subtreeOf<T extends { id: number; parentId: number | null; isFolder: boolean }>(items: readonly T[], item: T): T[] {
  const out: T[] = [item]
  const seen = new Set<number>([item.id])
  for (let i = 0; i < out.length; i++) {
    if (!out[i]!.isFolder) continue
    for (const row of items) {
      if (row.parentId === out[i]!.id && !seen.has(row.id)) {
        seen.add(row.id)
        out.push(row)
      }
    }
  }
  return out
}

/** The provider's value, or `null` outside it — for chrome such as the
 *  Ctrl/Cmd-K palette that also renders where no provider is mounted. */
export function useOptionalReasonDocs(): ReasonDocsContextValue | null {
  return useContext(ReasonDocsContext)
}

/** Throws outside the provider — every consumer renders under the root layout. */
export function useReasonDocs(): ReasonDocsContextValue {
  const ctx = useContext(ReasonDocsContext)
  if (!ctx) throw new Error("useReasonDocs must be used inside <ReasonDocsProvider>")
  return ctx
}
