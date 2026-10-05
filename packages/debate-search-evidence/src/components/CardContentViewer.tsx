/**
 * @fileoverview Full content viewer for research evidence cards.
 * Supports view modes (read, highlight, underline) and year-based color coding.
 */

"use client"


import { useState } from "react"
import { Card, CardContent } from "../ui/primitives/card"
import { Button } from "../ui/primitives/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../ui/primitives/dropdown-menu"
import { Eye, Check, ExternalLink, FileText } from "lucide-react"
import { SourceArticlePanel } from "./SourceArticlePanel"
import { citationDetail, extractAuthor, extractYear, stripDuplicateHeader } from "../lib/card-content"
import { findCardSourceUrl } from "../lib/card-source-url"

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
 * Get a Tailwind color shade class based on a year string.
 * Newer years receive more prominent yellow shades.
 *
 * @param year - Two-digit year string (e.g. "24" for 2024)
 * @returns Tailwind background and text color class string
 */
const getYearShade = (year: string) => {
  const yearNum = Number.parseInt(year)
  if (!Number.isFinite(yearNum)) return "bg-yellow-50 text-yellow-500"
  if (yearNum >= 24) return "bg-yellow-500 text-yellow-950"
  if (yearNum >= 23) return "bg-yellow-400 text-yellow-900"
  if (yearNum >= 22) return "bg-yellow-300 text-yellow-800"
  if (yearNum >= 21) return "bg-yellow-200 text-yellow-700"
  if (yearNum >= 20) return "bg-yellow-100 text-yellow-600"
  return "bg-yellow-50 text-yellow-500"
}

/**
 * Props for the CardContentViewer component
 */
interface CardContentViewerProps {
  /** Currently selected research result to display, or null for empty state */
  selectedResult: SearchResult | null
  /** Current view mode controlling how card content is rendered */
  viewMode: "read" | "highlight" | "underline"
  /** Callback to change the active view mode */
  setViewMode: (mode: "read" | "highlight" | "underline") => void
  /** Word count of the selected card for display */
  wordCount: number
  /**
   * Offer "Open page" / "Full article" beside the card. The mobile card view
   * turns this off because it carries the full page as a tab of its own.
   */
  showSourceControls?: boolean
}

/**
 * CardContentViewer - Display full evidence card content
 *
 * Shows the complete content of a selected research card with
 * citation information, view mode controls, and formatted content.
 * Renders a short prompt when no card is selected.
 *
 * The stored card markup opens with its own tag heading and citation line, so
 * the header here and the body below it were showing the same two lines twice
 * — the second time in bold, as the card's own heading. The header is treated
 * as the one place those belong: {@link citationDetail} drops a full citation
 * that only repeats the author line, and {@link stripDuplicateHeader} removes
 * the opening blocks of the body that the header already says.
 *
 * When the card names a source web page ({@link findCardSourceUrl}), the header
 * offers to open it in a new tab or to pull its full text through qwksearch
 * into a {@link SourceArticlePanel} beside the card — side by side when the
 * panel is wide enough, stacked below the card when it is not. The article
 * stays open only while the selected card names the same URL, so moving to a
 * card from a different source closes it rather than fetching on every click.
 *
 * @param props - Component props
 * @param props.selectedResult - Currently selected research result, or null for empty state
 * @param props.viewMode - Current view mode controlling how card content is rendered
 * @param props.setViewMode - Callback to change the active view mode
 * @param props.wordCount - Word count of the selected card for display
 * @returns The card content viewer component
 *
 * @example
 * ```tsx
 * <CardContentViewer
 *   selectedResult={selectedCard}
 *   viewMode="read"
 *   setViewMode={setViewMode}
 *   wordCount={450}
 * />
 * ```
 */
export function CardContentViewer({
  selectedResult,
  viewMode,
  setViewMode,
  wordCount,
  showSourceControls = true,
}: CardContentViewerProps) {
  /** The source URL whose article is open beside the card, if any. */
  const [articleUrl, setArticleUrl] = useState<string | null>(null)

  // Nothing selected: a one-line prompt. The product intro that used to fill
  // this space now lives on the features page.
  if (!selectedResult) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a card to read it here.
      </div>
    )
  }

  // Extract author and year from citation
  const author = extractAuthor(selectedResult.cite_short)
  const year = extractYear(selectedResult.year, selectedResult.cite_short)
  const authorLine = [author, year].filter(Boolean).join(" ")
  const cite = citationDetail(selectedResult.cite, authorLine)
  const html = stripDuplicateHeader(selectedResult.html, [selectedResult.tag, authorLine, cite])
  const sourceUrl = showSourceControls ? findCardSourceUrl(selectedResult) : null
  const showArticle = sourceUrl !== null && articleUrl === sourceUrl

  return (
    // `size-full`, not `h-full`: the card column below is the element that
    // fills and scrolls (see test/search-layout-scrolling.test.tsx).
    <div
      className={`@container size-full overflow-hidden ${showArticle ? "grid grid-rows-2 @3xl:grid-cols-2 @3xl:grid-rows-1" : ""}`}
    >
      <div className="h-full min-h-0 overflow-y-auto p-4 max-w-full overflow-x-hidden">
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Header with tag and view mode selector */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedResult.tag}</h3>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setViewMode("read")}>
                    {viewMode === "read" && <Check className="h-4 w-4 mr-2" />}
                    {viewMode !== "read" && <span className="w-4 mr-2" />}
                    Read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("highlight")}>
                    {viewMode === "highlight" && <Check className="h-4 w-4 mr-2" />}
                    {viewMode !== "highlight" && <span className="w-4 mr-2" />}
                    Embiggen Highlighted
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setViewMode("underline")}>
                    {viewMode === "underline" && <Check className="h-4 w-4 mr-2" />}
                    {viewMode !== "underline" && <span className="w-4 mr-2" />}
                    Embiggen Underlined
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Citation info */}
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold">{author}</span>
                {year && (
                  <>
                    {" "}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getYearShade(year)}`}
                    >
                      {year}
                    </span>
                  </>
                )}
              </p>
              {cite && <p className="text-sm text-muted-foreground">{cite}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="mr-auto">{wordCount} words</span>
                {sourceUrl && (
                  <>
                    <Button variant="outline" size="sm" asChild title={sourceUrl}>
                      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open page
                      </a>
                    </Button>
                    <Button
                      variant={showArticle ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={showArticle}
                      title="Extract the full article and citation with qwksearch and show it beside this card"
                      onClick={() => setArticleUrl(showArticle ? null : sourceUrl)}
                    >
                      <FileText className="h-4 w-4" />
                      Full article
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Card content with view mode styling */}
            <div
              className={`prose prose-sm dark:prose-invert max-w-none editor ${viewMode === "read" ? "show-all" : viewMode === "highlight" ? "highlighted" : "underlined"
                }`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </CardContent>
        </Card>
      </div>
      {showArticle && (
        <div className="min-h-0 overflow-hidden border-t @3xl:border-t-0 @3xl:border-l">
          <SourceArticlePanel url={sourceUrl} onClose={() => setArticleUrl(null)} />
        </div>
      )}
    </div>
  )
}
