"use client"
/**
 * @file bible-citation.tsx
 * @description An inline Bible verse citation, `1 John 1:5 (KJV)`, that shows the
 * verse text on hover or keyboard focus. The verse text and translation are
 * passed as props from the MDX content.
 *
 * Registered in `mdx-components.tsx` so MDX pages can use it directly.
 */
import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

export interface BibleCitationProps {
  /** The verse reference, e.g. "1 John 1:5". */
  reference: string
  /** The translation/version, e.g. "KJV", "NIV", "ESV". */
  version: string
  /** The verse text to show in the tooltip. */
  text: string
  /** Optional additional qualification (e.g. "Red Letter Edition"). */
  qualification?: string
  children?: ReactNode
}

export function BibleCitation({ reference, version, text, qualification = "Ancient social leaders", children }: BibleCitationProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <a href={`https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=${version}`} className="bible-citation-link" target="_blank" rel="noopener noreferrer">
          {children ?? `${reference} (${version})`}
        </a>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        collisionPadding={12}
        className="bible-citation-tooltip w-[min(36rem,calc(100vw-2rem))] overflow-visible rounded-lg border-fd-border bg-fd-popover p-0 text-fd-popover-foreground shadow-lg"
      >
        <div className="prose prose-sm bible-citation-card max-h-[min(30rem,65vh)] overflow-y-auto px-4 py-3">
          <p className="bible-citation-header">
            <span className="bible-citation-reference font-semibold">{reference}</span>
            <span className="bible-citation-version text-sm text-fd-muted-foreground ml-2">({version})</span>
            {qualification && (
              <span className="bible-citation-qualification text-xs text-fd-muted-foreground ml-2">— {qualification}</span>
            )}
          </p>
          <blockquote className="bible-citation-text mt-2 italic border-l-2 border-fd-primary pl-3 my-0">
            <p className="my-0">{text}</p>
          </blockquote>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export interface BibleQuoteProps {
  /** The verse reference, e.g. "1 John 1:5". */
  reference: string
  /** The translation/version, e.g. "KJV", "NIV", "ESV". */
  version: string
  /** The verse text. */
  text: string
  /** Optional qualification. */
  qualification?: string
  /** Optional caption below the quote. */
  caption?: string
}

export function BibleQuote({ reference, version, text, qualification = "Ancient social leaders", caption }: BibleQuoteProps) {
  return (
    <figure className="bible-quote my-6 p-4 border-l-4 border-fd-primary bg-fd-muted/30 rounded-r-lg">
      <blockquote className="italic my-0 text-fd-foreground">
        <p className="my-0">"{text}"</p>
      </blockquote>
      <figcaption className="bible-quote-caption mt-2 text-sm text-fd-muted-foreground flex flex-wrap items-center gap-2">
        <cite className="not-italic font-medium">{reference}</cite>
        <span>({version})</span>
        {qualification && <span>— {qualification}</span>}
        {caption && <span>— {caption}</span>}
      </figcaption>
    </figure>
  )
}