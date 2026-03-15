/**
 * @fileoverview Speech document editor panel
 * @module components/debate/flow/layout/SpeechDocPanel
 */
import { X, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownEditor } from "@/components/markdown/markdown-editor"
import type { Flow } from "@/components/debate/DebateRound/types"
import type { ViewMode } from "@/lib/types/debate-flow"
import { SpeechHeaderBar } from "./SpeechHeaderBar"

/** Props for the SpeechDocPanel component. */
interface SpeechDocPanelProps {
  /** Name of the currently selected speech (e.g. "1A", "2N"). */
  selectedSpeech: string
  /** Active view mode applied to the markdown editor. */
  viewMode: ViewMode
  /** Whether the quote view overlay is currently active. */
  quoteView: boolean
  /** Current markdown content of the speech document. */
  content: string
  /** The flow that owns this speech, used to determine shared status. */
  currentFlow: Flow | null
  /** Handler called when the panel close button is clicked. */
  onClose: () => void
  /** Handler called when the editor content changes. */
  onUpdateContent: (content: string) => void
  /** Handler called when the user selects a different view mode. */
  onViewModeChange: (mode: ViewMode) => void
  /** Handler called when the quote view toggle button is clicked. */
  onQuoteViewToggle: () => void
  /** Handler called when the share/unshare button is clicked. */
  onShareSpeech: () => void
}

/**
 * Full-height panel for editing a speech document with view controls and share functionality.
 */
export function SpeechDocPanel({
  selectedSpeech,
  viewMode,
  quoteView,
  content,
  currentFlow,
  onClose,
  onUpdateContent,
  onViewModeChange,
  onQuoteViewToggle,
  onShareSpeech,
}: SpeechDocPanelProps) {
  const isShared = currentFlow?.sharedSpeeches?.[selectedSpeech] || false

  return (
    <div className="bg-[var(--background)] h-full rounded-[var(--border-radius)] flex flex-col">
      {/* Header — reuses the same SpeechHeaderBar as side-by-side view */}
      <div className="border-b border-border flex items-center">
        <div className="flex-1 min-w-0">
          <SpeechHeaderBar
            speechName={selectedSpeech}
            viewMode={viewMode}
            quoteView={quoteView}
            onViewModeChange={onViewModeChange}
            onQuoteViewToggle={onQuoteViewToggle}
          />
        </div>
        {/* Panel-specific controls: share + close */}
        <div className="flex items-center gap-1 pr-2 shrink-0">
          <Button
            variant={isShared ? "default" : "outline"}
            size="sm"
            onClick={onShareSpeech}
            className="h-6 gap-1 px-2"
            title={isShared ? "Click to unshare and make private" : "Share speech with round participants"}
          >
            <UserPlus className="h-3 w-3" />
            <span className="text-xs">{isShared ? "Shared" : "Private"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Markdown editor */}
      <div className="flex-1 overflow-auto">
        <MarkdownEditor
          content={content}
          onChange={onUpdateContent}
          fileName={selectedSpeech}
          className="h-full"
          showToolbar={true}
          viewMode={quoteView ? "quotes" : viewMode}
        />
      </div>
    </div>
  )
}
