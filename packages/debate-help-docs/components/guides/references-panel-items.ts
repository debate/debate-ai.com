/**
 * @file references-panel-items.ts
 * @description What the References side panel (`references-panel.tsx`)
 * lists: every source cited on the page, in the order it is first cited,
 * with each place it is cited and the paragraph that introduces it.
 *
 * The sources come from the citation links themselves, which carry their
 * References entry as `data-citation-*` attributes (`CITATION_DATA` in
 * `citation-card.tsx`), so the panel shows exactly what the hover cards
 * show, on the page and in reading mode alike. Links inside a hover card
 * tooltip or inside the panel are not part of the page and are skipped.
 */

/** The link attributes holding a citation's entry (kept in step with `CITATION_DATA` in `citation-card.tsx`). */
const DATA = {
  number: "data-citation-number",
  citation: "data-citation",
  card: "data-citation-card",
  spoken: "data-citation-spoken",
  authors: "data-citation-authors",
  year: "data-citation-year",
} as const

/** Marks the panel, whose own content is never collected. */
export const REFERENCES_PANEL_ATTRIBUTE = "data-references-panel"

/** Not page text: hover card tooltips and the panel itself. */
const SKIP_SELECTOR = `.citation-tooltip, [${REFERENCES_PANEL_ATTRIBUTE}]`

/** The block a citation sits in, read before its card. */
const PARAGRAPH_SELECTOR = "p, li, blockquote, td, dd"

/** One source cited on the page. */
export interface ReferenceItem {
  /** The References page anchor, e.g. `…/references#ref-shanahan-1993`; also the item's identity. */
  href: string
  /** The entry's number in the References list. */
  number: string
  /** The bibliography line, as HTML. */
  citation: string
  /** Qualification and card text, as HTML; empty when the entry has no card. */
  card: string
  /** What the voice says for the cite, `Shanahan 93`. */
  spoken: string
  /** The authors, `Galloway` or `Hansson & Reijven` (from the in-text label when the entry has none). */
  authors: string
  /** The publication year as cited, `2020`. */
  year: string
  /** The in-text label of the first citation, `Shanahan (1993)`. */
  label: string
  /** Every link citing it, in page order. */
  links: HTMLAnchorElement[]
  /** The paragraph that first cites it. */
  paragraph: Element | null
}

/** Spaces collapsed, ends trimmed. */
function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

/** `Galloway (2020)` or `Alinsky 1971, 66` → `Galloway` / `Alinsky`. */
function authorsFromLabel(label: string): string {
  return label.replace(/^\(?(?:cf\.|see|e\.g\.,?)\s+/i, "").replace(/['’]s\b/, "").split(/\s*\(|,?\s+(?:\[\d{4}\]\s*|\d{4}\/)?\d{4}|,?\s+n\.d\./)[0]?.trim() ?? ""
}

/** The sources cited under `root`, in order of first citation (see the module doc). */
export function collectReferenceItems(root: ParentNode): ReferenceItem[] {
  const items = new Map<string, ReferenceItem>()
  root.querySelectorAll<HTMLAnchorElement>(`a.citation-link[${DATA.citation}]`).forEach((link) => {
    if (link.closest(SKIP_SELECTOR)) return
    const href = link.getAttribute("href") ?? ""
    const key = href || link.getAttribute(DATA.citation) || ""
    const existing = items.get(key)
    if (existing) {
      existing.links.push(link)
      return
    }
    items.set(key, {
      href,
      number: link.getAttribute(DATA.number) ?? "",
      citation: link.getAttribute(DATA.citation) ?? "",
      card: link.getAttribute(DATA.card) ?? "",
      spoken: link.getAttribute(DATA.spoken) ?? "",
      authors: link.getAttribute(DATA.authors) || authorsFromLabel(tidy(link.textContent ?? "")),
      year: link.getAttribute(DATA.year) ?? "",
      label: tidy(link.textContent ?? ""),
      links: [link],
      paragraph: link.closest(PARAGRAPH_SELECTOR),
    })
  })
  return Array.from(items.values())
}

/** Never read as part of an introducing paragraph: figures and anything marked to skip. */
const INTRO_SKIP_SELECTOR = 'figure, figcaption, img, svg, script, style, [aria-hidden="true"], [data-voice-skip]'

/** The readable text of an introducing paragraph. */
export function paragraphText(paragraph: Element | null): string {
  if (!paragraph) return ""
  const walker = paragraph.ownerDocument.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  const parts: string[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(INTRO_SKIP_SELECTOR)) continue
    parts.push(node.nodeValue ?? "")
  }
  return tidy(parts.join(""))
}

/**
 * What "Read all" reads for each item: its introducing paragraph, then the
 * card. A paragraph citing several sources is read once, before the first.
 */
export function readAllCards(items: ReferenceItem[]): { intro?: string; spoken: string; card: string }[] {
  let lastParagraph: Element | null = null
  return items.map((item) => {
    const intro = item.paragraph && item.paragraph !== lastParagraph ? paragraphText(item.paragraph) : ""
    if (item.paragraph) lastParagraph = item.paragraph
    return { ...(intro ? { intro } : {}), spoken: item.spoken, card: item.card }
  })
}
