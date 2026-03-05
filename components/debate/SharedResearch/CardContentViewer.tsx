/**
 * @fileoverview Full content viewer for research evidence cards.
 * Supports view modes (read, highlight, underline) and year-based color coding.
 */

"use client"


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
      <div className="h-full overflow-y-auto p-4 bg-background max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-2">
          <img
            width="128"
            src="/images/logo-collective-mind.png"
            alt="Building Blocks Icon"
          />
          <div className="flex flex-col items-end">
            <h2 className="text-xl font-bold text-right">CARDS: Crowdsourced Annotated Research for Debates Search</h2>
            <a
              className="mt-2 px-6 py-3 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              target="_blank"
              href="https://chromewebstore.google.com/detail/debate-timer-chrome-mobil/noecbaibfhbmpapofcdkgchfifmoinfj"
              rel="noopener noreferrer"
            >
              <img
                src="/images/download-extension.png"
                alt="Install Chrome Extension"
                className="h-14"
              />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg border-b pb-2 mb-4">Overview</h3>
              <p className="text-lg leading-relaxed mb-4">
                Critical times call for critical thinkers to create a crowdsourced annotated research dataset, for AI models
                to recommend research quotes, to evolve crowdsourced chain-of-thought reasoning, unlock faster ways to read
                long articles, to monitor developments in a knowledge graph by topic modeling, and to provide a public service
                of answers to research.
                Debate should be a war of warrants where victories are vectorized as weights — weights
                which lead to the emergence of Collective Consciousness.

              </p>
              <p className="text-lg leading-relaxed">



              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md bg-muted/30">
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Features & Capabilities</h3>
              <ul className="space-y-3 text-sm list-disc pl-4 marker:text-blue-500">
                <li>Search within summaries, cites, highlighted and full text over millions of research quotes.</li>
                <li>Scout what evidence selected teams and schools frequently read.</li>
                <li>Sort by Speeches Read In Count (statistics from over a decade in all styles).</li>
                <li>
                  Use Characters Highlighted to match speech times (~1500 char/min) and to read aloud summaries while audience
                  reads highlighted on-screen.
                </li>
                <li>Collaborate on topic outlines, share evidence, and download Topic Starter outlines.</li>
                <li>Use arrow keys to navigate between results.</li>
              </ul>

              <div className="pt-4 mt-auto">
                <a
                  href="https://arxiv.org/html/2406.14657v3"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Read the Academic Paper &rarr;
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <p className="text-base text-muted-foreground leading-relaxed">
              The Debate Singularity is here: AI now researches topics in depth, highlights key quotes, outlines both sides of arguments, coaches debate preparation, surfaces relevant quotes, exposes flaws in evidence cards, and crafts strategic closing speeches that compare competing cards.

              <br />
              We must integrate AI into debate to unlock the next stage of emergent compexity for socio-political governance.

              Using Language Models can distill the essence of collective thought into a vector space where every point has
              a weighted value representing its contribution to the overall decision-making process. AI collective
              consciousness will be able to synthesize complex arguments and evaluate them according to their validity and
              relevance no matter who proposed them, leading to direct democratic AI-based economy where public votes reward
              influence and AI global governance. AI agents will learn what arguments and sources are more persuasive in
              different contexts and to different profiles of readers. Crowdsourced automation with AI agents create topic
              argument outlines, similar to what Github does for reusable code, which AI can learn to weigh complex
              decisions. Github shows people go deeper if they can reuse well-established arguments. Card video games show
              cards can have scores, likes, and answer others.

              AI will show its reasoning based on what
              sentences and cites it used from the collective evidence, so that people can see it is aligned with our
              interests via sentence-by-sentence interpretability. People can have many practice rounds via AI to simulate
              a tree of possible outcomes and responses, so that we can surface the most persuasive arguments to all.


            </p>
            <p className="text-base text-muted-foreground leading-relaxed">

              Key metadata is extracted for LLM analysis, enabling LLMs to review the full text, identify logic flaws or unsupported claims, and flag overstatements. LLMs also extend warrants, summarize support, and suggest where each card fits within the Topic Research Unified Tree Hierarchy (TRUTH). The system is built for intersubjective, consensus-driven research claim to find ground truth on issues and evaluate any claim's proximity to accepted truths and human values. This can reduce LLM hallucination and steer alignment with common social values as AI gains capacity to replace human leaders of organizations.


            </p>
          </CardContent>
        </Card>
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
            className={`prose prose-sm dark:prose-invert max-w-none editor ${viewMode === "read" ? "show-all" : viewMode === "highlight" ? "highlighted" : "underlined"
              }`}
            dangerouslySetInnerHTML={{ __html: selectedResult.html }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
