"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it.
import "./base-url"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { ChatInputBox, ChatWindow, configureResearchAgentUI, useChat } from "research-agent-ui"
import { ReasonDocs } from "react-reason-editor/reason-docs"
import { Sidebar, SidebarContent } from "react-reason-editor-sidebar"
import { themeActions } from "react-reason-editor/theme"
import { localeActions } from "react-reason-editor/locale-bundle"
import { useMainView } from "./MainViewProvider"
import { useChatTabs } from "./useChatTabs"
import { getPageTips, htmlToPlainText } from "./reason-docs/page-tips"
import { getTopicSearches } from "./reason-docs/topic-searches"
import {
  QWKSEARCH_DOCS_ROUTE,
  docIdFromSlug,
  docPathForId,
  docSlugFromPathname,
  readStoredDocs,
} from "@/lib/qwksearch/doc-paths"

import "katex/dist/katex.min.css"
import "easydrawer/styles.css"
import "katex/contrib/mhchem"

/**
 * The full qwksearch research workspace — REASON docs editor with the
 * files/outline sidebar plus research chat tabs — ported from
 * qwksearch-web's `MainWorkspaceView` and pointed at qwksearch.com's public
 * API by the surrounding `QwksearchProviders`/`base-url` wiring.
 */
export function QwksearchWorkspace() {
  const { activeView, toggleToDocs, toggleToResearch, filesSidebarRequestId } = useMainView()
  const { chatTabs, activeChatId, openChat, newChat, closeChat } = useChatTabs()
  const { sendMessage } = useChat()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [initialDocId, setInitialDocId] = useState<string | null>(null)
  const [hasRestoredFromUrl, setHasRestoredFromUrl] = useState(false)
  const [pendingTopicQuery, setPendingTopicQuery] = useState<string | null>(null)

  useEffect(() => {
    localeActions.setLang("en")
    themeActions.setColor("default")
  }, [])

  // Restore whichever tab (a chat or a REASON document) was active from the
  // URL on first load — the workspace itself never navigates away from
  // `/doc`, so this is the only way a shared/bookmarked link reopens the
  // right tab. A document is named in the path (`/doc/cp-answer-to-states`,
  // resolved against the editor's own document store); a chat is still
  // `?chat=<id>`, since a chat has no filed name to carry. `?docs=<id>` is
  // read too: links to that older form are already out there, and the effect
  // below rewrites the address to the named path once it lands.
  // Runs once; afterwards that effect owns keeping the URL in sync with the
  // live tab state.
  const restoredFromUrlRef = useRef(false)
  // Whether a document has ever been active in this session — see the mirror
  // effect below, which reads it to tell "not open yet" from "not open".
  const hasOpenedDocRef = useRef(false)
  useEffect(() => {
    if (restoredFromUrlRef.current) return
    restoredFromUrlRef.current = true
    const namedDocId = docIdFromSlug(docSlugFromPathname(pathname), readStoredDocs())
    const docsParam = namedDocId ?? searchParams.get("docs")
    const chatParam = searchParams.get("chat")
    if (docsParam) {
      setInitialDocId(docsParam)
      toggleToDocs()
    } else if (chatParam) {
      openChat(chatParam)
      toggleToResearch()
    }
    setHasRestoredFromUrl(true)
    // Runs once on mount only — later URL changes come from our own sync below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mirror the active tab into the URL without a route transition: chats and
  // REASON docs are tabs within this one workspace route, not separate pages,
  // so the URL only needs to record which tab is active for sharing/reload —
  // not drive navigation. An open document is named in the path (`/doc/<its
  // title>`, from the editor's own document store); an open chat stays a
  // `?chat=` id. `history.replaceState` and not the router: `/doc` and
  // `/doc/<slug>` are different Next routes, and routing between them on
  // every tab switch would remount the whole workspace.
  //
  // Waits for the restore effect above so it doesn't clobber the incoming URL
  // before the restored tab's state has landed. A rename is picked up the
  // next time the active tab changes — the editor's store has no same-tab
  // change notification to subscribe to.
  useEffect(() => {
    if (typeof window === "undefined" || !hasRestoredFromUrl) return
    const url = new URL(window.location.href)
    const chatId = activeView === "research" ? activeChatId : null
    if (chatId) url.searchParams.set("chat", chatId)
    else url.searchParams.delete("chat")
    // Superseded by the path; dropped so a restored `?docs=` link doesn't
    // keep naming the document twice, in two different ways.
    url.searchParams.delete("docs")
    if (activeDocId) hasOpenedDocRef.current = true
    // Between a cold load at `/doc/<name>` and the editor reporting that
    // document as active there is a commit with no active document in it.
    // Writing `/doc` in that gap would blank the name out of the address bar
    // (and out of a reload) before it has been acted on — so until the first
    // document opens, an incoming named path is left as it is. After that,
    // no active document really does mean the bare route.
    const docPath =
      activeView !== "docs"
        ? QWKSEARCH_DOCS_ROUTE
        : activeDocId
          ? docPathForId(activeDocId, readStoredDocs())
          : hasOpenedDocRef.current
            ? QWKSEARCH_DOCS_ROUTE
            : window.location.pathname
    const query = url.searchParams.toString()
    const nextRelative = `${docPath}${query ? `?${query}` : ""}${url.hash}`
    const currentRelative = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextRelative !== currentRelative) {
      window.history.replaceState(null, "", nextRelative)
    }
  }, [activeView, activeChatId, activeDocId, hasRestoredFromUrl])

  const extraTabs = chatTabs.map((tab) => ({ id: tab.id, title: tab.title, kind: "chat" as const }))

  const handleExtraTabSelect = (id: string) => {
    openChat(id)
    toggleToResearch()
  }

  const handleExtraTabClose = (id: string) => {
    const { closedWasActive, nextActiveId } = closeChat(id)
    if (closedWasActive && !nextActiveId) toggleToDocs()
  }

  const handleExtraTabAdd = () => {
    newChat()
    toggleToResearch()
  }

  // Let chat-history links (research-agent-ui's history dropdown, recent
  // chips, etc.) open a chat as a workspace tab in place instead of
  // navigating to a `/c/<chatId>` route this app doesn't serve.
  const handleOpenChat = useCallback(
    (id: string) => {
      openChat(id)
      toggleToResearch()
      return true
    },
    [openChat, toggleToResearch],
  )

  useEffect(() => {
    configureResearchAgentUI({ onOpenChat: handleOpenChat })
    return () => configureResearchAgentUI({ onOpenChat: undefined })
  }, [handleOpenChat])

  const handleGenerateTips = async (title: string, contentHtml: string) => {
    return getPageTips(title, htmlToPlainText(contentHtml))
  }

  const handleGenerateTopics = async (title: string, contentHtml: string) => {
    return getTopicSearches(title, htmlToPlainText(contentHtml))
  }

  // Opens a new chat tab for the clicked topic, then sends it as that
  // chat's first message once the tab becomes active. `sendMessage` reads
  // the currently active chat ID from context, so it can't run in the same
  // synchronous handler as `newChat()` without racing against the still-stale
  // previous chat ID — this effect waits for `activeChatId` to actually
  // reflect the new chat before sending.
  const handleSearchTopic = useCallback(
    (topic: string) => {
      newChat()
      toggleToResearch()
      setPendingTopicQuery(topic)
    },
    [newChat, toggleToResearch],
  )

  useEffect(() => {
    if (!pendingTopicQuery || !activeChatId) return
    sendMessage(pendingTopicQuery)
    setPendingTopicQuery(null)
  }, [pendingTopicQuery, activeChatId, sendMessage])

  const extraTabProps = {
    extraTabs,
    activeExtraTabId: activeView === "research" ? activeChatId ?? undefined : undefined,
    onExtraTabSelect: handleExtraTabSelect,
    onExtraTabClose: handleExtraTabClose,
    onExtraTabAdd: handleExtraTabAdd,
    onFileTabSelect: toggleToDocs,
    initialDocId,
    onActiveDocumentChange: setActiveDocId,
    onGenerateTips: handleGenerateTips,
    onGenerateTopics: handleGenerateTopics,
    onSearchTopic: handleSearchTopic,
  }

  // ReasonDocs takes its files/outline sidebar and right-panel body as
  // injected components; `react-reason-editor-sidebar` ships the pair the
  // editor is built against. Only the main-content slot differs between the
  // two views.
  const sidebarProps = {
    SidebarComponent: Sidebar,
    SidebarContentComponent: SidebarContent,
  }

  return activeView === "docs" ? (
    <ReasonDocs
      belowMainContent={<ChatInputBox />}
      openFilesSidebarSignal={filesSidebarRequestId}
      {...sidebarProps}
      {...extraTabProps}
    />
  ) : (
    <ReasonDocs
      mainContent={<ChatWindow />}
      openFilesSidebarSignal={filesSidebarRequestId}
      {...sidebarProps}
      {...extraTabProps}
    />
  )
}
