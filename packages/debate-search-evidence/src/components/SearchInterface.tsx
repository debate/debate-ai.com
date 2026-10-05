/**
 * @fileoverview Root component for the CARD (Crowdsourced Annotated Research for Debates) search interface.
 *
 * Composes the full search experience from four sub-modules:
 * - {@link useSearchState} — search term, filters, sorting, API fetching, and result selection
 * - {@link useAiAnalysis} — AI prompt, generation, and clipboard actions
 * - {@link DesktopLayout} — three-panel resizable layout (search | content | AI)
 * - {@link MobileCardView} — below `md`, one card with Quote / AI summary / Full page tabs
 * - {@link FloatingActions} — FAB button to reopen the collapsed AI panel (desktop)
 *
 * Below `md` the result list is the default screen; tapping a card replaces it
 * with that card, and Back returns to the list.
 *
 * @module components/debate/DebateCardSearch/SearchInterface
 */

"use client"

import { useState } from "react"
import type { SearchResult } from "../types"
import { MobileCardView } from "./MobileCardView"
import { ResearchSearchSidebar } from "./ResearchSearchSidebar"
import { useSearchState } from "../hooks/useSearchState"
import { useAiAnalysis } from "../hooks/useAiAnalysis"
import { DesktopLayout } from "../layout/DesktopLayout"
import { FloatingActions } from "../layout/FloatingActions"

/**
 * Top-level search interface that wires together hooks and layout components.
 *
 * State is managed by two custom hooks ({@link useSearchState} and {@link useAiAnalysis}).
 * Layout is split between {@link DesktopLayout} (resizable panels, `md+`)
 * and the mobile list / {@link MobileCardView} pair (below `md`).
 */
export function SearchInterface() {
  const search = useSearchState()
  const ai = useAiAnalysis(search.selectedResult)

  /** Card content view mode: full text, highlighted, or underlined. */
  const [viewMode, setViewMode] = useState<"read" | "highlight" | "underline">("highlight")

  /** Whether the mobile layout shows the opened card rather than the list. */
  const [mobileCardOpen, setMobileCardOpen] = useState(false)
  // The AI Analysis panel starts open on desktop: selecting a card fills it
  // with that card's saved find-flaws-and-extensions analysis.
  const [isAiCollapsed, setIsAiCollapsed] = useState(false)

  /**
   * Wraps {@link search.selectResult} to also open the card on mobile, so a tap
   * focuses that card. Desktop never renders the mobile card, so the flag is
   * inert there.
   */
  const selectResultOnMobile = (result: SearchResult, index: number) => {
    search.selectResult(result, index)
    setMobileCardOpen(true)
  }

  // A new search clears the selection, which returns the mobile layout to the list.
  const showMobileCard = mobileCardOpen && search.selectedResult !== null

  return (
    <div className="h-full min-h-0 flex-1 flex flex-col relative overflow-hidden">
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
        onCloseAi={() => {}}
        customPrompt={ai.customPrompt}
        setCustomPrompt={ai.setCustomPrompt}
        aiResult={ai.aiResult}
        generating={ai.generating}
        handleGenerate={ai.handleGenerate}
        handleCopy={ai.handleCopy}
      />

      {/* Mobile: the result list is the default screen; a tapped card replaces it. */}
      <div className="flex-1 min-h-0 overflow-hidden md:hidden">
        {showMobileCard && search.selectedResult ? (
          <MobileCardView
            result={search.selectedResult}
            onBack={() => setMobileCardOpen(false)}
            viewMode={viewMode}
            setViewMode={setViewMode}
            aiResult={ai.aiResult}
            generating={ai.generating}
            handleGenerate={ai.handleGenerate}
          />
        ) : (
          <ResearchSearchSidebar
            searchTerm={search.searchTerm}
            setSearchTerm={search.setSearchTerm}
            sortBy={search.sortBy}
            setSortBy={search.setSortBy}
            filters={search.filters}
            setFilters={search.setFilters}
            searchResults={search.searchResults}
            totalResults={search.totalResults}
            selectedIndex={search.selectedIndex}
            selectResult={selectResultOnMobile}
            isLoading={search.loading}
          />
        )}
      </div>

      {/* Floating action buttons */}
      <FloatingActions
        isAiCollapsed={isAiCollapsed}
        onOpenAi={() => {
          setIsAiCollapsed(false)
        }}
      />

    </div>
  )
}
