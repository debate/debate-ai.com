"use client"

/**
 * Native REASON editor route — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * The docs sidebar (file tree + "Open Tabs", ported from quick search's
 * REASON editor sidebar) is no longer this page's own `<aside>`: it lives in
 * the app's persistent sidebar (`AppSidebarShell` →
 * `ReasonDocsSidebarPanels`), which already wrapped this route and so used to
 * put a second sidebar beside it. This page now only renders the editor for
 * whatever that sidebar has active, reading it from `ReasonDocsProvider`.
 * That sidebar is desktop-only, so the same panels are also mounted here as a
 * collapsible strip below `md`.
 *
 * CardMirror is mounted with `defaultNavPaneHidden` so the engine's own
 * outline nav pane doesn't claim a second sidebar's worth of the column — the
 * app sidebar owns the side, and the outline stays one pull-tab / View-menu
 * toggle away.
 */

import { useEffect } from "react"
import { Loader2 } from "lucide-react"
import { EditorWithToolbar } from "debate-editor"
import { cn } from "../../lib/ui/lib/utils"
import { Input } from "../../lib/ui/primitives/input"
import { ReasonDocsSidebarPanels } from "@/components/reason-docs/ReasonDocsSidebarPanels"
import { useReasonDocs } from "@/components/reason-docs/ReasonDocsProvider"

export default function ReasonEditorPage() {
  const {
    documents,
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
    updateTitle,
    updateContent,
  } = useReasonDocs()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  // Land on something readable instead of an empty pane: once the documents
  // are in, open the first file if the sidebar hasn't already picked one.
  useEffect(() => {
    if (!loaded || activeId != null || topicDocument) return
    const firstFile = documents.find((d) => !d.isFolder)
    if (firstFile) openDocument(firstFile.id)
  }, [loaded, activeId, topicDocument, documents, openDocument])

  const selected = documents.find((d) => d.id === activeId) ?? null

  return (
    <div className="h-dvh flex flex-col overflow-hidden pt-14 lg:pt-0 pb-20 lg:pb-0">
      {/* The app sidebar carrying these panels is `hidden md:flex`, so below
          that breakpoint they ride along at the top of the editor instead.
          No height cap here on purpose: the panels already size themselves
          (and scroll internally), and a second cap on top would just clip
          their lower panel out of view. */}
      <div className="md:hidden shrink-0 border-b px-2 py-1">
        <ReasonDocsSidebarPanels />
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {openTabs.length > 0 && (
          <div className="flex items-center border-b overflow-x-auto shrink-0">
            {openTabs.map((id) => {
              const doc = documents.find((d) => d.id === id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectTab(id)}
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
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : documents.length === 0 ? (
              "Create a document to start writing."
            ) : (
              "Select a file to open it."
            )}
          </div>
        )}
      </div>
    </div>
  )
}
