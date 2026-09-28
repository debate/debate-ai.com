"use client"

/**
 * The REASON docs section of the app sidebar: the folder/file tree and the
 * "Open Tabs" list, ported from quick search's REASON editor sidebar
 * (`packages/reason-editor-sidebar`'s `SidebarContent` — its `renderFiles`
 * and `renderOpenTabs` panels and the panel-toggle row above them), adapted
 * to this app's document model and primitives.
 *
 * As in that sidebar the enabled panels *stack* vertically rather than
 * switching exclusively, so Files and Open Tabs are both visible at once
 * (its default view). Unlike that sidebar this lives in the app's persistent
 * left sidebar (`AppSidebarShell`) instead of a second sidebar owned by the
 * editor route.
 *
 * It is mounted only where the documents are the subject — `/cards` and
 * `/reason-editor` (`lib/reason-docs/sidebar-routes.ts`). Elsewhere the
 * sidebar is that page's own nav: `/videos`, which renders its own sidebar
 * rather than the shell, shows the video library and nothing else.
 *
 * Picking a file anywhere routes to `/reason-editor?doc=<file name>` (or
 * `?topic=<file name>` for a public topic starter), which brings CardMirror up
 * in the main column with that file loaded — see `ReasonDocsRouteSync` for why
 * the selection travels in the URL and not only in provider state, and
 * `lib/reason-docs/doc-path.ts` for how the file's own name becomes that URL.
 *
 * Files also arrive here: the Upload button and a drop onto the tree import
 * `.docx` (and `.cmir`, and plain text) as CardMirror native files, so a card
 * document dropped in the sidebar is one click from opening in CardMirror with
 * its cards, highlighting and comments intact.
 *
 * And they leave here: the row above the tree is where the open file is shared
 * with a contact (`ShareWithContacts`), next to New file / New folder /
 * Upload, so every action on a file is in the row the files are in.
 */

import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Group, Panel, Separator } from "react-resizable-panels"
import { BookOpen, ChevronDown, ChevronRight, FilePlus2, FolderPlus, Loader2, PanelLeft, PanelsTopLeft, Upload } from "lucide-react"
import { AnimatedLoader } from "../ui/AnimatedLoader"
import { cn } from "../../lib/ui/lib/utils"
import { IMPORT_ACCEPT } from "../../lib/cardmirror/stored-cmir"
import {
  REASON_EDITOR_ROUTE,
  editorHrefForSelection,
  isEditorPathname,
  type ReasonDocsSelection,
} from "../../lib/reason-docs/route-selection"
import {
  PANEL_LABELS,
  PANEL_MIN_SIZE,
  isPanel,
  layoutFor,
  parseLayout,
  visiblePanelsOf,
  type PanelLayout,
  type SidebarPanel,
} from "../../lib/reason-docs/panel-layout"
import { ShareWithContacts } from "../reason-editor/ShareWithContacts"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import { TopicStarterTree, type TopicStarterItem } from "./TopicStarterTree"
import { useReasonDocs } from "./ReasonDocsProvider"
import type { ReasonDocument } from "./types"

/** Which panels are shown, stacked top-to-bottom like the REASON sidebar
 *  this is ported from. Files + Open Tabs both visible is that sidebar's
 *  default view. The stack order itself, and how the panels divide the height
 *  they share, live in `lib/reason-docs/panel-layout.ts`. */
const DEFAULT_PANELS: SidebarPanel[] = ["files", "openTabs"]
const PANELS_STORAGE_KEY = "reason-editor-sidebar-panels"
const SECTION_STORAGE_KEY = "reason-editor-sidebar-open"
const LAYOUT_STORAGE_KEY = "reason-editor-sidebar-layout"

const PANEL_TOGGLES: { panel: SidebarPanel; label: string; icon: typeof PanelLeft }[] = [
  { panel: "files", label: "Files", icon: PanelLeft },
  { panel: "topicStarters", label: "Topics", icon: BookOpen },
  { panel: "openTabs", label: "Tabs", icon: PanelsTopLeft },
]

function loadPanels(): SidebarPanel[] {
  try {
    const raw = localStorage.getItem(PANELS_STORAGE_KEY)
    if (!raw) return DEFAULT_PANELS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_PANELS
    const valid = parsed.filter(isPanel)
    return valid.length > 0 ? valid : DEFAULT_PANELS
  } catch {
    return DEFAULT_PANELS
  }
}

/** The user's explicit collapse choice, or `null` when they've never made
 *  one (in which case the section starts open — see `isOpen` below). */
function loadSectionOpen(): boolean | null {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY)
    return raw === "true" ? true : raw === "false" ? false : null
  } catch {
    return null
  }
}

/** The panel sizes the reader last dragged to, or `{}` when they never have
 *  (or when storage is unavailable — see `loadPanels` above). */
function loadLayout(): PanelLayout {
  try {
    return parseLayout(localStorage.getItem(LAYOUT_STORAGE_KEY))
  } catch {
    return {}
  }
}

export interface ReasonDocsSidebarPanelsProps {
  className?: string
  /**
   * Take the height the container gives instead of the panels' own fixed one.
   *
   * Passed on `/cards`, where these panels *are* the sidebar and so own what
   * is left of the column under the dock. Left off where something else sits
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
    openTabs,
    activeId,
    loading,
    ensureLoaded,
    openDocument,
    selectTab,
    closeTab,
    createDocument,
    deleteDocument,
    moveDocument,
    updateTitle,
    selectTopicDocument,
    importFiles,
    importing,
    downloadDocument,
    downloadTopicDocument,
  } = useReasonDocs()

  const [panels, setPanels] = useState<SidebarPanel[]>(DEFAULT_PANELS)
  const [openOverride, setOpenOverride] = useState<boolean | null>(null)
  /** The reader's last dragged panel sizes, and whether they have been read
   *  yet — the group opens at the defaults for the server render and is
   *  remounted on the stored sizes once they are in (see `key` below). */
  const [storedLayout, setStoredLayout] = useState<PanelLayout>({})
  const [layoutHydrated, setLayoutHydrated] = useState(false)
  /** What the last upload couldn't take, shown under the tree until the next
   *  one. Silence would leave a reader watching a file that never appears. */
  const [importErrors, setImportErrors] = useState<string[]>([])
  /** Why the last download failed, shown the same way until the next attempt. */
  const [downloadError, setDownloadError] = useState<string | null>(null)
  /** Same as `downloadError`, for the Topic Starters panel — kept separate so
   *  a failure in one panel isn't shown under the other. */
  const [topicDownloadError, setTopicDownloadError] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Panel choice and collapse state are per-device view preferences (same as
  // the source sidebar's persisted panel list); read after mount so the SSR
  // markup stays deterministic.
  useEffect(() => {
    setPanels(loadPanels())
    setOpenOverride(loadSectionOpen())
    setStoredLayout(loadLayout())
    setLayoutHydrated(true)
  }, [])

  const onEditorRoute = isEditorPathname(pathname)

  /** The open document, which is what the share control shares. */
  const activeDocument = useMemo(
    () => (activeId == null ? null : documents.find((doc) => doc.id === activeId) ?? null),
    [documents, activeId],
  )
  // Expanded by default: this only mounts where the documents *are* the
  // page's subject (`/cards` and the editor), and on `/cards` these panels are
  // the whole sidebar — a collapsed "Documents" row would leave that column
  // empty but for the dock. The user's own collapse still wins, and sticks.
  const isOpen = openOverride ?? true

  // Nothing is fetched until the section is actually on screen, so a reader
  // who collapses it makes no document requests at all.
  useEffect(() => {
    if (isOpen) ensureLoaded()
  }, [isOpen, ensureLoaded])

  const toggleSection = () => {
    const next = !isOpen
    setOpenOverride(next)
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, String(next))
    } catch {
      // Storage unavailable (private mode) — the toggle still works for this
      // visit, it just won't be remembered.
    }
  }

  const togglePanel = useCallback((panel: SidebarPanel) => {
    setPanels((prev) => {
      const next = prev.includes(panel) ? prev.filter((p) => p !== panel) : [...prev, panel]
      if (next.length === 0) return prev // always keep at least one panel
      try {
        localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // See above — the preference just isn't persisted.
      }
      return next
    })
  }, [])

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
   * branch), so CardMirror always comes up with *that* file rather than
   * whatever the editor would otherwise fall back to.
   *
   * Already on the route, nothing is routed at all: the provider has the file
   * open, and `ReasonDocsRouteSync` renames the address bar in place. Routing
   * would mean a Next route change between `/reason-editor/<a>` and
   * `/reason-editor/<b>`, which remounts CardMirror — ten files opened in a
   * row would be ten editor remounts, and ten Back presses to leave.
   */
  const goToEditor = useCallback(
    (selection: ReasonDocsSelection, extraItems: readonly ReasonDocument[] = []) => {
      // `extraItems` covers a file whose row hasn't reached state yet — a
      // just-uploaded one — so its link is its name rather than its id.
      const href = editorHrefForSelection(
        selection,
        selection.kind === "document" ? [...extraItems, ...documents] : topicItems,
      )
      if (onEditorRoute) router.replace(href)
      else router.push(href)
    },
    [onEditorRoute, router, documents, topicItems],
  )

  /**
   * Takes files from the Upload button or a drop onto the tree.
   *
   * Everything becomes a CardMirror native file on the way in — the sidebar
   * never stores a `.docx` as-is and never runs it through the card parser, so
   * an imported Verbatim document keeps its cards, highlighting and comments
   * (`lib/cardmirror/stored-cmir.ts`). The first file imported is opened, which
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

  const visiblePanels = useMemo(() => visiblePanelsOf(panels), [panels])
  const defaultLayout = useMemo(() => layoutFor(visiblePanels, storedLayout), [visiblePanels, storedLayout])

  /**
   * Remembers a drag, per-device, like the panel choice above it.
   *
   * Only a reader's own drag is stored (`isUserInteraction`): the same callback
   * also fires for the layout the group computes on mount and on a constraint
   * recompute, and writing those back would overwrite a deliberate split with
   * whatever the defaults worked out to.
   */
  const saveLayout = useCallback((layout: PanelLayout, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction) return
    setStoredLayout((prev) => {
      const next = { ...prev, ...layout }
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // See above — the split holds for this visit, it just isn't remembered.
      }
      return next
    })
  }, [])

  /** Each panel's contents, so the stack below is one pass over the visible
   *  panels rather than three near-identical branches. Sizing lives on the
   *  `Panel` wrapper, not here. */
  const panelBodies: Record<SidebarPanel, ReactNode> = {
    files: (
      <>
        <p className="shrink-0 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Files
        </p>
        <FileTree
          documents={documents}
          activeId={activeId}
          onSelect={(id) => {
            openDocument(id)
            goToEditor({ kind: "document", id })
          }}
          onAdd={(parentId, isFolder) => void createDocument(parentId, isFolder)}
          onRename={updateTitle}
          onDelete={(id) => void deleteDocument(id)}
          onMove={(id, parentId) => void moveDocument(id, parentId)}
          onUpload={(files, parentId) => void uploadFiles(files, parentId)}
          onDownload={downloadFile}
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
    ),
    topicStarters: (
      <>
        <p className="shrink-0 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Topic Starters
        </p>
        <TopicStarterTree
          items={topicItems}
          onSelect={(item) => {
            selectTopicDocument(item)
            goToEditor({ kind: "topic", id: item.id })
          }}
          onDownload={downloadTopicFile}
        />
        {topicDownloadError && (
          <p className="shrink-0 px-3 pb-2 text-xs text-destructive">{topicDownloadError}</p>
        )}
      </>
    ),
    openTabs: (
      <>
        <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Open Tabs{openTabs.length > 0 && ` (${openTabs.length})`}
          </p>
          <button
            type="button"
            onClick={() => {
              void createDocument(null, false)
              goToBlankEditor()
            }}
            title="New File"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <OpenTabsPanel
          documents={documents}
          openTabs={openTabs}
          activeId={activeId}
          onSelect={(id) => {
            selectTab(id)
            goToEditor({ kind: "document", id })
          }}
          onClose={closeTab}
        />
      </>
    ),
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center gap-1 px-1">
        <button
          type="button"
          onClick={toggleSection}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Documents
        </button>
        {isOpen && (
          <>
            <button
              type="button"
              onClick={() => {
                void createDocument(null, false)
                goToBlankEditor()
              }}
              title="New document"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void createDocument(null, true)}
              title="New folder"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={importing}
              title={`Upload a file (${IMPORT_ACCEPT})`}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </button>
            {/* Sharing rides in this row rather than in the editor's own
                header strip: it is a thing done to the open file, and this is
                the row the file's other actions are in. Only on the editor
                route — sharing starts a live co-editing session through the
                CardMirror engine, which is mounted by that page, so the
                control would fail anywhere else. `?shareWith=` puts it
                straight into the dialog, hence the Suspense. */}
            {onEditorRoute && activeDocument && (
              <Suspense>
                <ShareWithContacts variant="icon" title={activeDocument.title} />
              </Suspense>
            )}
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
          </>
        )}
      </div>

      {isOpen && (
        <>
          {/* Panel toggles — multi-select, so Files and Open Tabs stack
              together like the source REASON sidebar's default view. */}
          <div className="mt-1 flex items-center gap-1 border-b pb-1.5">
            {PANEL_TOGGLES.map(({ panel, label, icon: Icon }) => (
              <button
                key={panel}
                type="button"
                onClick={() => togglePanel(panel)}
                aria-pressed={panels.includes(panel)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-colors",
                  panels.includes(panel)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {panel === "openTabs" && openTabs.length > 0 && (
                  <span className="text-muted-foreground">({openTabs.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Where these panels are the sidebar (`fill`) the box takes what
              is left of the column and the separators below divide it, so the
              tree and the tabs are sized by dragging rather than by a number
              in this file. Everywhere else it keeps a definite height: the
              sidebar scrolls as a whole there, and a flexible box would be
              squeezed to nothing by the nav tree under it. Either way the
              panels scroll inside the box. */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className={cn(
                "flex min-h-0 flex-col",
                fill ? "flex-1" : "h-[380px] max-h-[30vh] md:max-h-[45vh]",
              )}
            >
              {/* `key` covers the panel set changing, and the stored sizes
                  arriving after mount: a layout belongs to the set it was
                  dragged on, so switching a panel on reopens the group at the
                  sizes saved for *that* set instead of squeezing the new panel
                  into what the others left. */}
              <Group
                key={`${layoutHydrated}:${visiblePanels.join("|")}`}
                orientation="vertical"
                defaultLayout={defaultLayout}
                onLayoutChanged={saveLayout}
                className="flex min-h-0 flex-1 flex-col"
              >
                {visiblePanels.map((panel, index) => (
                  <Fragment key={panel}>
                    {index > 0 && (
                      <Separator
                        aria-label={`Resize ${PANEL_LABELS[panel]}`}
                        className="relative flex h-px w-full shrink-0 bg-border transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-2 after:-translate-y-1/2 hover:bg-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    )}
                    <Panel id={panel} minSize={PANEL_MIN_SIZE} className="flex h-full min-h-0 flex-col">
                      {panelBodies[panel]}
                    </Panel>
                  </Fragment>
                ))}
              </Group>
            </div>
          )}
        </>
      )}
    </div>
  )
}
