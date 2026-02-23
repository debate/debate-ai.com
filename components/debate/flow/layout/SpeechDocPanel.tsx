/**
 * @fileoverview Speech document editor panel
 * @module components/debate/flow/layout/SpeechDocPanel
 */
import { X, Quote, Eye, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MarkdownEditor } from "@/components/markdown/markdown-editor"

interface SpeechDocPanelProps {
  /** Selected speech name */
  selectedSpeech: string
  /** View mode for rendering */
  viewMode: ViewMode
  /** Whether quote view is active */
  quoteView: boolean
  /** Speech content */
  content: string
  /** Current flow */
  currentFlow: Flow | null
  /** Handler to close panel */
  onClose: () => void
  /** Handler to update content */
  onUpdateContent: (content: string) => void
  /** Handler to change view mode */
  onViewModeChange: (mode: ViewMode) => void
  /** Handler to toggle quote view */
  onQuoteViewToggle: () => void
  /** Handler to share speech */
  onShareSpeech: () => void
}

/**
 * Speech document editor panel with controls
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
      {/* Header with controls */}
      <div className="border-b border-border">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-2 px-3 py-2">
          <h2
            className={`shrink-0 text-base font-semibold ${selectedSpeech.includes("A")
              ? "text-blue-600 dark:text-blue-400"
              : selectedSpeech.includes("N")
                ? "text-red-600 dark:text-red-400"
                : ""
              }`}
          >
            {selectedSpeech}
          </h2>

            <div className="ml-1 flex items-center -space-x-px">
              {/* Quote view toggle */}
              <Button
                variant={quoteView ? "default" : "outline"}
                size="sm"
                onClick={onQuoteViewToggle}
                className="h-7 rounded-r-none px-2 gap-1"
              >
                <Quote className="h-3 w-3" />
                <span className="text-xs">Quotes</span>
              </Button>

              {/* View mode selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7 rounded-none">
                    <Eye className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onViewModeChange("read")}>
                    <span className={viewMode === "read" ? "font-semibold" : ""}>Read</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("highlighted")}>
                    <span className={viewMode === "highlighted" ? "font-semibold" : ""}>Embiggen Highlighted</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("h1-only")} className="pl-6">
                    <span className={viewMode === "h1-only" ? "font-semibold" : ""}>Expand to H1</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("h2-only")} className="pl-6">
                    <span className={viewMode === "h2-only" ? "font-semibold" : ""}>Expand to H2</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("h3-only")} className="pl-6">
                    <span className={viewMode === "h3-only" ? "font-semibold" : ""}>Expand to H3</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("underlined")}>
                    <span className={viewMode === "underlined" ? "font-semibold" : ""}>Embiggen Underlined</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("headings")}>
                    <span className={viewMode === "headings" ? "font-semibold" : ""}>Headings Only</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewModeChange("summaries-only")}>
                    <span className={viewMode === "summaries-only" ? "font-semibold" : ""}>Summaries Only</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Share button */}
              <Button
                variant={isShared ? "default" : "outline"}
                size="sm"
                onClick={onShareSpeech}
                className="h-7 rounded-none gap-1 px-2"
                title={isShared ? "Click to unshare and make private" : "Share speech with round participants"}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="text-xs">{isShared ? "Shared" : "Private"}</span>
              </Button>

              {/* Close button */}
              <Button variant="outline" size="icon" onClick={onClose} className="h-7 w-7 rounded-l-none">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
