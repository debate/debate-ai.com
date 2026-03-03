/**
 * @fileoverview Toolbar for split mode controls
 * @module components/debate/flow/controls/SplitModeToolbar
 */

import { ChevronLeft, ChevronRight, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ViewModeSelector } from "./ViewModeSelector"

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
  /** Active view mode for the left panel. */
  leftViewMode: ViewMode
  /** Active view mode for the right panel. */
  rightViewMode: ViewMode
  /** Whether the left panel is in quote view. */
  leftQuoteView: boolean
  /** Whether the right panel is in quote view. */
  rightQuoteView: boolean
  /** Handler called when the left panel view mode changes. */
  onLeftViewModeChange: (mode: ViewMode) => void
  /** Handler called when the right panel view mode changes. */
  onRightViewModeChange: (mode: ViewMode) => void
  /** Handler called when the left panel quote view is toggled. */
  onLeftQuoteViewToggle: () => void
  /** Handler called when the right panel quote view is toggled. */
  onRightQuoteViewToggle: () => void
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
 * @param props.leftViewMode - Current view mode selection for the left editor.
 * @param props.rightViewMode - Current view mode selection for the right editor.
 * @param props.leftQuoteView - Whether quote view is active for the left editor.
 * @param props.rightQuoteView - Whether quote view is active for the right editor.
 * @param props.onLeftViewModeChange - Callback invoked when the left view mode dropdown changes.
 * @param props.onRightViewModeChange - Callback invoked when the right view mode dropdown changes.
 * @param props.onLeftQuoteViewToggle - Callback invoked when the left quote-view button is clicked.
 * @param props.onRightQuoteViewToggle - Callback invoked when the right quote-view button is clicked.
 * @returns A toolbar row with navigation controls and per-panel view mode selectors.
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
