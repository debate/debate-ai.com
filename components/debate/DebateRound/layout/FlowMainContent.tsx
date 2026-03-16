/**
 * @fileoverview Main content area for flow page
 * @module components/debate/flow/layout/FlowMainContent
 */

import type React from "react"
import { FlowSpreadsheet } from "../Flow/FlowSpreadsheet"
import { MarkdownEditor } from "../../../markdown/markdown-editor"
import { SpeechHeaderBar } from "./SpeechHeaderBar"
import type { Flow } from "@/components/debate/DebateRound/types"
import type { ViewMode } from "@/lib/types/debate-flow"
import type { SpeechTimerEntry } from "../hooks/useTimerState"

/** Props for the FlowMainContent component. */
interface FlowMainContentProps {
  /** The currently active flow, or null if none is selected. */
  currentFlow: Flow | null
  /** Whether split mode is active; shows two markdown editors side-by-side instead of the spreadsheet. */
  splitMode: boolean
  /** Ref that receives the AG Grid API instance once the grid is ready. */
  gridApiRef: React.RefObject<any>
  /** Name of the speech shown in the left split panel. */
  leftSpeech?: string
  /** Name of the speech shown in the right split panel. */
  rightSpeech?: string
  /** Active view mode for the left split panel. */
  leftViewMode?: ViewMode
  /** Active view mode for the right split panel. */
  rightViewMode?: ViewMode
  /** Whether the left split panel is in quote view. */
  leftQuoteView?: boolean
  /** Whether the right split panel is in quote view. */
  rightQuoteView?: boolean
  /** Handler called when the left panel view mode changes. */
  onLeftViewModeChange?: (mode: ViewMode) => void
  /** Handler called when the right panel view mode changes. */
  onRightViewModeChange?: (mode: ViewMode) => void
  /** Handler called when the left panel quote view is toggled. */
  onLeftQuoteViewToggle?: () => void
  /** Handler called when the right panel quote view is toggled. */
  onRightQuoteViewToggle?: () => void
  /** Width percentage occupied by the left panel in split mode. */
  splitWidth?: number
  /** Markdown content for the left split panel. */
  leftContent?: string
  /** Markdown content for the right split panel. */
  rightContent?: string
  /** Handler called when a speech panel should be opened from the spreadsheet. */
  onOpenSpeechPanel?: (speech: string) => void
  /** Handler called when the left panel content changes. */
  onUpdateLeftSpeech?: (content: string) => void
  /** Handler called when the right panel content changes. */
  onUpdateRightSpeech?: (content: string) => void
  /** Handler called when the user begins dragging the split divider. */
  onMouseDown?: (e: React.MouseEvent) => void
  /** Handler called when the current flow's data should be updated. */
  onUpdate?: (updates: Partial<Flow>) => void
  /** Whether the viewport is mobile-sized; shows only one speech panel in split mode. */
  isMobile?: boolean
  /** Per-speech timer state map for persisting timers across navigation. */
  speechTimerStates?: Record<string, SpeechTimerEntry>
  /** Callback to update a per-speech timer state entry. */
  onSpeechTimerStateChange?: (speechName: string, updates: Partial<SpeechTimerEntry>) => void
  /** Callback to reset prep timers to their defaults. */
  onResetPrepTimers?: () => void
  /** Whether backward speech navigation is available. */
  canNavigatePrev?: boolean
  /** Whether forward speech navigation is available. */
  canNavigateNext?: boolean
  /** Handler called when the user navigates to the previous pair of speeches. */
  onNavigatePrev?: () => void
  /** Handler called when the user navigates to the next pair of speeches. */
  onNavigateNext?: () => void
  /** When provided, a hamburger button is rendered inside the mobile SpeechHeaderBar for sidebar access. */
  onMobileMenuClick?: () => void
}

/**
 * Main content area that renders either a split markdown editor view or the flow spreadsheet.
 *
 * @param props - Component props.
 * @param props.currentFlow - The active flow; renders an empty state when null.
 * @param props.splitMode - When true, renders two side-by-side markdown editors.
 * @param props.gridApiRef - Mutable ref assigned the AG Grid API after the grid mounts.
 * @param props.leftSpeech - Speech name for the left editor panel (split mode only).
 * @param props.rightSpeech - Speech name for the right editor panel (split mode only).
 * @param props.leftViewMode - View mode applied to the left editor (defaults to `"read"`).
 * @param props.rightViewMode - View mode applied to the right editor (defaults to `"read"`).
 * @param props.leftQuoteView - When true, left editor switches to `"quotes"` view mode.
 * @param props.rightQuoteView - When true, right editor switches to `"quotes"` view mode.
 * @param props.splitWidth - Percentage width of the left panel (defaults to 50).
 * @param props.leftContent - Initial markdown content for the left editor.
 * @param props.rightContent - Initial markdown content for the right editor.
 * @param props.onOpenSpeechPanel - Callback invoked with a speech name when a cell is opened.
 * @param props.onUpdateLeftSpeech - Callback invoked with new content when the left editor changes.
 * @param props.onUpdateRightSpeech - Callback invoked with new content when the right editor changes.
 * @param props.onMouseDown - Callback for the draggable divider `mousedown` event.
 * @param props.onUpdate - Callback invoked with partial flow updates from the spreadsheet.
 * @returns The appropriate content view for the current state.
 */
export function FlowMainContent({
  currentFlow,
  splitMode,
  gridApiRef,
  leftSpeech,
  rightSpeech,
  leftViewMode = "read",
  rightViewMode = "read",
  leftQuoteView = false,
  rightQuoteView = false,
  onLeftViewModeChange,
  onRightViewModeChange,
  onLeftQuoteViewToggle,
  onRightQuoteViewToggle,
  splitWidth = 50,
  leftContent = "",
  rightContent = "",
  onOpenSpeechPanel,
  onUpdateLeftSpeech,
  onUpdateRightSpeech,
  onMouseDown,
  onUpdate,
  isMobile = false,
  speechTimerStates,
  onSpeechTimerStateChange,
  onResetPrepTimers,
  canNavigatePrev,
  canNavigateNext,
  onNavigatePrev,
  onNavigateNext,
  onMobileMenuClick,
}: FlowMainContentProps) {
  if (!currentFlow) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-muted-foreground">No flow selected</p>
      </div>
    )
  }

  if (splitMode && leftSpeech && rightSpeech) {
    // Mobile: show only the left (active) speech at full width
    if (isMobile) {
      return (
        <div className="flex flex-col h-full bg-[var(--background)] rounded-[var(--border-radius)]">
          <div className="border-b border-border bg-muted/50">
            <SpeechHeaderBar
              speechName={leftSpeech}
              viewMode={leftViewMode}
              quoteView={leftQuoteView}
              onViewModeChange={onLeftViewModeChange}
              onQuoteViewToggle={onLeftQuoteViewToggle}
              controlledTime={speechTimerStates?.[leftSpeech]?.time}
              controlledTimerRunState={speechTimerStates?.[leftSpeech]?.state}
              onControlledTimeChange={(t) => onSpeechTimerStateChange?.(leftSpeech, { time: t })}
              onControlledTimerRunStateChange={(s) => onSpeechTimerStateChange?.(leftSpeech, { state: s })}
              onResetPrepTimers={onResetPrepTimers}
              canNavigatePrev={canNavigatePrev}
              canNavigateNext={canNavigateNext}
              onNavigatePrev={onNavigatePrev}
              onNavigateNext={onNavigateNext}
              onMobileMenuClick={onMobileMenuClick}
              onOpenSpeechPanel={onOpenSpeechPanel}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor
              key={`mobile-${leftSpeech}`}
              content={leftContent}
              onChange={onUpdateLeftSpeech || ((_content: string) => { })}
              fileName={leftSpeech}
              className="h-full"
              showToolbar={true}
              viewMode={leftQuoteView ? "quotes" : leftViewMode}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-full split-container relative">
        {/* Left panel */}
        <div
          className="flex flex-col border-r border-border bg-[var(--background)] rounded-l-[var(--border-radius)]"
          style={{ width: `${splitWidth}%` }}
        >
          <div className="border-b border-border bg-muted/50">
            <SpeechHeaderBar
              speechName={leftSpeech}
              viewMode={leftViewMode}
              quoteView={leftQuoteView}
              onViewModeChange={onLeftViewModeChange}
              onQuoteViewToggle={onLeftQuoteViewToggle}
              controlledTime={speechTimerStates?.[leftSpeech]?.time}
              controlledTimerRunState={speechTimerStates?.[leftSpeech]?.state}
              onControlledTimeChange={(t) => onSpeechTimerStateChange?.(leftSpeech, { time: t })}
              onControlledTimerRunStateChange={(s) => onSpeechTimerStateChange?.(leftSpeech, { state: s })}
              onResetPrepTimers={onResetPrepTimers}
              canNavigatePrev={canNavigatePrev}
              canNavigateNext={canNavigateNext}
              onNavigatePrev={onNavigatePrev}
              onNavigateNext={onNavigateNext}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor
              key={`left-${leftSpeech}`}
              content={leftContent}
              onChange={onUpdateLeftSpeech || ((_content: string) => { })}
              fileName={leftSpeech}
              className="h-full"
              showToolbar={true}
              viewMode={leftQuoteView ? "quotes" : leftViewMode}
            />
          </div>
        </div>

        {/* Draggable divider */}
        {onMouseDown && (
          <div
            className="w-1 bg-border hover:bg-primary cursor-col-resize flex-shrink-0"
            onMouseDown={onMouseDown}
          />
        )}

        {/* Right panel */}
        <div
          className="flex flex-col bg-[var(--background)] rounded-r-[var(--border-radius)]"
          style={{ width: `${100 - splitWidth}%` }}
        >
          <div className="border-b border-border bg-muted/50">
            <SpeechHeaderBar
              speechName={rightSpeech}
              viewMode={rightViewMode}
              quoteView={rightQuoteView}
              onViewModeChange={onRightViewModeChange}
              onQuoteViewToggle={onRightQuoteViewToggle}
              controlledTime={speechTimerStates?.[rightSpeech]?.time}
              controlledTimerRunState={speechTimerStates?.[rightSpeech]?.state}
              onControlledTimeChange={(t) => onSpeechTimerStateChange?.(rightSpeech, { time: t })}
              onControlledTimerRunStateChange={(s) => onSpeechTimerStateChange?.(rightSpeech, { state: s })}
              onResetPrepTimers={onResetPrepTimers}
              canNavigatePrev={canNavigatePrev}
              canNavigateNext={canNavigateNext}
              onNavigatePrev={onNavigatePrev}
              onNavigateNext={onNavigateNext}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor
              key={`right-${rightSpeech}`}
              content={rightContent}
              onChange={onUpdateRightSpeech || ((_content: string) => { })}
              fileName={rightSpeech}
              className="h-full"
              showToolbar={true}
              viewMode={rightQuoteView ? "quotes" : rightViewMode}
            />
          </div>
        </div>
      </div>
    )
  }

  // Spreadsheet view — on mobile, add a SpeechHeaderBar above the spreadsheet
  if (isMobile && leftSpeech) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)] rounded-[var(--border-radius)]">
        <div className="border-b border-border bg-muted/50">
          <SpeechHeaderBar
            speechName={leftSpeech}
            controlledTime={speechTimerStates?.[leftSpeech]?.time}
            controlledTimerRunState={speechTimerStates?.[leftSpeech]?.state}
            onControlledTimeChange={(t) => onSpeechTimerStateChange?.(leftSpeech, { time: t })}
            onControlledTimerRunStateChange={(s) => onSpeechTimerStateChange?.(leftSpeech, { state: s })}
            onResetPrepTimers={onResetPrepTimers}
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext}
            onNavigatePrev={onNavigatePrev}
            onNavigateNext={onNavigateNext}
            onMobileMenuClick={onMobileMenuClick}
            onOpenSpeechPanel={onOpenSpeechPanel}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <FlowSpreadsheet
            flow={currentFlow}
            onUpdate={onUpdate || ((_updates: Partial<Flow>) => { })}
            onOpenSpeechPanel={onOpenSpeechPanel}
            onGridReady={(api) => {
              if (gridApiRef) {
                // @ts-ignore - gridApiRef is a mutable ref
                gridApiRef.current = api
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[var(--background)] rounded-[var(--border-radius)] box-border overflow-hidden">
      <FlowSpreadsheet
        flow={currentFlow}
        onUpdate={onUpdate || ((_updates: Partial<Flow>) => { })}
        onOpenSpeechPanel={onOpenSpeechPanel}
        onGridReady={(api) => {
          if (gridApiRef) {
            // @ts-ignore - gridApiRef is a mutable ref
            gridApiRef.current = api
          }
        }}
      />
    </div>
  )
}
