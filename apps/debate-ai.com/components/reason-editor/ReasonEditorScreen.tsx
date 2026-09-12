"use client"

/**
 * The native REASON editor screen — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * The docs sidebar (file tree + "Open Tabs", ported from quick search's
 * REASON editor sidebar) is no longer this page's own `<aside>`: it lives in
 * the app's persistent sidebar (`AppSidebarShell` →
 * `ReasonDocsSidebarPanels`), which already wrapped this route and so used to
 * put a second sidebar beside it. This page now only renders the editor for
 * whatever that sidebar has active, reading it from `ReasonDocsProvider` —
 * or, on a cold load, from the named link that sidebar routes to
 * (`ReasonDocsRouteSync`).
 * That sidebar is desktop-only, so the same panels are also mounted here as a
 * collapsible strip below `md`.
 *
 * A document's stored shape is not always the HTML the editor's `content`
 * prop takes: an uploaded file is kept as CardMirror's native `.cmir`, and
 * `documentHtml` is what renders either shape for the editor (and what keeps
 * an edit made this session in front of the stored copy when you switch tabs
 * and come back).
 *
 * CardMirror is mounted with `defaultNavPaneHidden` so the engine's own
 * outline nav pane doesn't claim a second sidebar's worth of the column — the
 * app sidebar owns the side, and the outline stays one pull-tab / View-menu
 * toggle away.
 */

import { Suspense, useEffect, useMemo } from "react"
import { AnimatedLoader } from "@/components/ui/AnimatedLoader"
import { EditorWithToolbar } from "debate-editor"
import { topicStarterHtml } from "@/lib/topic-starters/content"
import { cn } from "@/lib/ui/lib/utils"
import { ReasonDocsSidebarPanels } from "@/components/reason-docs/ReasonDocsSidebarPanels"
import { useReasonDocs } from "@/components/reason-docs/ReasonDocsProvider"
import { ReasonDocsRouteSync } from "@/components/reason-docs/ReasonDocsRouteSync"
import { ShareWithContacts, SharedCardOpener } from "@/components/reason-editor/ShareWithContacts"

export function ReasonEditorScreen() {
  const {
    documents,
    openTabs,
    activeId,
    topicDocument,
    loading,
    saving,
    unsaved,
    saveFailed,
    ensureLoaded,
    selectTab,
    closeTab,
    updateContent,
    documentHtml,
  } = useReasonDocs()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  const selected = documents.find((d) => d.id === activeId) ?? null

  // Topic Starters are stored as `.cmir`, so opening one means gunzipping and
  // reparsing it — once per file, not once per keystroke elsewhere on the
  // page.
  const topicHtml = useMemo(
    () => (topicDocument ? topicStarterHtml(topicDocument) : null),
    [topicDocument],
  )

  // Same for an uploaded document, which is stored as `.cmir` too — and for
  // an HTML row, `documentHtml` hands back whatever this session's own edit
  // wrote (`ReasonDocsProvider`'s `openHtmlRef`), so switching tabs and back
  // doesn't lose an edit made before the debounced save landed. Keyed on the
  // row's identity rather than its content: the content changes on every
  // debounced save, and re-parsing the file each time would gunzip a card
  // document on a timer for a result the editor doesn't re-read.
  const selectedHtml = useMemo(
    () => (selected ? documentHtml(selected) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, selected?.format, documentHtml],
  )

  return (
    <div className="h-dvh flex flex-col overflow-hidden pt-14 lg:pt-0 pb-20 lg:pb-0">
      {/* Opens a card a contact shared (`?share=<id>` from /contacts) and
          seeds the co-editing display name; mounted once, renders nothing. */}
      <Suspense>
        <SharedCardOpener />
      </Suspense>
      {/* Opens whichever file the URL names — and, failing that, the first
          one — so a click from any sidebar (including `/videos`, which is its
          own layout branch) brings this column up with that file loaded, and
          keeps the address bar on that file's name. Renders nothing. */}
      <Suspense>
        <ReasonDocsRouteSync />
      </Suspense>
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
            {/* No rename field here: the tab strip above already names the
                open document, and renaming lives in the sidebar file tree
                (`ReasonDocsSidebarPanels` → `onRename`). This row is just
                the status/sharing strip. */}
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              {topicDocument ? <span className="text-xs text-muted-foreground">Public topic starter</span> : saving && <span className="text-xs text-muted-foreground">Saving…</span>}
              {selected && (
                <div className="ml-auto">
                  {/* Account-linked live sharing (contacts list, /contacts).
                      Reads `?shareWith=`, hence the Suspense. */}
                  <Suspense>
                    <ShareWithContacts title={selected.title} />
                  </Suspense>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* No React `key` here on purpose: `contentKey` already gives
                  each document a fresh claim (and undo history) inside the
                  CardMirror singleton, and a keyed remount would also rerun
                  the editor's mount effects — re-hiding a nav pane the user
                  pulled back open — on every document switch. */}
              <EditorWithToolbar
                content={topicHtml ?? selectedHtml!}
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
