"use client"
/**
 * @file citation-card.tsx
 * @description An in-text citation, `Shanahan (1993)`, that links to its entry
 * on the References page and, on hover or keyboard focus, shows that entry in
 * a tooltip: its number in the list, the bibliography line, the author's
 * qualifications and the full card text with its underlining and highlights.
 *
 * Rendered by `lib/mdx/rehype-citation-cards.ts`, which matches the citations
 * at build time and passes the entry's HTML in from the References page —
 * repo-authored content, not user input. Registered in `mdx-components.tsx`.
 */
import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { SYNERGY_SLAYER_CLASS } from "../../lib/mdx/remark-debate-highlight"

export interface CitationCardProps {
  /** The References page anchor, e.g. `/docs/…/references#ref-shanahan-1993`. */
  href: string
  /** The entry's number in the References list. */
  number: string
  /** The bibliography line, as HTML. */
  citation: string
  /** Qualification and card text, as HTML; empty when the entry has no card. */
  card?: string
  children?: ReactNode
}

export function CitationCard({ href, number, citation, card, children }: CitationCardProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <a href={href} className="citation-link">
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        collisionPadding={12}
        className="citation-tooltip w-[min(32rem,calc(100vw-2rem))] overflow-visible rounded-lg border-fd-border bg-fd-popover p-0 text-fd-popover-foreground shadow-lg"
      >
        {/* The card markup is styled by `.prose .debate-card`; the Synergy
            Slayer class lets the Underlining toggle reach into the tooltip,
            which renders in a portal outside the page body. */}
        <div
          className={`prose prose-sm ${SYNERGY_SLAYER_CLASS} citation-card max-h-[min(28rem,60vh)] overflow-y-auto px-4 py-3`}
        >
          <p className="citation-card-source">
            <span className="citation-card-number">{number}</span>
            <span dangerouslySetInnerHTML={{ __html: citation }} />
          </p>
          {card ? (
            <div dangerouslySetInnerHTML={{ __html: card }} />
          ) : (
            <p className="citation-card-empty">No card text for this source yet.</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
