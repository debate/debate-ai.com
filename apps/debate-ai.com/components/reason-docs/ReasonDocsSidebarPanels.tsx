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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, ChevronDown, ChevronRight, FilePlus2, FolderPlus, Loader2, PanelLeft, PanelsTopLeft, Upload } from "lucide-react"
import { cn } from "@/lib/ui/lib/utils"
import { IMPORT_ACCEPT } from "@/lib/cardmirror/stored-cmir"
import {
  REASON_EDITOR_ROUTE,
  editorHrefForSelection,
  isEditorPathname,
  type ReasonDocsCatalog,
  type ReasonDocsSelection,
} from "@/lib/reason-docs/route-selection"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import { TopicStarterTree } from "./TopicStarterTree"
import { useReasonDocs } from "./ReasonDocsProvider"
import type { ReasonDocument } from "./types"

type SidebarPanel = "files" | "topicStarters" | "openTabs"

/** Which panels are shown, stacked top-to-bottom like the REASON sidebar
 *  this is ported from. Files + Open Tabs both visible is that sidebar's
 *  default view. */
const DEFAULT_PANELS: SidebarPanel[] = ["files", "openTabs"]
const PANELS_STORAGE_KEY = "reason-editor-sidebar-panels"
const SECTION_STORAGE_KEY = "reason-editor-sidebar-open"

const PANEL_TOGGLES: { panel: SidebarPanel; label: string; icon: typeof PanelLeft }[] = [
  { panel: "files", label: "Files", icon: PanelLeft },
  { panel: "topicStarters", label: "Topics", icon: BookOpen },
  { panel: "openTabs", label: "Tabs", icon: PanelsTopLeft },
]

function isPanel(value: unknown): value is SidebarPanel {
  return value === "files" || value === "topicStarters" || value === "openTabs"
}

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

export function ReasonDocsSidebarPanels({ className }: { className?: string }) {
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
  } = useReasonDocs()

  const [panels, setPanels] = useState<SidebarPanel[]>(DEFAULT_PANELS)
  const [openOverride, setOpenOverride] = useState<boolean | null>(null)
  /** What the last upload couldn't take, shown under the tree until the next
   *  one. Silence would leave a reader watching a file that never appears. */
  const [importErrors, setImportErrors] = useState<string[]>([])
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Panel choice and collapse state are per-device view preferences (same as
  // the source sidebar's persisted panel list); read after mount so the SSR
  // markup stays deterministic.
  useEffect(() => {
    setPanels(loadPanels())
    setOpenOverride(loadSectionOpen())
  }, [])

  const onEditorRoute = isEditorPathname(pathname)
  // Expanded by default: this only mounts where the documents *are* the
  // page's subject (`/cards` and the editor), and on `/cards` the sidebar is
  // now these panels plus the Research tool list — a collapsed "Documents"
  // row would leave that column with no file tree in it at all. The user's
  // own collapse still wins, and sticks.
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

  /** The files a URL can name, in the order a name resolves against them —
   *  see `lib/reason-docs/route-selection`. Folders open nothing, so they are
   *  not addressable. */
  const catalog: ReasonDocsCatalog = useMemo(
    () => ({
      documents: documents.filter((d) => !d.isFolder).map((d) => ({ id: d.id, title: d.title })),
      topics: topicItems.filter((t) => !t.isFolder).map((t) => ({ id: t.id, title: t.title })),
    }),
    [documents, topicItems],
  )

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

          {/* A definite height rather than `flex-1`: the sidebar scrolls as a
              whole, so a flexible panel here would be squeezed to nothing by
              the nav tree below it. The panels scroll inside this box, which
              keeps a smaller share of the viewport below `md`, where it rides
              above the editor instead of sitting in the sidebar. */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex h-[380px] max-h-[30vh] min-h-0 flex-col md:max-h-[45vh]">
              {panels.includes("files") && (
                <div className="flex min-h-0 flex-1 flex-col">
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
                  />
                  {importErrors.length > 0 && (
                    <ul className="shrink-0 space-y-1 px-3 pb-2 text-xs text-destructive">
                      {importErrors.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {panels.includes("topicStarters") && (
                <div className="flex min-h-0 flex-1 flex-col border-t first:border-t-0">
                  <p className="shrink-0 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Topic Starters
                  </p>
                  <TopicStarterTree
                    items={topicItems}
                    onSelect={(item) => {
                      selectTopicDocument(item)
                      goToEditor({ kind: "topic", id: item.id })
                    }}
                  />
                </div>
              )}

              {panels.includes("openTabs") && (
                <div
                  className={cn(
                    "flex min-h-0 flex-col border-t first:border-t-0",
                    // Alone it fills the section; stacked under another panel
                    // it keeps to the lower portion like the source sidebar's
                    // vertical split.
                    panels.length === 1 ? "flex-1" : "max-h-[40%] shrink-0",
                  )}
                >
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
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
