/**
 * @fileoverview Toolbar for split mode controls
 * @module components/debate/flow/controls/SplitModeToolbar
 */
import type { ViewMode } from "@/lib/types/debate-flow"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Props for the SplitModeToolbar component. */
interface SplitModeToolbarProps {
  /** Name of the speech displayed in the left panel. */
  leftSpeech: string
  /** Name of the speech displayed in the right panel. */
  rightSpeech: string
  /** Whether backward speech navigation is available. */
  canNavigatePrev: boolean
  /** Whether forward speech navigation is available. */
  canNavigateNext: boolean
  /** Handler called when the user navigates to the previous pair of speeches. */
  onNavigatePrev: () => void
  /** Handler called when the user navigates to the next pair of speeches. */
  onNavigateNext: () => void
  /** Whether the viewport is mobile-sized. */
  isMobile?: boolean
}

/**
 * Toolbar for split mode with speech navigation and per-panel view controls.
 *
 * @param props - Component props.
 * @param props.leftSpeech - Name of the left panel speech shown in the navigation label.
 * @param props.rightSpeech - Name of the right panel speech shown in the navigation label.
 * @param props.canNavigatePrev - Enables/disables the previous navigation button.
 * @param props.canNavigateNext - Enables/disables the next navigation button.
 * @param props.onNavigatePrev - Callback invoked when the left chevron is clicked.
 * @param props.onNavigateNext - Callback invoked when the right chevron is clicked.
 * @returns A toolbar row with navigation controls and per-panel view mode selectors.
 */
export function SplitModeToolbar({
  leftSpeech,
  rightSpeech,
  canNavigatePrev,
  canNavigateNext,
  onNavigatePrev,
  onNavigateNext,
  isMobile = false,
}: SplitModeToolbarProps) {
  return (
    <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onNavigatePrev}
          disabled={!canNavigatePrev}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {isMobile ? leftSpeech : `${leftSpeech} / ${rightSpeech}`}
        </span>
        <Button variant="ghost" size="icon" onClick={onNavigateNext} disabled={!canNavigateNext} className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
