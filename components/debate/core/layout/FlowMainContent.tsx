/**
 * @fileoverview Main content area for flow page
 * @module components/debate/core/layout/FlowMainContent
 */

import type React from "react"
import { FlowSpreadsheet } from "../../flow/editor/FlowSpreadsheet"
import { MarkdownEditor } from "../../../markdown/markdown-editor"

interface FlowMainContentProps {
  /** Current active flow */
  currentFlow: Flow | null
  /** Whether split mode is active */
  splitMode: boolean
  /** AG Grid API ref */
  gridApiRef: React.RefObject<any>
  /** Split mode: left speech name */
  leftSpeech?: string
  /** Split mode: right speech name */
  rightSpeech?: string
  /** Split mode: left view mode */
  leftViewMode?: ViewMode
  /** Split mode: right view mode */
  rightViewMode?: ViewMode
  /** Split mode: left quote view */
  leftQuoteView?: boolean
  /** Split mode: right quote view */
  rightQuoteView?: boolean
  /** Split mode: width percentage */
  splitWidth?: number
  /** Split mode: left content */
  leftContent?: string
  /** Split mode: right content */
  rightContent?: string
  /** Handler to open speech panel */
  onOpenSpeechPanel?: (speech: string) => void
  /** Handler to update left speech */
  onUpdateLeftSpeech?: (content: string) => void
  /** Handler to update right speech */
  onUpdateRightSpeech?: (content: string) => void
  /** Handler for mouse down on divider */
  onMouseDown?: (e: React.MouseEvent) => void
  /** Handler to update flow */
  onUpdate?: (updates: Partial<Flow>) => void
}

/**
 * Main content area - spreadsheet or split markdown editors
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
  splitWidth = 50,
  leftContent = "",
  rightContent = "",
  onOpenSpeechPanel,
  onUpdateLeftSpeech,
  onUpdateRightSpeech,
  onMouseDown,
  onUpdate,
}: FlowMainContentProps) {
  if (!currentFlow) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-muted-foreground">No flow selected</p>
      </div>
    )
  }

  if (splitMode && leftSpeech && rightSpeech) {
    return (
      <div className="flex h-full split-container relative">
        {/* Left panel */}
        <div
          className="flex flex-col border-r border-border bg-[var(--background)] rounded-l-[var(--border-radius)]"
          style={{ width: `${splitWidth}%` }}
        >
          <div className="p-2 border-b border-border bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2
                className={`text-sm font-semibold ${
                  leftSpeech.includes("A")
                    ? "text-blue-600 dark:text-blue-400"
                    : leftSpeech.includes("N")
                      ? "text-red-600 dark:text-red-400"
                      : ""
                }`}
              >
                {leftSpeech}
              </h2>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor
              key={`left-${leftSpeech}`}
              content={leftContent}
              onChange={onUpdateLeftSpeech || ((_content: string) => {})}
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
          <div className="p-2 border-b border-border bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2
                className={`text-sm font-semibold ${
                  rightSpeech.includes("A")
                    ? "text-blue-600 dark:text-blue-400"
                    : rightSpeech.includes("N")
                      ? "text-red-600 dark:text-red-400"
                      : ""
                }`}
              >
                {rightSpeech}
              </h2>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor
              key={`right-${rightSpeech}`}
              content={rightContent}
              onChange={onUpdateRightSpeech || ((_content: string) => {})}
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

  // Spreadsheet view
  return (
    <div className="w-full h-full bg-[var(--background)] rounded-[var(--border-radius)] box-border overflow-hidden">
      <FlowSpreadsheet
        flow={currentFlow}
        onUpdate={onUpdate || ((_updates: Partial<Flow>) => {})}
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
