/**
 * @fileoverview Root component for the CARD (Crowdsourced Annotated Research for Debates) search interface.
 *
 * Composes the full search experience from four sub-modules:
 * - {@link useSearchState} — search term, filters, sorting, API fetching, and result selection
 * - {@link useAiAnalysis} — AI prompt, generation, and clipboard actions
 * - {@link DesktopLayout} — three-panel resizable layout (search | content | AI)
 * - {@link MobileOverlays} — full-screen overlay sidebars for small screens
 * - {@link FloatingActions} — FAB buttons to toggle sidebars
 *
 * The mobile card viewer is rendered inline below the overlays.
 *
 * @module components/debate/DebateCardSearch/SearchInterface
 */

"use client"

import { useState } from "react"
import { CardContentViewer } from "@/components/debate/DebateCardSearch/CardContentViewer"
import { useSearchState } from "./hooks/useSearchState"
import { useAiAnalysis } from "./hooks/useAiAnalysis"
import { DesktopLayout } from "./layout/DesktopLayout"
import { MobileOverlays } from "./layout/MobileOverlays"
import { FloatingActions } from "./layout/FloatingActions"
import { Footer } from "@/components/debate/Footer"

/**
 * Top-level search interface that wires together hooks and layout components.
 *
 * State is managed by two custom hooks ({@link useSearchState} and {@link useAiAnalysis}).
 * Layout is split between {@link DesktopLayout} (resizable panels, `md+`)
 * and {@link MobileOverlays} + inline content (below `md`).
 */
export function SearchInterface() {
  const search = useSearchState()
  const ai = useAiAnalysis(search.selectedResult)

  /** Card content view mode: full text, highlighted, or underlined. */
  const [viewMode, setViewMode] = useState<"read" | "highlight" | "underline">("read")

  /** Mobile overlay visibility flags. */
  const [showSearchSidebar, setShowSearchSidebar] = useState(false)
  const [showAiSidebar, setShowAiSidebar] = useState(false)
  const [isAiCollapsed, setIsAiCollapsed] = useState(true)

  /**
   * Wraps {@link search.selectResult} to also close the mobile search overlay,
   * so the user sees the selected card immediately.
   */
  const selectResultAndCloseMobile = (result: any, index: number) => {
    search.selectResult(result, index)
    setShowSearchSidebar(false)
  }

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Mobile overlay sidebars (hidden on md+) */}
      <MobileOverlays
        showSearchSidebar={showSearchSidebar}
        onCloseSearch={() => setShowSearchSidebar(false)}
        showAiSidebar={showAiSidebar}
        onCloseAi={() => setShowAiSidebar(false)}
        onCollapseAi={() => setIsAiCollapsed(true)}
        searchTerm={search.searchTerm}
        setSearchTerm={search.setSearchTerm}
        sortBy={search.sortBy}
        setSortBy={search.setSortBy}
        filters={search.filters}
        setFilters={search.setFilters}
        searchResults={search.searchResults}
        totalResults={search.totalResults}
        selectedIndex={search.selectedIndex}
        selectResult={selectResultAndCloseMobile}
        isLoading={search.loading}
        selectedResult={search.selectedResult}
        customPrompt={ai.customPrompt}
        setCustomPrompt={ai.setCustomPrompt}
        aiResult={ai.aiResult}
        generating={ai.generating}
        handleGenerate={ai.handleGenerate}
        handleCopy={ai.handleCopy}
      />

      {/* Desktop resizable three-panel layout (hidden below md) */}
      <DesktopLayout
        searchTerm={search.searchTerm}
        setSearchTerm={search.setSearchTerm}
        sortBy={search.sortBy}
        setSortBy={search.setSortBy}
        filters={search.filters}
        setFilters={search.setFilters}
        searchResults={search.searchResults}
        totalResults={search.totalResults}
        selectedIndex={search.selectedIndex}
        selectResult={search.selectResult}
        isLoading={search.loading}
        selectedResult={search.selectedResult}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isAiAnalysisSidebarCollapsed={isAiCollapsed}
        onCollapseAi={() => setIsAiCollapsed(true)}
        onCloseAi={() => setShowAiSidebar(false)}
        customPrompt={ai.customPrompt}
        setCustomPrompt={ai.setCustomPrompt}
        aiResult={ai.aiResult}
        generating={ai.generating}
        handleGenerate={ai.handleGenerate}
        handleCopy={ai.handleCopy}
      />

      {/* Mobile card content (hidden on md+) */}
      <div className="flex-1 overflow-hidden md:hidden">
        <CardContentViewer
          selectedResult={search.selectedResult}
          viewMode={viewMode}
          setViewMode={setViewMode}
          wordCount={search.selectedResult?.word_count || 0}
        />
      </div>

      {/* Floating action buttons */}
      <FloatingActions
        isAiCollapsed={isAiCollapsed}
        onOpenAi={() => {
          setShowAiSidebar(true)
          setIsAiCollapsed(false)
        }}
        onOpenSearch={() => setShowSearchSidebar(true)}
      />

      <Footer />
    </div>
  )
}
