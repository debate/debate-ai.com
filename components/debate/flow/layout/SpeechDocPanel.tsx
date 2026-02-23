/**
 * @fileoverview Speech document editor panel
 * @module components/debate/flow/layout/SpeechDocPanel
 */
import { X, Quote, Eye, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MarkdownEditor } from "@/components/markdown/markdown-editor"

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
 *
 * @param props - Component props.
 * @param props.selectedSpeech - Speech name shown in the panel header and passed to the editor as `fileName`.
 * @param props.viewMode - The editor view mode; overridden by `"quotes"` when `quoteView` is true.
 * @param props.quoteView - When true, forces the editor into `"quotes"` view mode regardless of `viewMode`.
 * @param props.content - Markdown string rendered and edited by the embedded markdown editor.
 * @param props.currentFlow - Used to look up `sharedSpeeches` and determine the share button state.
 * @param props.onClose - Callback invoked when the X button in the header is clicked.
 * @param props.onUpdateContent - Callback invoked with the new markdown string on every editor change.
 * @param props.onViewModeChange - Callback invoked with the selected {@link ViewMode} from the dropdown.
 * @param props.onQuoteViewToggle - Callback invoked when the Quotes toggle button is clicked.
 * @param props.onShareSpeech - Callback invoked when the Private/Shared button is clicked.
 * @returns A flex column panel with a sticky header toolbar and a scrollable markdown editor.
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
