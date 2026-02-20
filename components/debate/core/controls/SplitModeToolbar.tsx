/**
 * @fileoverview Toolbar for split mode controls
 * @module components/debate/core/controls/SplitModeToolbar
 */

import { ChevronLeft, ChevronRight, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ViewModeSelector } from "./ViewModeSelector"

interface SplitModeToolbarProps {
  /** Left speech name */
  leftSpeech: string
  /** Right speech name */
  rightSpeech: string
  /** Can navigate to previous speeches */
  canNavigatePrev: boolean
  /** Can navigate to next speeches */
  canNavigateNext: boolean
  /** Handler for previous speeches */
  onNavigatePrev: () => void
  /** Handler for next speeches */
  onNavigateNext: () => void
  /** Left panel view mode */
  leftViewMode: ViewMode
  /** Right panel view mode */
  rightViewMode: ViewMode
  /** Left panel quote view */
  leftQuoteView: boolean
  /** Right panel quote view */
  rightQuoteView: boolean
  /** Handler for left view mode change */
  onLeftViewModeChange: (mode: ViewMode) => void
  /** Handler for right view mode change */
  onRightViewModeChange: (mode: ViewMode) => void
  /** Handler for left quote view toggle */
  onLeftQuoteViewToggle: () => void
  /** Handler for right quote view toggle */
  onRightQuoteViewToggle: () => void
}

/**
 * Toolbar for split mode with navigation and view controls
 */
export function SplitModeToolbar({
  leftSpeech,
  rightSpeech,
  canNavigatePrev,
  canNavigateNext,
  onNavigatePrev,
  onNavigateNext,
  leftViewMode,
  rightViewMode,
  leftQuoteView,
  rightQuoteView,
  onLeftViewModeChange,
  onRightViewModeChange,
  onLeftQuoteViewToggle,
  onRightQuoteViewToggle,
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
          {leftSpeech} / {rightSpeech}
        </span>
        <Button variant="ghost" size="icon" onClick={onNavigateNext} disabled={!canNavigateNext} className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* View controls */}
      <div className="flex items-center gap-4">
        {/* Left panel controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Left:</span>
          <Button
            variant={leftQuoteView ? "default" : "ghost"}
            size="sm"
            onClick={onLeftQuoteViewToggle}
            className="h-7 px-2 gap-1"
          >
            <Quote className="h-3 w-3" />
          </Button>
          <ViewModeSelector value={leftViewMode} onChange={onLeftViewModeChange} size="sm" />
        </div>

        {/* Right panel controls */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Right:</span>
          <Button
            variant={rightQuoteView ? "default" : "ghost"}
            size="sm"
            onClick={onRightQuoteViewToggle}
            className="h-7 px-2 gap-1"
          >
            <Quote className="h-3 w-3" />
          </Button>
          <ViewModeSelector value={rightViewMode} onChange={onRightViewModeChange} size="sm" />
        </div>
      </div>
    </div>
  )
}
