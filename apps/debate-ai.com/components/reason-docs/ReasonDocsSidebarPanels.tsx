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
 * Picking a file anywhere routes to `/reason-editor?doc=<id>` (or
 * `?topic=<id>` for a public topic starter), which brings CardMirror up in
 * the main column with that file loaded — see `ReasonDocsRouteSync` for why
 * the selection travels in the URL and not only in provider state.
 */

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, ChevronDown, ChevronRight, FilePlus2, FolderPlus, Loader2, PanelLeft, PanelsTopLeft } from "lucide-react"
import { cn } from "@/lib/ui/lib/utils"
import {
  REASON_EDITOR_ROUTE,
  editorHrefForSelection,
  type ReasonDocsSelection,
} from "@/lib/reason-docs/route-selection"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import { TopicStarterTree } from "./TopicStarterTree"
import { useReasonDocs } from "./ReasonDocsProvider"

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
  } = useReasonDocs()

  const [panels, setPanels] = useState<SidebarPanel[]>(DEFAULT_PANELS)
  const [openOverride, setOpenOverride] = useState<boolean | null>(null)

  // Panel choice and collapse state are per-device view preferences (same as
  // the source sidebar's persisted panel list); read after mount so the SSR
  // markup stays deterministic.
  useEffect(() => {
    setPanels(loadPanels())
    setOpenOverride(loadSectionOpen())
  }, [])

  const onEditorRoute = pathname === REASON_EDITOR_ROUTE
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

  /**
   * Carries a selection into the editor's main column, as a URL the editor
   * route can reopen on its own: `?doc=<id>` for an owned document,
   * `?topic=<id>` for a public topic starter.
   *
   * The provider state set alongside this makes the switch immediate on a
   * client-side hop; the query is what makes the same click survive a reload,
   * a shared link, or a hard navigation (`/videos` is a different layout
   * branch), so CardMirror always comes up with *that* file rather than
   * whatever the editor would otherwise fall back to.
   *
   * Already on the route, the URL is replaced rather than pushed: opening ten
   * files in a row shouldn't cost ten Back presses to leave the editor.
   */
  const goToEditor = useCallback(
    (selection: ReasonDocsSelection) => {
      const href = editorHrefForSelection(selection)
      if (onEditorRoute) router.replace(href)
      else router.push(href)
    },
    [onEditorRoute, router],
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
                  />
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
