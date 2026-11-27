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
 * The bibliography line follows the reader's citation style, as picked on
 * the References page (`citation-style-switcher.tsx`).
 *
 * A small speaker button beside the author line reads the card aloud
 * (`card-voice.ts`): the cite tag once, `Shanahan 93`, then only the
 * underlined text. Pressing it again stops. The reading lives in this
 * component, not the tooltip, so it keeps going after the tooltip closes.
 *
 * The author line ends with the entry's card-text status icon
 * (`reference-quote-status.tsx`): a red X or ellipsis opens the dialog for
 * suggesting the missing text.
 *
 * The link carries its entry as `data-citation-*` attributes, so reading mode
 * (`reading-mode.tsx`), which shows pages as loaded HTML rather than React,
 * turns those links back into hover cards with `CitationCardsIn`. The tooltip
 * sits at `z-[70]`, above reading mode's `z-[60]` overlay.
 */
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Square, Volume2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { SYNERGY_SLAYER_CLASS } from "../../lib/mdx/remark-debate-highlight"
import { formatCitation } from "../../lib/citation-styles"
import { useCitationStyle } from "./citation-style-switcher"
import { readCardAloud } from "./card-voice"
import { ReferenceQuoteIcon, SuggestTextDialog } from "./reference-quote-status"
import { htmlToText } from "../../lib/mdx/citation-cards"
import { referenceQuoteStatus } from "../../lib/reference-quote-status"
import { splitReferenceHref } from "../../lib/reference-suggestions"

/** The link attributes holding its entry (see the module doc). */
export const CITATION_DATA = {
  number: "data-citation-number",
  citation: "data-citation",
  card: "data-citation-card",
  spoken: "data-citation-spoken",
  authors: "data-citation-authors",
  year: "data-citation-year",
} as const

export interface CitationCardProps {
  /** The References page anchor, e.g. `/docs/…/references#ref-shanahan-1993`. */
  href: string
  /** The entry's number in the References list. */
  number: string
  /** The bibliography line, as HTML. */
  citation: string
  /** Qualification and card text, as HTML; empty when the entry has no card. */
  card?: string
  /** What the read-aloud button says first: last name and two-digit year, `Shanahan 93`. */
  spoken?: string
  /** The authors for the References panel: `Galloway`, `Hansson & Reijven`, `Smith et al.`. */
  authors?: string
  /** The publication year as cited, `2020`. */
  year?: string
  children?: ReactNode
}

export function CitationCard({ href, number, citation, card, spoken, authors, year, children }: CitationCardProps) {
  const style = useCitationStyle()
  const [reading, setReading] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const status = referenceQuoteStatus(card)
  const target = splitReferenceHref(href)
  const plainCitation = htmlToText(citation).replace(/\s+/g, " ").trim()

  // Leaving the page stops the reading.
  useEffect(() => () => controller.current?.abort(), [])

  const toggleVoice = () => {
    if (controller.current) {
      controller.current.abort()
      return
    }
    const ctrl = new AbortController()
    controller.current = ctrl
    setReading(true)
    void readCardAloud(spoken, card, ctrl.signal).finally(() => {
      if (controller.current === ctrl) controller.current = null
      setReading(false)
    })
  }
  return (
    <>
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <a
          href={href}
          className="citation-link"
          // Kept in the page HTML so reading mode, which shows pages as loaded HTML, can rebuild the hover card.
          {...{
            [CITATION_DATA.number]: number,
            [CITATION_DATA.citation]: citation,
            [CITATION_DATA.card]: card ?? "",
            [CITATION_DATA.spoken]: spoken ?? "",
            [CITATION_DATA.authors]: authors ?? "",
            [CITATION_DATA.year]: year ?? "",
          }}
        >
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        collisionPadding={12}
        className="citation-tooltip z-[70] w-[min(32rem,calc(100vw-2rem))] overflow-visible rounded-lg border-fd-border bg-fd-popover p-0 text-fd-popover-foreground shadow-lg"
      >
        {/* The card markup is styled by `.prose .debate-card`; the Synergy
            Slayer class lets the Underlining toggle reach into the tooltip,
            which renders in a portal outside the page body. */}
        <div
          className={`prose prose-sm ${SYNERGY_SLAYER_CLASS} citation-card max-h-[min(28rem,60vh)] overflow-y-auto px-4 py-3`}
        >
          <p className="citation-card-source">
            <span className="citation-card-number">{number}</span>
            <button
              type="button"
              aria-pressed={reading}
              aria-label={!reading ? `Read this card aloud${spoken ? `: ${spoken}` : ""}` : "Stop reading the card"}
              title={!reading ? "Read aloud: the author and year, then the underlined text" : "Stop reading"}
              className="citation-card-voice"
              onClick={toggleVoice}
            >
              {reading ? <Square /> : <Volume2 />}
            </button>
            <span dangerouslySetInnerHTML={{ __html: formatCitation(citation, style) }} />
            <ReferenceQuoteIcon
              status={status}
              title={plainCitation}
              onSuggest={target ? () => setSuggesting(true) : undefined}
            />
          </p>
          {card ? (
            <div dangerouslySetInnerHTML={{ __html: card }} />
          ) : (
            <p className="citation-card-empty">No card text for this source yet.</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
    {/* Owned here, not by the icon: the hover card unmounts as the pointer leaves it for the modal. */}
    {target && (
      <SuggestTextDialog
        open={suggesting}
        onOpenChange={setSuggesting}
        page={target.page}
        refId={target.refId}
        title={plainCitation}
      />
    )}
    </>
  )
}

/** A citation link found in loaded page HTML, and the element its hover card mounts in. */
interface CitationHost {
  host: HTMLElement
  props: Omit<CitationCardProps, "children">
  label: string
}

/**
 * Turns the `CitationCard` links that came in as plain HTML under `root`
 * (reading mode's loaded pages) back into hover cards. Pass a new `version`
 * whenever that HTML is replaced.
 */
export function CitationCardsIn({ root, version }: { root: RefObject<HTMLElement | null>; version: unknown }) {
  const [hosts, setHosts] = useState<CitationHost[]>([])
  // After commit, once the loaded HTML and the root's ref are in place.
  useEffect(() => {
    const container = root.current
    if (!container) {
      setHosts([])
      return
    }
    const found: CitationHost[] = []
    container.querySelectorAll<HTMLAnchorElement>(`a.citation-link[${CITATION_DATA.citation}]`).forEach((link) => {
      const host = link.ownerDocument.createElement("span")
      host.className = "citation-card-host"
      found.push({
        host,
        label: link.textContent ?? "",
        props: {
          href: link.getAttribute("href") ?? "",
          number: link.getAttribute(CITATION_DATA.number) ?? "",
          citation: link.getAttribute(CITATION_DATA.citation) ?? "",
          card: link.getAttribute(CITATION_DATA.card) ?? "",
          spoken: link.getAttribute(CITATION_DATA.spoken) ?? "",
          authors: link.getAttribute(CITATION_DATA.authors) ?? "",
          year: link.getAttribute(CITATION_DATA.year) ?? "",
        },
      })
      link.replaceWith(host)
    })
    setHosts(found)
  }, [root, version])
  return <>{hosts.map(({ host, props, label }, index) => createPortal(<CitationCard {...props}>{label}</CitationCard>, host, String(index)))}</>
}
