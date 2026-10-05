/**
 * @fileoverview Mobile view of one opened card: a back button to the result
 * list and three tabs — the quote itself, its AI summary, and the full page it
 * was cut from.
 *
 * Below `md` the result list is the default screen. Tapping a card focuses it
 * here instead of opening beside the list the way the desktop layout does, and
 * Back returns to the list with the same results and selection.
 */

"use client"

import { useState } from "react"
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import { CardContentViewer } from "./CardContentViewer"
import { SourceArticlePanel } from "./SourceArticlePanel"
import { findCardSourceUrl } from "../lib/card-source-url"
import type { SearchResult } from "../types"

/** The tabs of an opened card, in display order. */
const TABS = [
  { id: "quote", label: "Quote" },
  { id: "summary", label: "AI summary" },
  { id: "page", label: "Full page" },
] as const

/** Identifier of one of {@link TABS}. */
type TabId = (typeof TABS)[number]["id"]

/** Props for {@link MobileCardView}. */
interface MobileCardViewProps {
  /** The card that was tapped in the list. */
  result: SearchResult
  /** Returns to the result list. */
  onBack: () => void
  /** Card content view mode. */
  viewMode: "read" | "highlight" | "underline"
  /** Setter for the card view mode. */
  setViewMode: (mode: "read" | "highlight" | "underline") => void
  /** AI analysis of this card, or a progress / error message. */
  aiResult: string
  /** Whether the analysis is still being generated. */
  generating: boolean
  /** Re-runs the analysis. */
  handleGenerate: () => void
}

/**
 * Full-screen card view for small screens.
 *
 * The tab strip stays pinned under the header while the active tab scrolls on
 * its own. The full page tab loads the source article only once it is opened,
 * since extracting an article costs a network round trip most card reads never
 * need.
 *
 * @param props - See {@link MobileCardViewProps}.
 */
export function MobileCardView({
  result,
  onBack,
  viewMode,
  setViewMode,
  aiResult,
  generating,
  handleGenerate,
}: MobileCardViewProps) {
  const [tab, setTab] = useState<TabId>("quote")
  const sourceUrl = findCardSourceUrl(result)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background" data-testid="mobile-card-view">
      <div className="flex shrink-0 items-center gap-2 border-b p-2">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to results">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{result.tag}</p>
      </div>

      <div role="tablist" aria-label="Card views" className="flex shrink-0 border-b">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            id={`card-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`card-panel-${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 border-b-2 px-2 py-2 text-sm transition-colors",
              tab === id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`card-panel-${tab}`}
        aria-labelledby={`card-tab-${tab}`}
        className="min-h-0 flex-1 overflow-hidden"
      >
        {tab === "quote" && (
          <CardContentViewer
            selectedResult={result}
            viewMode={viewMode}
            setViewMode={setViewMode}
            wordCount={result.word_count || 0}
            showSourceControls={false}
          />
        )}

        {tab === "summary" && (
          <div className="h-full space-y-3 overflow-y-auto p-4">
            {generating ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Summarizing this card…
              </p>
            ) : null}
            {aiResult ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">{aiResult}</pre>
            ) : !generating ? (
              <p className="text-sm text-muted-foreground">No summary yet.</p>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          </div>
        )}

        {tab === "page" &&
          (sourceUrl ? (
            <SourceArticlePanel key={sourceUrl} url={sourceUrl} onClose={() => setTab("quote")} />
          ) : (
            <div className="space-y-2 p-6 text-center text-sm text-muted-foreground">
              <p>This card does not name a source page to extract.</p>
            </div>
          ))}
      </div>
      {tab === "page" && sourceUrl ? (
        <div className="shrink-0 border-t p-2 text-center">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open original page
          </a>
        </div>
      ) : null}
    </div>
  )
}
