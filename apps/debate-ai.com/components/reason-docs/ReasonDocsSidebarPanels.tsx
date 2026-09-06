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
 * editor route, so the tree stays on screen across tool pages; picking a file
 * anywhere routes to `/reason-editor` with it open.
 */

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BookOpen, ChevronDown, ChevronRight, FilePlus2, FolderPlus, Loader2, PanelLeft, PanelsTopLeft } from "lucide-react"
import { cn } from "@/lib/ui/lib/utils"
import { FileTree } from "./FileTree"
import { OpenTabsPanel } from "./OpenTabsPanel"
import { TopicStarterTree } from "./TopicStarterTree"
import { useReasonDocs } from "./ReasonDocsProvider"

export const REASON_EDITOR_ROUTE = "/reason-editor"

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
 *  one (in which case the section follows the current route). */
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
  // Expanded by default where the docs are the page's subject, collapsed on
  // the other tool pages the sidebar also covers — until the user says
  // otherwise, which sticks.
  const isOpen = openOverride ?? onEditorRoute

  // Nothing is fetched until the section is actually on screen, so tool pages
  // that leave it collapsed make no document requests at all.
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

  /** Selections made from another tool page carry the reader to the editor. */
  const goToEditor = useCallback(() => {
    if (!onEditorRoute) router.push(REASON_EDITOR_ROUTE)
  }, [onEditorRoute, router])

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
                goToEditor()
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
                      goToEditor()
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
                      goToEditor()
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
                        goToEditor()
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
                      goToEditor()
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
