"use client"

/**
 * The REASON docs section of the app sidebar: two collapsible sections,
 * Topic Starters (the public catalogue) and My Personal Documents (the
 * reader's own folder/file tree), stacked above the Videos library tree that
 * follows them in the app sidebar. Ported from quick search's REASON editor
 * sidebar (`packages/reason-editor-sidebar`'s `SidebarContent`), adapted to
 * this app's document model and primitives.
 *
 * There is no "Open Tabs" list here: the open files are the tab strip above
 * Debate Editor (`EditorTabStrip`), whose right-click menu closes and reopens
 * them. Each section remembers whether it was collapsed, per device.
 *
 * It is mounted only where the documents are the subject — `/reason-editor`,
 * in the app sidebar, and `/research/cards`, as a second column inside the page
 * beside it (`lib/reason-docs/sidebar-routes.ts`). Elsewhere the
 * sidebar is that page's own nav: `/videos`, which renders its own sidebar
 * rather than the shell, shows the video library and nothing else.
 *
 * Picking a file anywhere routes to `/reason-editor?doc=<file name>` (or
 * `?topic=<file name>` for a public topic starter), which brings Debate Editor up
 * in the main column with that file loaded — see `ReasonDocsRouteSync` for why
 * the selection travels in the URL and not only in provider state, and
 * `lib/reason-docs/doc-path.ts` for how the file's own name becomes that URL.
 *
 * Files also arrive here: the Upload button and a drop onto the tree import
 * `.docx` (and `.cmir`, and plain text) as Debate Editor native files, so a card
 * document dropped in the sidebar is one click from opening in Debate Editor with
 * its cards, highlighting and comments intact.
 *
 * And they leave here: the row above the tree is where the open file is shared
 * with a contact (`ShareWithContacts`), next to New file / New folder /
 * Upload, so every action on a file is in the row the files are in. Any file
 * can also be shared from its own right-click menu, which opens it with the
 * share dialog up (`?shareOpen=1`).
 *
 * Files and Topic Starters trade rows by drag and drop (and by the same moves
 * in each row's right-click menu): a topic starter dragged onto Files becomes
 * the reader's own copy, and a file dragged onto Topic Starters is submitted
 * to the public share. Signed-in readers can also rename, move, delete and add
 * folders in Topic Starters, and ask the AI to organize it by argument (Aff
 * cases, Neg DA / CP / T / K); moderators' and admins' edits apply at once,
 * everyone else's go to the admin panel's approval queue. The File manager button opens the same files in the SVAR file
 * manager quick search uses (`FileManagerDialog`), for organising many files
 * at once; the Sort control orders the tree.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FolderKanban,
  FolderPlus,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@debate-ai/ui/primitives/dropdown-menu"
import { FILE_SORTS, FILE_SORT_LABELS, isFileSort, type FileSort } from "../../lib/reason-docs/file-sort"
import { cn } from "@debate-ai/ui/lib/utils"
import { IMPORT_ACCEPT } from "../../lib/debate-editor/import-files"
import {
  REASON_EDITOR_ROUTE,
  editorHrefForSelection,
  isEditorPathname,
  topicCodeFromPathname,
  type ReasonDocsSelection,
} from "../../lib/reason-docs/route-selection"
import { SHARE_OPEN_PARAM, ShareWithContacts } from "../reason-editor/ShareWithContacts"
import { SellFileDialog } from "../market/SellFileDialog"
import { useSession } from "../../lib/hooks/useSession"
import { FileManagerDialog } from "./file-manager/FileManagerDialog"
import { FileTree } from "./file-manager/FileTree"
import { TopicStarterTree, type TopicStarterItem } from "./topic-starters/TopicStarterTree"
import { NewTopicFolderDialog, OrganizeTopicsDialog, type OrganizeState } from "./topic-starters/TopicStarterDialogs"
import type { TopicStarterChange } from "../../lib/topic-starters/changes"
import { useReasonDocs } from "./ReasonDocsProvider"

// Lazy: the picker carries every resolution `debate-topics.json` has, which
// only matters once the Topic Starters section is open.
const TopicDocsPicker = lazy(() => import("./topic-starters/TopicDocsPicker").then((m) => ({ default: m.TopicDocsPicker })))
import type { ReasonDocument } from "./types"

/** Each section's collapse choice, per device. Both start open. */
const TOPICS_OPEN_STORAGE_KEY = "reason-editor-sidebar-topics-open"
const FILES_OPEN_STORAGE_KEY = "reason-editor-sidebar-files-open"
const SORT_STORAGE_KEY = "reason-editor-sidebar-sort"

/** A section's stored collapse choice; open when there is none (or storage
 *  is unavailable — private mode). */
function loadSectionOpen(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "false"
  } catch {
    return true
  }
}

function saveSectionOpen(key: string, open: boolean) {
  try {
    localStorage.setItem(key, String(open))
  } catch {
    // Storage unavailable — the toggle still works for this visit, it just
    // won't be remembered.
  }
}

/** One collapsible section: a chevron header (with any `actions` beside it)
 *  over a body that scrolls inside a bounded box. */
function SidebarSection({
  title,
  open,
  onToggle,
  actions,
  fill,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  actions?: ReactNode
  fill: boolean
  children: ReactNode
}) {
  return (
    <section className={cn("flex min-h-0 flex-col", open && fill && "flex-1")}>
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{title}</span>
        </button>
        {open && actions}
      </div>
      {/* Where these sections are the whole column (`fill`) the open ones
          share its height; everywhere else each keeps a definite height, since
          the sidebar scrolls as a whole there and a flexible box would be
          squeezed to nothing by the Videos tree under it. */}
      {open && (
        <div className={cn("flex min-h-0 flex-col", fill ? "flex-1" : "h-[300px] max-h-[25vh] md:max-h-[40vh]")}>
          {children}
        </div>
      )}
    </section>
  )
}

/** The Files tree's sort, per device like the other view choices here. */
function loadSort(): FileSort {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    return isFileSort(raw) ? raw : "name"
  } catch {
    return "name"
  }
}

export interface ReasonDocsSidebarPanelsProps {
  className?: string
  /**
   * Take the height the container gives instead of the panels' own fixed one.
   *
   * Passed on `/research/cards`, where these panels are a column of their own
   * inside the page and so own its full height. Left off where something else sits
   * below them in a scrolling column (`/reason-editor`'s sidebar, and the
   * strip above the editor below `md`): a flexible box there is squeezed to
   * nothing by the nav tree under it.
   */
  fill?: boolean
}

export function ReasonDocsSidebarPanels({ className, fill = false }: ReasonDocsSidebarPanelsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    documents,
    topicItems,
    activeId,
    loading,
    ensureLoaded,
    openDocument,
    createDocument,
    deleteDocument,
    moveDocument,
    updateTitle,
    selectTopicDocument,
    importFiles,
    importing,
    downloadDocument,
    downloadTopicDocument,
    copyTopicToDocuments,
    duplicateDocument,
    publishToTopics,
    deleteTopicStarter,
    moveTopicStarter,
    renameTopicStarter,
    createTopicFolder,
    proposeTopicChange,
    organizeTopicStarters,
  } = useReasonDocs()

  const [topicsOpen, setTopicsOpen] = useState(true)
  const [filesOpen, setFilesOpen] = useState(true)
  /** Whether the stored collapse choices have been read yet. */
  const [hydrated, setHydrated] = useState(false)
  /** What the last upload couldn't take, shown under the tree until the next
   *  one. Silence would leave a reader watching a file that never appears. */
  const [importErrors, setImportErrors] = useState<string[]>([])
  /** Why the last download failed, shown the same way until the next attempt. */
  const [downloadError, setDownloadError] = useState<string | null>(null)
  /** Same as `downloadError`, for the Topic Starters panel — kept separate so
   *  a failure in one panel isn't shown under the other. */
  const [topicDownloadError, setTopicDownloadError] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [sort, setSort] = useState<FileSort>("name")
  const [fileManagerOpen, setFileManagerOpen] = useState(false)
  /** The file whose "Sell…" dialog is open. */
  const [sellingId, setSellingId] = useState<number | null>(null)
  const { isAuthenticated } = useSession()
  /** Moderators and admins edit Topic Starters directly; everyone else's
   *  edits go to them for approval. Only changes wording — the server decides. */
  const [canEditTopics, setCanEditTopics] = useState(false)
  /** The folder a "New folder" dialog creates in (`null` = top level); undefined when closed. */
  const [newFolderParent, setNewFolderParent] = useState<number | null | undefined>(undefined)
  const [organize, setOrganize] = useState<OrganizeState>({ phase: "closed" })
  const [organizeChange, setOrganizeChange] = useState<TopicStarterChange | null>(null)
  const [sendingOrganize, setSendingOrganize] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setCanEditTopics(false)
      return
    }
    let cancelled = false
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<{ canEditContent?: boolean }>) : null))
      .then((data) => {
        if (!cancelled) setCanEditTopics(Boolean(data?.canEditContent))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  // Collapse state and sort are per-device view preferences; read after
  // mount so the SSR markup stays deterministic.
  useEffect(() => {
    setTopicsOpen(loadSectionOpen(TOPICS_OPEN_STORAGE_KEY))
    setFilesOpen(loadSectionOpen(FILES_OPEN_STORAGE_KEY))
    setSort(loadSort())
    setHydrated(true)
  }, [])

  const onEditorRoute = isEditorPathname(pathname)
  // The topic the reader is browsing (`vcx27` on `/docs/vcx27/...`), which
  // every starter link keeps; `null` off a topic address, for the default.
  const topicCode = topicCodeFromPathname(pathname)

  /** The open document, which is what the share control shares. */
  const activeDocument = useMemo(
    () => (activeId == null ? null : documents.find((doc) => doc.id === activeId) ?? null),
    [documents, activeId],
  )

  // Nothing is fetched until a section is actually on screen, so a reader who
  // collapses both makes no document requests at all — which is why this
  // waits for the stored choices rather than acting on the open defaults.
  const anyOpen = topicsOpen || filesOpen
  useEffect(() => {
    if (hydrated && anyOpen) ensureLoaded()
  }, [hydrated, anyOpen, ensureLoaded])

  const toggleTopics = () => {
    setTopicsOpen(!topicsOpen)
    saveSectionOpen(TOPICS_OPEN_STORAGE_KEY, !topicsOpen)
  }

  const toggleFiles = () => {
    setFilesOpen(!filesOpen)
    saveSectionOpen(FILES_OPEN_STORAGE_KEY, !filesOpen)
  }

  /** A new document has no id until the POST resolves, so its hop carries no
   *  selection — `createDocument` opens the created file itself. */
  const goToBlankEditor = useCallback(() => {
    if (!onEditorRoute) router.push(REASON_EDITOR_ROUTE)
  }, [onEditorRoute, router])

  /**
   * Carries a selection into the editor's main column, as a URL the editor
   * route can reopen on its own: `?doc=<file name>` for an owned document,
   * `?topic=<file name>` for a public topic starter. The name comes from the
   * tree the file is in, folders included, so the link reads as the file's own
   * path rather than a row id.
   *
   * The provider state set alongside this makes the switch immediate on a
   * client-side hop; the URL is what makes the same click survive a reload, a
   * shared link, or a hard navigation (`/videos` is a different layout
   * branch), so Debate Editor always comes up with *that* file rather than
   * whatever the editor would otherwise fall back to.
   *
   * Already on the route, nothing is routed at all: the provider has the file
   * open, and `ReasonDocsRouteSync` renames the address bar in place. Routing
   * would mean a Next route change between `/reason-editor/<a>` and
   * `/reason-editor/<b>`, which remounts Debate Editor — ten files opened in a
   * row would be ten editor remounts, and ten Back presses to leave.
   */
  const goToEditor = useCallback(
    (selection: ReasonDocsSelection, extraItems: readonly ReasonDocument[] = []) => {
      // `extraItems` covers a file whose row hasn't reached state yet — a
      // just-uploaded one — so its link is its name rather than its id.
      const href = editorHrefForSelection(
        selection,
        selection.kind === "document" ? [...extraItems, ...documents] : topicItems,
        topicCode,
      )
      if (onEditorRoute) router.replace(href)
      else router.push(href)
    },
    [onEditorRoute, router, documents, topicItems, topicCode],
  )

  /**
   * Takes files from the Upload button or a drop onto the tree.
   *
   * Everything becomes a Debate Editor native file on the way in — the sidebar
   * never stores a `.docx` as-is and never runs it through the card parser, so
   * an imported Verbatim document keeps its cards, highlighting and comments
   * (`lib/debate-editor/stored-cmir.ts`). The first file imported is opened, which
   * is what makes uploading and clicking one file the same gesture.
   */
  const uploadFiles = useCallback(
    async (files: readonly File[], parentId: number | null) => {
      if (files.length === 0) return
      setImportErrors([])
      const { created, failures } = await importFiles(files, parentId)
      setImportErrors(failures)
      const first = created[0]
      if (first) goToEditor({ kind: "document", id: first.id }, created)
    },
    [importFiles, goToEditor],
  )

  const downloadFile = useCallback(
    (id: number) => {
      setDownloadError(null)
      void downloadDocument(id).then((result) => {
        if (!result.ok) setDownloadError(result.error)
      })
    },
    [downloadDocument],
  )

  const downloadTopicFile = useCallback(
    (item: TopicStarterItem) => {
      setTopicDownloadError(null)
      void downloadTopicDocument(item).then((result) => {
        if (!result.ok) setTopicDownloadError(result.error)
      })
    },
    [downloadTopicDocument],
  )

  const chooseSort = useCallback((next: FileSort) => {
    setSort(next)
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next)
    } catch {
      // See above — the order holds for this visit.
    }
  }, [])

  const openFile = useCallback(
    (id: number) => {
      openDocument(id)
      goToEditor({ kind: "document", id })
    },
    [openDocument, goToEditor],
  )

  const openTopic = useCallback(
    (item: TopicStarterItem) => {
      selectTopicDocument(item)
      goToEditor({ kind: "topic", id: item.id })
    },
    [selectTopicDocument, goToEditor],
  )

  /** "Share…" on a row: open the file with the share dialog already up. The
   *  dialog lives on the editor page (sharing starts a live session in the
   *  editor), so the file has to be open there first. */
  const shareFile = useCallback(
    (id: number) => {
      openDocument(id)
      const href = editorHrefForSelection({ kind: "document", id }, documents)
      const withShare = `${href}${href.includes("?") ? "&" : "?"}${SHARE_OPEN_PARAM}=1`
      if (onEditorRoute) router.replace(withShare)
      else router.push(withShare)
    },
    [openDocument, documents, onEditorRoute, router],
  )

  /** A topic starter into the reader's own files — the drop from Topic
   *  Starters onto Files, "Save to my files", and (with `open`) "Edit a copy". */
  const saveTopicCopy = useCallback(
    (item: TopicStarterItem, parentId: number | null, open = false) => {
      void copyTopicToDocuments(item, parentId).then((result) => {
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        const first = result.created.find((doc) => !doc.isFolder)
        if (open && first) {
          openDocument(first.id)
          goToEditor({ kind: "document", id: first.id }, result.created)
        } else {
          toast.success(`Saved ${item.title} to your files.`)
        }
      })
    },
    [copyTopicToDocuments, openDocument, goToEditor],
  )

  const saveTopicCopyById = useCallback(
    (topicId: number, parentId: number | null) => {
      const item = topicItems.find((t) => t.id === topicId)
      if (item) saveTopicCopy(item, parentId)
    },
    [topicItems, saveTopicCopy],
  )

  const duplicateFile = useCallback(
    (id: number, parentId?: number | null) => {
      void duplicateDocument(id, parentId).then((result) => {
        if (!result.ok) toast.error(result.error)
      })
    },
    [duplicateDocument],
  )

  const publishFile = useCallback(
    (id: number, topicParentId: number | null = null) => {
      void publishToTopics(id, topicParentId).then((result) => {
        if (!result.ok) toast.error(result.error)
        else if (result.pending) toast.success(`Sent ${result.title} to the moderators to add to Topic Starters.`)
        else toast.success(`Added ${result.title} to Topic Starters.`)
      })
    },
    [publishToTopics],
  )

  /** The toast for a Topic Starters edit: done (moderators), sent for
   *  approval (everyone else), or why it failed. */
  const reportTopicChange = useCallback(
    (result: { ok: true; pending: boolean } | { ok: false; error: string }, done: string, proposed: string) => {
      if (!result.ok) toast.error(result.error)
      else toast.success(result.pending ? `${proposed} Sent to the moderators for approval.` : done)
    },
    [],
  )

  const deleteTopic = useCallback(
    (id: number) => {
      const name = topicItems.find((t) => t.id === id)?.title || "Topic starter"
      void deleteTopicStarter(id).then((result) => reportTopicChange(result, `${name} deleted.`, `Delete ${name}?`))
    },
    [topicItems, deleteTopicStarter, reportTopicChange],
  )

  const moveTopic = useCallback(
    (id: number, parentId: number | null) => {
      const name = topicItems.find((t) => t.id === id)?.title || "Topic starter"
      void moveTopicStarter(id, parentId).then((result) => reportTopicChange(result, `${name} moved.`, `Move ${name}?`))
    },
    [topicItems, moveTopicStarter, reportTopicChange],
  )

  const renameTopic = useCallback(
    (id: number, title: string) => {
      void renameTopicStarter(id, title).then((result) => reportTopicChange(result, `Renamed to ${title}.`, `Rename to ${title}?`))
    },
    [renameTopicStarter, reportTopicChange],
  )

  const createFolder = useCallback(
    (title: string, parentId: number | null) => {
      void createTopicFolder(title, parentId).then((result) =>
        reportTopicChange(result, `Folder ${title} created.`, `New folder ${title}?`),
      )
    },
    [createTopicFolder, reportTopicChange],
  )

  /** "Organize by argument": ask the AI, then show its proposal to confirm. */
  const startOrganize = useCallback(() => {
    setOrganize({ phase: "loading" })
    setOrganizeChange(null)
    void organizeTopicStarters().then((result) => {
      if (!result.ok) {
        setOrganize({ phase: "error", error: result.error })
        return
      }
      setOrganizeChange(result.change)
      setOrganize({ phase: "ready", summary: result.summary, moves: result.moves, hasChange: result.change != null })
    })
  }, [organizeTopicStarters])

  const confirmOrganize = useCallback(() => {
    if (!organizeChange) return
    setSendingOrganize(true)
    void proposeTopicChange(organizeChange).then((result) => {
      setSendingOrganize(false)
      if (!result.ok) {
        setOrganize({ phase: "error", error: result.error })
        return
      }
      setOrganize({ phase: "closed" })
      toast.success(result.pending ? "Reorganization sent to the moderators for approval." : "Topic Starters organized by argument.")
    })
  }, [organizeChange, proposeTopicChange])

  /** The topic starter's own editor link, which anyone can open — the
   *  catalogue is public, unlike a reader's own files. */
  const copyTopicLink = useCallback(
    (item: TopicStarterItem) => {
      const href = editorHrefForSelection({ kind: "topic", id: item.id }, topicItems, topicCode)
      const url = `${window.location.origin}${href}`
      void navigator.clipboard
        ?.writeText(url)
        .then(() => toast.success("Link copied."))
        .catch(() => toast.error("The link could not be copied."))
    },
    [topicItems, topicCode],
  )

  const spinner = (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  const iconButton =
    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"

  return (
    <div className={cn("flex min-h-0 flex-col gap-1", className)}>
      <SidebarSection
        title="Topic Starters"
        open={topicsOpen}
        onToggle={toggleTopics}
        fill={fill}
        actions={
          isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => setNewFolderParent(null)}
                title={canEditTopics ? "New folder" : "Suggest a new folder"}
                className={iconButton}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={startOrganize}
                disabled={organize.phase === "loading"}
                title="Organize by argument (AI): Aff cases, Neg DA / CP / T / K"
                aria-label="Organize by argument"
                className={iconButton}
              >
                {organize.phase === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              </button>
            </>
          ) : undefined
        }
      >
        <Suspense fallback={null}>
          <TopicDocsPicker className="shrink-0" />
        </Suspense>
        {loading ? (
          spinner
        ) : (
          <>
            <TopicStarterTree
              items={topicItems}
              onSelect={openTopic}
              onDownload={downloadTopicFile}
              onSaveCopy={(item) => saveTopicCopy(item, null)}
              onEditCopy={(item) => saveTopicCopy(item, null, true)}
              onCopyLink={copyTopicLink}
              onPublish={publishFile}
              onMove={isAuthenticated ? moveTopic : undefined}
              onRename={isAuthenticated ? renameTopic : undefined}
              onDelete={isAuthenticated ? deleteTopic : undefined}
              onCreateFolder={isAuthenticated ? setNewFolderParent : undefined}
            />
            {topicDownloadError && (
              <p className="shrink-0 px-3 pb-2 text-xs text-destructive">{topicDownloadError}</p>
            )}
          </>
        )}
      </SidebarSection>

      <SidebarSection
        title="My Personal Documents"
        open={filesOpen}
        onToggle={toggleFiles}
        fill={fill}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                void createDocument(null, false)
                goToBlankEditor()
              }}
              title="New document"
              className={iconButton}
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void createDocument(null, true)}
              title="New folder"
              className={iconButton}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={importing}
              title={`Upload a file (${IMPORT_ACCEPT})`}
              className={iconButton}
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setFileManagerOpen(true)}
              title="File manager"
              className={iconButton}
            >
              <FolderKanban className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" title={`Sort: ${FILE_SORT_LABELS[sort]}`} aria-label="Sort files" className={iconButton}>
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FILE_SORTS.map((option) => (
                  <DropdownMenuItem key={option} onClick={() => chooseSort(option)}>
                    <Check className={cn("mr-2 h-4 w-4", sort === option ? "opacity-100" : "opacity-0")} />
                    {FILE_SORT_LABELS[option]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Sharing rides in this row rather than in the editor's own
                header strip: it is a thing done to the open file, and this is
                the row the file's other actions are in. Only on the editor
                route — sharing starts a live co-editing session through the
                Debate Editor engine, which is mounted by that page, so the
                control would fail anywhere else. `?shareWith=` puts it
                straight into the dialog, hence the Suspense. */}
            {onEditorRoute && activeDocument && (
              <Suspense>
                <ShareWithContacts variant="icon" title={activeDocument.title} />
              </Suspense>
            )}
          </>
        }
      >
        {loading ? (
          spinner
        ) : (
          <>
            <FileTree
              documents={documents}
              activeId={activeId}
              sort={sort}
              onSelect={openFile}
              onAdd={(parentId, isFolder) => void createDocument(parentId, isFolder)}
              onRename={updateTitle}
              onDelete={(id) => void deleteDocument(id)}
              onMove={(id, parentId) => void moveDocument(id, parentId)}
              onUpload={(files, parentId) => void uploadFiles(files, parentId)}
              onDownload={downloadFile}
              onDuplicate={duplicateFile}
              onShare={shareFile}
              onSell={isAuthenticated ? setSellingId : undefined}
              onPublish={publishFile}
              onImportTopic={saveTopicCopyById}
            />
            {importErrors.length > 0 && (
              <ul className="shrink-0 space-y-1 px-3 pb-2 text-xs text-destructive">
                {importErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
            {downloadError && <p className="shrink-0 px-3 pb-2 text-xs text-destructive">{downloadError}</p>}
          </>
        )}
      </SidebarSection>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          // Cleared before the await so picking the same file twice in a
          // row still fires `change` the second time.
          event.target.value = ""
          void uploadFiles(files, null)
        }}
      />
      <FileManagerDialog
        open={fileManagerOpen}
        onOpenChange={setFileManagerOpen}
        documents={documents}
        topics={topicItems}
        onOpenDocument={openFile}
        onOpenTopic={openTopic}
        onCreate={(parentId, isFolder) => void createDocument(parentId, isFolder)}
        onUpload={(files, parentId) => void uploadFiles(files, parentId)}
        onRename={updateTitle}
        onDelete={(id) => void deleteDocument(id)}
        onMove={(id, parentId) => void moveDocument(id, parentId)}
        onDuplicate={duplicateFile}
        onDownload={downloadFile}
        onDownloadTopic={downloadTopicFile}
        onSaveTopicCopy={(item, parentId) => saveTopicCopy(item, parentId)}
        onPublish={publishFile}
      />
      <SellFileDialog documentId={sellingId} onClose={() => setSellingId(null)} />
      <NewTopicFolderDialog
        parentId={newFolderParent}
        canEdit={canEditTopics}
        onClose={() => setNewFolderParent(undefined)}
        onCreate={createFolder}
      />
      <OrganizeTopicsDialog
        state={organize}
        canEdit={canEditTopics}
        sending={sendingOrganize}
        onClose={() => setOrganize({ phase: "closed" })}
        onConfirm={confirmOrganize}
      />
    </div>
  )
}
