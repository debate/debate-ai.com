/**
 * @fileoverview Mobile overlay sidebars for the CARD search interface.
 *
 * On mobile viewports, sidebars are rendered as full-screen overlays with
 * a semi-transparent backdrop. Tapping the backdrop closes the sidebar.
 * These overlays are only visible below the `md` breakpoint.
 *
 * @module components/debate/DebateCARDSearch/layout/MobileOverlays
 */

"use client"

import { ResearchSearchSidebar, type SearchFilters } from "@/components/debate/DebateCARDSearch/ResearchSearchSidebar"
import { AiAnalysisSidebar } from "@/components/debate/DebateCARDSearch/AiAnalysisSidebar"
import type { SearchResult } from "@/components/debate/DebateCARDSearch/types"

/** Props for the {@link MobileOverlays} component. */
interface MobileOverlaysProps {
  /** Whether the search sidebar overlay is open. */
  showSearchSidebar: boolean
  /** Close the search sidebar overlay. */
  onCloseSearch: () => void
  /** Whether the AI analysis sidebar overlay is open. */
  showAiSidebar: boolean
  /** Close the AI analysis sidebar overlay. */
  onCloseAi: () => void
  /** Collapse the AI sidebar (used on both close and collapse). */
  onCollapseAi: () => void

  // Search sidebar props
  searchTerm: string
  setSearchTerm: (term: string) => void
  sortBy: string
  setSortBy: (sort: string) => void
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
  searchResults: SearchResult[]
  totalResults: number
  selectedIndex: number
  selectResult: (result: SearchResult, index: number) => void
  isLoading: boolean

  // AI sidebar props
  selectedResult: SearchResult | null
  customPrompt: string
  setCustomPrompt: (prompt: string) => void
  aiResult: string
  generating: boolean
  handleGenerate: () => void
  handleCopy: () => void
}

/**
 * Renders mobile-only overlay sidebars for search and AI analysis.
 *
 * Each overlay is a fixed full-screen container with a backdrop.
 * Only rendered when the corresponding `show*` flag is true.
 *
 * @param props - See {@link MobileOverlaysProps}.
 */
export function MobileOverlays(props: MobileOverlaysProps) {
  return (
    <>
      {/* Search sidebar overlay */}
      {props.showSearchSidebar && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={props.onCloseSearch} />
          <div className="relative z-10 h-full w-80">
            <ResearchSearchSidebar
              searchTerm={props.searchTerm}
              setSearchTerm={props.setSearchTerm}
              sortBy={props.sortBy}
              setSortBy={props.setSortBy}
              filters={props.filters}
              setFilters={props.setFilters}
              searchResults={props.searchResults}
              totalResults={props.totalResults}
              selectedIndex={props.selectedIndex}
              selectResult={props.selectResult}
              isLoading={props.isLoading}
              onClose={props.onCloseSearch}
            />
          </div>
        </div>
      )}

      {/* AI analysis sidebar overlay */}
      {props.showAiSidebar && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={props.onCloseAi} />
          <div className="relative z-10 h-full w-64 ml-auto">
            <AiAnalysisSidebar
              selectedResult={props.selectedResult}
              customPrompt={props.customPrompt}
              setCustomPrompt={props.setCustomPrompt}
              aiResult={props.aiResult}
              generating={props.generating}
              handleGenerate={props.handleGenerate}
              handleCopy={props.handleCopy}
              onClose={props.onCloseAi}
              onCollapse={props.onCollapseAi}
            />
          </div>
        </div>
      )}
    </>
  )
}
