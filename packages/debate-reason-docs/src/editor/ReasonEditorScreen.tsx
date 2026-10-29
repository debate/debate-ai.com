"use client"

/**
 * The native REASON editor screen — the @debate-ai/editor (TipTap/Debate Editor) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * The docs sidebar (Topic Starters + My Personal Documents, ported from quick
 * search's REASON editor sidebar) is no longer this page's own `<aside>`: it lives in
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
 * prop takes: an uploaded file is kept as Debate Editor's native `.cmir`, and
 * `documentHtml` is what renders either shape for the editor (and what keeps
 * an edit made this session in front of the stored copy when you switch tabs
 * and come back).
 *
 * Debate Editor's own outline nav pane opens with every document, beside the
 * app sidebar; its × or the View menu hides it for the current document.
 */

import { Suspense, useEffect, useMemo } from "react"
import { Loader2 } from "lucide-react"
import { AnimatedLoader } from "@debate-ai/ui/loaders/AnimatedLoader"
import { EditorWithToolbar } from "@debate-ai/editor"
import { topicStarterHtml } from "../lib/topic-starters/content"
import { STORED_FORMATS } from "../lib/debate-editor/format"
import { EditorTabStrip } from "./EditorTabStrip"
import { describeDocSaveStatus } from "../lib/reason-docs/doc-save-status"
import { ReasonDocsSidebarPanels } from "../docs/ReasonDocsSidebarPanels"
import { useReasonDocs } from "../docs/ReasonDocsProvider"
import { ReasonDocsRouteSync } from "../docs/ReasonDocsRouteSync"
import { SharedCardOpener } from "./ShareWithContacts"

export function ReasonEditorScreen() {
  const {
    documents,
    openTabs,
    activeTab,
    topicDocument,
    tabTitle,
    loading,
    saving,
    unsaved,
    saveFailed,
    ensureLoaded,
    selectTab,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    reopenClosedTab,
    canReopenTab,
    updateContent,
    documentHtml,
  } = useReasonDocs()

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  // `topicDocument` is set instead when the active tab is a Topic Starter's.
  const selected = topicDocument ? null : documents.find((d) => d.id === activeTab) ?? null

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

  const saveStatus = describeDocSaveStatus({
    isTopicDocument: topicDocument !== null,
    saving,
    unsaved,
    saveFailed,
  })

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
          <EditorTabStrip
            documents={documents}
            tabTitle={tabTitle}
            openTabs={openTabs}
            activeId={activeTab}
            canReopen={canReopenTab}
            onSelect={selectTab}
            onClose={closeTab}
            onCloseOthers={closeOtherTabs}
            onCloseToRight={closeTabsToRight}
            onCloseAll={closeAllTabs}
            onReopen={reopenClosedTab}
          />
        )}

        {selected || topicDocument ? (
          <>
            {/* No rename field here, and no share button: the tab strip above
                already names the open document, and renaming and sharing are
                both in the sidebar's document row
                (`ReasonDocsSidebarPanels` → `onRename`, `ShareWithContacts`)
                next to New file / New folder / Upload. This row is just the
                status line (`describeDocSaveStatus`). */}
            {/* Only a failed save shows a line: saving happens in the
                background without a notice, and a read-only topic starter
                needs none — its tab already names it. */}
            {saveStatus.state !== "failed" ? null : (
              <div className="flex items-center gap-2 px-4 py-2 border-b">
                <span
                  className="text-xs text-destructive"
                  title={saveStatus.title}
                  data-doc-save-state={saveStatus.state}
                >
                  {saveStatus.label}
                </span>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              {/* No React `key` here on purpose: `contentKey` already gives
                  each tab its own claim (and its own undo history, kept while
                  another tab is on screen) inside the Debate Editor
                  singleton, so a keyed remount would only rerun the editor's
                  mount effects on every tab switch. */}
              <EditorWithToolbar
                content={topicHtml ?? selectedHtml!}
                contentKey={topicDocument ? `topic-${topicDocument.id}` : String(selected!.id)}
                title={topicDocument?.title ?? selected!.title}
                showAiTools={!topicDocument}
                showOutline
                showToolbar={!topicDocument}
                defaultReadMode={topicDocument !== null || selected?.format === STORED_FORMATS.cmir}
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
