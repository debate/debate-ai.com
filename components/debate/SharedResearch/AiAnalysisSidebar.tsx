"use client"

/**
 * @fileoverview AI Analysis Sidebar Component
 *
 * Provides AI-powered analysis tools for research evidence cards.
 * Features:
 * - Custom prompt input for AI analysis
 * - Copy to clipboard functionality
 * - Open in external LLM platforms (Perplexity, ChatGPT, Claude, etc.)
 * - Display of AI-generated analysis results
 *
 * @module components/debate/research/AiAnalysisSidebar
 */

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Clipboard, ExternalLink, X } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"

/**
 * Type definition for search result data
 */
type SearchResult = {
  /** Unique identifier */
  id: number
  /** Evidence category */
  category: string
  /** Research field/topic */
  researchField: string
  /** Argument block name */
  argBlock: string
  /** Short summary of the evidence */
  summary: string
  /** Short citation (author year) */
  cite_short: string
  /** Full citation */
  cite: string
  /** Number of times this card has been read */
  readCount: number
  /** Length of highlighted text in characters */
  highlightLength: number
  /** Total text length */
  textLength: number
  /** Word count */
  word_count: number
  /** HTML content of the card */
  html: string
  /** Tag line */
  tag: string
  /** Publication year */
  year: string
  /** Page reference */
  page: string
}

/**
 * Props for the AiAnalysisSidebar component
 */
interface AiAnalysisSidebarProps {
  /** Currently selected research result to analyze */
  selectedResult: SearchResult | null
  /** Custom prompt text for AI analysis */
  customPrompt: string
  /** Callback to update the custom prompt text */
  setCustomPrompt: (prompt: string) => void
  /** AI-generated analysis result text */
  aiResult: string
  /** Whether the AI is currently generating a response */
  generating: boolean
  /** Callback to trigger AI analysis generation */
  handleGenerate: () => void
  /** Callback to copy the card content to clipboard */
  handleCopy: () => void
  /** Optional callback to close the sidebar on mobile */
  onClose?: () => void
  /** Optional callback to collapse the sidebar on desktop */
  onCollapse?: () => void
}

/**
 * AiAnalysisSidebar - AI analysis tools for research evidence
 *
 * Provides a sidebar with AI analysis capabilities for selected
 * research cards. Includes custom prompts, external LLM integration,
 * and result display.
 *
 * @param props - Component props
 * @param props.selectedResult - Currently selected research result to analyze
 * @param props.customPrompt - Custom prompt text for AI analysis
 * @param props.setCustomPrompt - Callback to update the custom prompt text
 * @param props.aiResult - AI-generated analysis result text
 * @param props.generating - Whether the AI is currently generating a response
 * @param props.handleGenerate - Callback to trigger AI analysis generation
 * @param props.handleCopy - Callback to copy the card content to clipboard
 * @param props.onClose - Optional callback to close the sidebar on mobile
 * @param props.onCollapse - Optional callback to collapse the sidebar on desktop
 * @returns The AI analysis sidebar component
 *
 * @example
 * ```tsx
 * <AiAnalysisSidebar
 *   selectedResult={selectedCard}
 *   customPrompt={prompt}
 *   setCustomPrompt={setPrompt}
 *   aiResult={analysisResult}
 *   generating={isGenerating}
 *   handleGenerate={runAnalysis}
 *   handleCopy={copyToClipboard}
 * />
 * ```
 */
export function AiAnalysisSidebar({
  selectedResult,
  customPrompt,
  setCustomPrompt,
  aiResult,
  generating,
  handleGenerate,
  handleCopy,
  onClose,
  onCollapse,
}: AiAnalysisSidebarProps) {
  /**
   * Open card content in an external LLM platform.
   * Copies the full prompt + evidence to clipboard and opens the platform URL.
   *
   * @param platform - Platform identifier key (e.g. "perplexity", "chatgpt", "claude")
   */
  const handleOpenInLLM = (platform: string) => {
    if (!selectedResult) return

    // Extract plain text from HTML content
    const htmlContent = selectedResult.html || ""
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = htmlContent
    const textContent = tempDiv.textContent || tempDiv.innerText || ""

    // Build full content with prompt and evidence
    const fullContent = `${customPrompt}\n\n${selectedResult.tag}\n${selectedResult.cite}\n${selectedResult.summary}\n\n${textContent}`

    // Copy to clipboard
    navigator.clipboard.writeText(fullContent)

    // Platform URLs
    const urls: Record<string, string> = {
      perplexity: "https://www.perplexity.ai/?q=",
      chatgpt: "https://chat.openai.com/?q=",
      claude: "https://claude.ai/new?q=",
      gemini: "https://gemini.google.com/?q=",
      qwksearch: "https://qwksearch.com/?q=",
    }

    const url = urls[platform]
    if (url) {
      window.open(`${url}${encodeURIComponent(fullContent)}`, "_blank")
    }
  }

  return (
    <div className="h-full flex flex-col p-4 space-y-4 bg-background">
      {/* Header with close button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">AI Analysis</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onClose) onClose()
            if (onCollapse) onCollapse()
          }}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Custom prompt textarea */}
      <Textarea
        placeholder="Enter custom prompt..."
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        className="flex-1 min-h-[100px] max-h-[200px] overflow-y-auto text-sm"
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Copy button */}
        <Button
          onClick={handleCopy}
          variant="outline"
          size="sm"
          className="flex-1 bg-transparent"
          disabled={!selectedResult}
        >
          <Clipboard className="h-4 w-4 mr-2" />
          Copy
        </Button>

        {/* Open in LLM dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1 bg-transparent" disabled={!selectedResult}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in LLM
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenInLLM("perplexity")}>Perplexity</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenInLLM("chatgpt")}>ChatGPT</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenInLLM("claude")}>Claude</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenInLLM("gemini")}>Gemini</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenInLLM("qwksearch")}>qwksearch.com</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Generate button */}
      <Button onClick={handleGenerate} disabled={!selectedResult || generating} className="w-full">
        {generating ? "Analyzing..." : "AI Generate"}
      </Button>

      {/* AI result display */}
      {aiResult && (
        <div className="flex-1 overflow-y-auto">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-xs">{aiResult}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
