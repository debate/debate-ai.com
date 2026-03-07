/**
 * @fileoverview Desktop three-panel resizable layout for the CARD search interface.
 *
 * Renders a horizontal {@link ResizablePanelGroup} with:
 * - **Left panel**: Search sidebar with filters and result list
 * - **Center panel**: Card content viewer
 * - **Right panel** (collapsible): AI analysis sidebar
 *
 * Each panel is separated by a draggable {@link ResizableHandle} for user-controlled sizing.
 * This component is hidden on mobile (`hidden md:block`).
 *
 * @module components/debate/DebateCARDSearch/layout/DesktopLayout
 */

"use client"

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ResearchSearchSidebar, type SearchFilters } from "@/components/debate/DebateCARDSearch/ResearchSearchSidebar"
import { CardContentViewer } from "@/components/debate/DebateCARDSearch/CardContentViewer"
import { AiAnalysisSidebar } from "@/components/debate/DebateCARDSearch/AiAnalysisSidebar"
import type { SearchResult } from "@/components/debate/DebateCARDSearch/types"

/** Props for the {@link DesktopLayout} component. */
interface DesktopLayoutProps {
  /** Current search term. */
  searchTerm: string
  /** Setter for the search term. */
  setSearchTerm: (term: string) => void
  /** Current sort field and direction (e.g. `"_text_match:desc"`). */
  sortBy: string
  /** Setter for the sort order. */
  setSortBy: (sort: string) => void
  /** Active search filters. */
  filters: SearchFilters
  /** Setter for search filters. */
  setFilters: (filters: SearchFilters) => void
  /** Array of search results returned from the API. */
  searchResults: SearchResult[]
  /** Total number of matching results (may exceed the returned page). */
  totalResults: number
  /** Index of the currently selected result in {@link searchResults}. */
  selectedIndex: number
  /** Callback to select a result by reference and index. */
  selectResult: (result: SearchResult, index: number) => void
  /** Whether search results are currently loading. */
  isLoading: boolean
  /** The currently selected search result (or null). */
  selectedResult: SearchResult | null
  /** Card content view mode. */
  viewMode: "read" | "highlight" | "underline"
  /** Setter for the card view mode. */
  setViewMode: (mode: "read" | "highlight" | "underline") => void
  /** Whether the AI sidebar is collapsed. */
  isAiAnalysisSidebarCollapsed: boolean
  /** Callback to collapse the AI sidebar. */
  onCollapseAi: () => void
  /** Callback to close the AI sidebar overlay on mobile. */
  onCloseAi: () => void
  /** Custom AI prompt text. */
  customPrompt: string
  /** Setter for the AI prompt. */
  setCustomPrompt: (prompt: string) => void
  /** AI-generated analysis text. */
  aiResult: string
  /** Whether the AI is currently generating. */
  generating: boolean
  /** Trigger AI generation. */
  handleGenerate: () => void
  /** Copy card content to clipboard. */
  handleCopy: () => void
}

/**
 * Desktop-only resizable three-panel layout.
 *
 * Hidden on screens smaller than `md`. Panel sizes are expressed as
 * percentages of the total group width.
 *
 * @param props - See {@link DesktopLayoutProps}.
 */
export function DesktopLayout(props: DesktopLayoutProps) {
  const {
    searchTerm, setSearchTerm, sortBy, setSortBy,
    filters, setFilters, searchResults, totalResults,
    selectedIndex, selectResult, isLoading,
    selectedResult, viewMode, setViewMode,
    isAiAnalysisSidebarCollapsed, onCollapseAi, onCloseAi,
    customPrompt, setCustomPrompt, aiResult, generating,
    handleGenerate, handleCopy,
  } = props

  return (
    <div className="flex-1 hidden md:block overflow-hidden">
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {/* Left panel: search sidebar */}
        <ResizablePanel defaultSize={20} minSize={10} maxSize={30}>
          <ResearchSearchSidebar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            filters={filters}
            setFilters={setFilters}
            searchResults={searchResults}
            totalResults={totalResults}
            selectedIndex={selectedIndex}
            selectResult={selectResult}
            isLoading={isLoading}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center panel: card content viewer */}
        <ResizablePanel maxSize={70} defaultSize={isAiAnalysisSidebarCollapsed ? 80 : 50}>
          <CardContentViewer
            selectedResult={selectedResult}
            viewMode={viewMode}
            setViewMode={setViewMode}
            wordCount={selectedResult?.word_count || 0}
          />
        </ResizablePanel>

        {/* Right panel: AI analysis (collapsible) */}
        {!isAiAnalysisSidebarCollapsed && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={20} minSize={15} maxSize={40}>
              <AiAnalysisSidebar
                selectedResult={selectedResult}
                customPrompt={customPrompt}
                setCustomPrompt={setCustomPrompt}
                aiResult={aiResult}
                generating={generating}
                handleGenerate={handleGenerate}
                handleCopy={handleCopy}
                onClose={onCloseAi}
                onCollapse={onCollapseAi}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
