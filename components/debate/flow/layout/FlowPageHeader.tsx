/**
 * @fileoverview Mobile header for flow page
 * @module components/debate/flow/layout/FlowPageHeader
 */

import type React from "react"
import { Menu, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Props for the FlowPageHeader component. */
interface FlowPageHeaderProps {
  /** The currently active flow, or null if none is selected. */
  currentFlow: Flow | null
  /** Whether split mode is active; hides the column navigation buttons when true. */
  splitMode: boolean
  /** Handler called when the user taps the hamburger menu button. */
  onMenuClick: () => void
  /** Handler called when the user taps the previous-column chevron. */
  onNavigatePrev: () => void
  /** Handler called when the user taps the next-column chevron. */
  onNavigateNext: () => void
}

/**
 * Mobile header bar with a menu toggle, flow title, and optional column navigation.
 *
 * @param props - Component props.
 * @param props.currentFlow - Active flow whose `content` is shown as the header title.
 * @param props.splitMode - When true, the column navigation buttons are hidden.
 * @param props.onMenuClick - Callback invoked when the hamburger icon button is clicked.
 * @param props.onNavigatePrev - Callback invoked when the left chevron is clicked.
 * @param props.onNavigateNext - Callback invoked when the right chevron is clicked.
 * @returns A fixed mobile header row with contextual navigation controls.
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
