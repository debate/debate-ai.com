/**
 * @fileoverview Dictionary view branch for the lectures page.
 * Renders the sticky header with a back button and inline search, then
 * delegates term rendering to {@link DictionaryPanel}.
 * @module components/debate/DebateVideos/panels/dictionary/LecturesDictionaryView
 */

"use client"

import Link from "next/link"
import { ArrowLeft, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Footer } from "@/components/debate/DebateCardSearch/Footer"
import { StickyHeader } from "../../components/layout/StickyHeader"
import { DictionaryPanel } from "./DictionaryPanel"

/** Props for the {@link LecturesDictionaryView} component. */
interface LecturesDictionaryViewProps {
  /** Current dictionary search term. */
  dictSearchTerm: string
  /** Called when the search term changes. */
  onDictSearchTermChange: (v: string) => void
}

/**
 * Renders the full dictionary page layout: sticky header with back button
 * and search input, the {@link DictionaryPanel}, and footer.
 *
 * @param props - See {@link LecturesDictionaryViewProps}.
 */
export function LecturesDictionaryView({
  dictSearchTerm,
  onDictSearchTermChange,
}: LecturesDictionaryViewProps) {
  const backButton = (
    <Link
      href="/videos"
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm font-medium text-foreground transition-colors"
      aria-label="Back to lectures"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Link>
  )

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 flex flex-col justify-between">
      <div>
        <StickyHeader
          controls={
            <div className="flex items-center gap-2 w-full md:w-auto">
              {backButton}
              <div className="relative flex-1 min-w-0 md:w-[240px] md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search terms..."
                  value={dictSearchTerm}
                  onChange={(e) => onDictSearchTermChange(e.target.value)}
                  className="pl-9 pr-8 h-9"
                />
                {dictSearchTerm && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onDictSearchTermChange("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Clear search</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          }
        />
        <DictionaryPanel
          controlledSearchTerm={dictSearchTerm}
          onControlledSearchChange={onDictSearchTermChange}
        />
      </div>
      <Footer />
    </div>
  )
}
