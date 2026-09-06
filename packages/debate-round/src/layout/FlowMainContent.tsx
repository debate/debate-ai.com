/**
 * @fileoverview Main content area for flow page
 * @module components/debate/flow/layout/FlowMainContent
 */

import type React from "react"
import { LexicalEditorWrapper } from "debate-editor"
import type { Flow } from "../types/flow"

/** Props for the FlowMainContent component. */
interface FlowMainContentProps {
  /** The currently active flow, or null if none is selected. */
  currentFlow: Flow | null
  /** Whether split mode is active; shows two markdown editors side-by-side. */
  splitMode: boolean
  /** Name of the speech shown in the left split panel. */
  leftSpeech?: string
  /** Name of the speech shown in the right split panel. */
  rightSpeech?: string
  /** Width percentage occupied by the left panel in split mode. */
  splitWidth?: number
  /** Markdown content for the left split panel. */
  leftContent?: string
  /** Markdown content for the right split panel. */
  rightContent?: string
  /** Handler called when the left panel content changes. */
  onUpdateLeftSpeech?: (content: string) => void
  /** Handler called when the right panel content changes. */
  onUpdateRightSpeech?: (content: string) => void
  /** Handler called when the user begins dragging the split divider. */
  onMouseDown?: (e: React.MouseEvent) => void
  /** Whether the viewport is mobile-sized; shows only one speech panel in split mode. */
  isMobile?: boolean
  /** When true (desktop only), shows a single active speech panel instead of both side-by-side. */
  singlePaneMode?: boolean
  /**
   * Which split panel currently owns the live, editable CardMirror instance
   * — lifted to the page level so the sidebar's "round times" group can show
   * timer/controls for whichever speech is actually selected.
   */
  activeSplitSide?: "left" | "right"
  /** Handler called when the user activates a panel (click), making it the live editor. */
  onActiveSplitSideChange?: (side: "left" | "right") => void
}

/**
 * Main content area that renders the split markdown editor view for the
 * current flow's speeches.
 *
 * @param props - Component props.
 * @param props.currentFlow - The active flow; renders an empty state when null.
 * @param props.splitMode - When true, renders two side-by-side markdown editors.
 * @param props.leftSpeech - Speech name for the left editor panel (split mode only).
 * @param props.rightSpeech - Speech name for the right editor panel (split mode only).
 * @param props.splitWidth - Percentage width of the left panel (defaults to 50).
 * @param props.leftContent - Initial markdown content for the left editor.
 * @param props.rightContent - Initial markdown content for the right editor.
 * @param props.onUpdateLeftSpeech - Callback invoked with new content when the left editor changes.
 * @param props.onUpdateRightSpeech - Callback invoked with new content when the right editor changes.
 * @param props.onMouseDown - Callback for the draggable divider `mousedown` event.
 * @returns The appropriate content view for the current state.
 */
export function FlowMainContent({
  currentFlow,
  splitMode,
  leftSpeech,
  rightSpeech,
  splitWidth = 50,
  leftContent = "",
  rightContent = "",
  onUpdateLeftSpeech,
  onUpdateRightSpeech,
  onMouseDown,
  isMobile = false,
  singlePaneMode = false,
  activeSplitSide = "left",
  onActiveSplitSideChange,
}: FlowMainContentProps) {
  // CardMirror (the debate-editor engine behind LexicalEditorWrapper)
  // is a page-level singleton — only one instance can be the live, editable
  // ProseMirror view at a time. Split mode still shows both panes, but only
  // the active side gets the real editor; the other renders a read-only
  // preview and clicking it swaps which side is live.
  if (!currentFlow) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-muted-foreground">No flow selected</p>
      </div>
    )
  }

  if (splitMode && leftSpeech && rightSpeech) {
    // Mobile always collapses to one active speech; desktop can also opt into
    // single-pane via the layout toggle button in the sidebar.
    if (isMobile || singlePaneMode) {
      return (
        <div className="flex flex-col h-full bg-[var(--background)] rounded-[var(--border-radius)]">
          <div className="flex-1 min-h-0 overflow-hidden">
            <LexicalEditorWrapper
              key={`single-${leftSpeech}`}
              content={leftContent}
              contentKey={`single-${leftSpeech}`}
              onChange={onUpdateLeftSpeech || (() => {})}
              title={leftSpeech}
              onTitleChange={() => {}}
              showAiTools
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
          <div className="flex-1 min-h-0 overflow-hidden">
            <LexicalEditorWrapper
              key={`left-${leftSpeech}`}
              content={leftContent}
              contentKey={`left-${leftSpeech}`}
              onChange={onUpdateLeftSpeech || (() => {})}
              title={leftSpeech}
              onTitleChange={() => {}}
              showAiTools
              live={activeSplitSide === "left"}
              onActivate={() => onActiveSplitSideChange?.("left")}
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
          <div className="flex-1 min-h-0 overflow-hidden">
            <LexicalEditorWrapper
              key={`right-${rightSpeech}`}
              content={rightContent}
              contentKey={`right-${rightSpeech}`}
              onChange={onUpdateRightSpeech || (() => {})}
              title={rightSpeech}
              onTitleChange={() => {}}
              showAiTools
              live={activeSplitSide === "right"}
              onActivate={() => onActiveSplitSideChange?.("right")}
            />
          </div>
        </div>
      </div>
    )
  }

  // This flow has no speeches to show side-by-side (e.g. zero columns).
  return (
    <div className="flex items-center justify-center h-full w-full">
      <p className="text-muted-foreground">No speech selected</p>
    </div>
  )
}
