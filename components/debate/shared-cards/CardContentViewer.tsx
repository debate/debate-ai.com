"use client"

/**
 * @fileoverview Card Content Viewer Component
 *
 * Displays the full content of a selected research evidence card.
 * Features:
 * - View mode switching (read, highlight, underline)
 * - Author and year extraction from citations
 * - Year-based color coding (newer = more prominent)
 * - HTML content rendering with prose styling
 * - Default empty state with product information
 *
 * @module components/debate/research/CardContentViewer
 */

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Eye, Check } from "lucide-react"

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
 * Get a Tailwind color shade class based on a two-digit year string.
 * Newer years receive more prominent yellow shades.
 *
 * @param year - Two-digit year string (e.g. "24" for 2024)
 * @returns Tailwind background and text color class string
 */
const getYearShade = (year: string) => {
  const yearNum = Number.parseInt(year)
  if (yearNum >= 24) return "bg-yellow-500 text-yellow-950"
  if (yearNum >= 23) return "bg-yellow-400 text-yellow-900"
  if (yearNum >= 22) return "bg-yellow-300 text-yellow-800"
  if (yearNum >= 21) return "bg-yellow-200 text-yellow-700"
  if (yearNum >= 20) return "bg-yellow-100 text-yellow-600"
  return "bg-yellow-50 text-yellow-500"
}

/**
 * Extract the author name from a short citation string.
 *
 * @param citeShort - Short citation in "Author Year" format (e.g. "Smith 2023")
 * @returns Author name with the trailing year removed
 */
const extractAuthor = (citeShort: string) => {
  return citeShort.replace(/\s+\d{4}$/, "")
}

/**
 * Extract the four-digit year from a short citation string.
 *
 * @param citeShort - Short citation in "Author Year" format (e.g. "Smith 2023")
 * @returns Four-digit year string, or empty string if not found
 */
const extractYear = (citeShort: string) => {
  const match = citeShort.match(/\d{4}/)
  return match ? match[0] : ""
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
}

/**
 * CardContentViewer - Display full evidence card content
 *
 * Shows the complete content of a selected research card with
 * citation information, view mode controls, and formatted content.
 * Renders a product information page when no card is selected.
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
export function CardContentViewer({ selectedResult, viewMode, setViewMode, wordCount }: CardContentViewerProps) {
  // Show empty state with product info when no card selected
  if (!selectedResult) {
    return (
      <div className="h-full overflow-y-auto p-4 bg-background">
        <div className="flex items-center justify-between mb-6">
          <img
            width="128"
            src="https://alpha.debate-ai.com/_app/immutable/assets/icon-building-blocks.0ev-pf49.svg"
            alt="Building Blocks Icon"
          />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold ml-2">CARDS</h1>
            <h2 className="text-xl font-bold">Crowdsourced Annotated Research Dataset as a Service</h2>
            <a
              className="download-chrome download-btn text-center justify-center mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              target="_blank"
              href="https://chromewebstore.google.com/detail/debate-timer-chrome-mobil/noecbaibfhbmpapofcdkgchfifmoinfj"
              rel="noopener noreferrer"
            >
              Install Chrome Extension
            </a>
          </div>
        </div>

        <p className="text-xl mb-8">
          Critical times call for critical thinkers to create a crowdsourced annotated research dataset, for AI models
          to recommend research quotes, to evolve crowdsourced chain-of-thought reasoning, unlock faster ways to read
          long articles, to monitor developments in a knowledge graph by topic modeling, and to provide a public service
          of answers to research. Debate should be a war of warrants where victories are vectorized as weights — weights
          which lead to the emergence of Collective Consciousness.
        </p>

        <p className="text-xl mb-8">
          Using Language Models can distill the essence of collective thought into a vector space where every point has
          a weighted value representing its contribution to the overall decision-making process. AI collective
          consciousness will be able to synthesize complex arguments and evaluate them according to their validity and
          relevance no matter who proposed them, leading to direct demoractic AI-based economy where public votes reward
          influence and AI global governance. Group represenation centralized in human minds with biases cannot have
          access to all the information. AI agents will learn what arguments and sources are more persuasive in
          different contexts and to different profiles of readers. Crowdsourced automation with AI agents create topic
          argument outlines, similar to what Github does for reusable code, which AI can learn to weigh complex
          decisions. Github shows people go deeper if they can reuse well-established arguments. Card video games show
          cards can have scores, likes, and answer others. AI will first be tested in sim worlds then with real humans,
          so here we can test how AI minds reason with real world hypotesting. AI will show its reasoning based on what
          sentences and cites it used from the collective evidence, so that people can see it is aligned with our
          interests via sentence-by-sentence interpretability. AI is inevitable, so it is necessary to have public
          safety testing to train AI models to unlock faster ways to read a long text, monitor developments in a complex
          literature base, and crowdsource decentralized AI tree-of-thought decisionmaking reasoning.
        </p>

        <a
          href="https://arxiv.org/html/2406.14657v3"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Academic Paper
        </a>

        <br />
        <br />

        <div className="space-y-2 text-base">
          <p>Search within summaries, cites, highlighted and full text over millions of research quotes.</p>
          <p>Scout what evidence selected teams and schools frequently read.</p>
          <p>Sort by Speeches Read In Count (statistics from over a decade in all styles).</p>
          <p>
            Use Characters Highlighted to match speech times ~1500 char/min and to read aloud summaries while audience
            reads highlighted on-screen.
          </p>
          <p>Collaborate on topic outlines, share evidence, and download Topic Starter outlines.</p>
          <p>Use arrow keys to navigate between results.</p>
        </div>
      </div>
    )
  }

  // Extract author and year from citation
  const author = extractAuthor(selectedResult.cite_short)
  const year = extractYear(selectedResult.cite_short)

  return (
    <div className="h-full overflow-y-auto p-4 max-w-full overflow-x-hidden">
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

          {/* Citation and summary info */}
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-semibold">{author}</span>{" "}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getYearShade(selectedResult.year)}`}
              >
                {year}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">{selectedResult.cite}</p>
            <p className="text-sm font-medium">{selectedResult.summary}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{wordCount} words</span>
            </div>
          </div>

          {/* Card content with view mode styling */}
          <div
            className={`prose prose-sm dark:prose-invert max-w-none editor ${
              viewMode === "read" ? "show-all" : viewMode === "highlight" ? "highlighted" : "underlined"
            }`}
            dangerouslySetInnerHTML={{ __html: selectedResult.html }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
