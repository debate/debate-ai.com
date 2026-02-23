/**
 * @fileoverview Mobile header for flow page
 * @module components/debate/core/layout/FlowPageHeader
 */

import type React from "react"
import { Menu, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FlowPageHeaderProps {
  /** Current active flow */
  currentFlow: Flow | null
  /** Whether split mode is active */
  splitMode: boolean
  /** Handler to open mobile menu */
  onMenuClick: () => void
  /** Handler to navigate to previous column */
  onNavigatePrev: () => void
  /** Handler to navigate to next column */
  onNavigateNext: () => void
}

/**
 * Mobile header with menu button and column navigation
 */
export function FlowPageHeader({
  currentFlow,
  splitMode,
  onMenuClick,
  onNavigatePrev,
  onNavigateNext,
}: FlowPageHeaderProps) {
  return (
    <div className="bg-[var(--background)] p-2 flex items-center gap-2 border-b border-border">
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="h-8 w-8">
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="text-lg font-semibold flex-1">{currentFlow?.content || "Debate Flow"}</h1>

      {!splitMode && currentFlow && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onNavigatePrev} className="h-8 w-8" aria-label="Previous column">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNavigateNext} className="h-8 w-8" aria-label="Next column">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
