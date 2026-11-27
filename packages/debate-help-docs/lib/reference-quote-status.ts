/**
 * @file reference-quote-status.ts
 * @description Classifies the quoted card text of a References entry, so each
 * entry can show whether its full text is on the page.
 *
 * An entry's card HTML is `{description, qualification}<hr />{quoted text}`
 * (see `mdx/citation-cards.ts`). Only the quote after the rule counts:
 *
 * - `underlined` — real text with NSDA-style underlining (`<u>`) marking what
 *   is read aloud.
 * - `full` — real text, no underlining.
 * - `ellipses` — the quote holds only gap markers (`...`, `[…]`).
 * - `missing` — no quote at all.
 *
 * Pure string work with no DOM, so it runs in the MDX build (the rehype
 * plugin passes the status to the page) and in the browser (the citation hover
 * card computes it from the card HTML it already has).
 */
import { htmlToText } from './mdx/citation-cards';

export type ReferenceQuoteStatus = 'underlined' | 'full' | 'ellipses' | 'missing';

export const REFERENCE_QUOTE_STATUSES: readonly ReferenceQuoteStatus[] = ['underlined', 'full', 'ellipses', 'missing'];

/** Short label and one-line explanation for each status, used by the icon tooltip and the legend. */
export const REFERENCE_QUOTE_STATUS_INFO: Record<ReferenceQuoteStatus, { label: string; description: string }> = {
  underlined: { label: 'Full text, underlined', description: 'The card text is here, with the underlined parts that are read aloud.' },
  full: { label: 'Full text', description: 'The card text is here, without underlining.' },
  ellipses: { label: 'Only ellipses', description: 'Only “…” gaps so far. Click to suggest the text.' },
  missing: { label: 'Text missing', description: 'No card text yet. Click to suggest it.' },
};

export function isReferenceQuoteStatus(value: unknown): value is ReferenceQuoteStatus {
  return typeof value === 'string' && (REFERENCE_QUOTE_STATUSES as readonly string[]).includes(value);
}

/** Gap markers a card uses in place of omitted text: `...`, `…`, `[…]`, `[...]`, `(...)`. */
const GAP_MARKERS = /\[\s*(?:\.{2,}|…)\s*\]|\(\s*(?:\.{2,}|…)\s*\)|\.{2,}|…/g;

/** The quoted text of a card: everything after its `<hr>`, or `undefined` when it has no rule. */
export function quoteHtml(cardHtml: string | undefined | null): string | undefined {
  if (!cardHtml) return undefined;
  const parts = cardHtml.split(/<hr\b[^>]*>/i);
  return parts.length > 1 ? parts.slice(1).join(' ') : undefined;
}

/** The status of the quote in an entry's card HTML. */
export function referenceQuoteStatus(cardHtml: string | undefined | null): ReferenceQuoteStatus {
  const quote = quoteHtml(cardHtml);
  if (quote === undefined) return 'missing';
  const text = htmlToText(quote);
  const hasGaps = new RegExp(GAP_MARKERS.source).test(text);
  const words = text.replace(GAP_MARKERS, ' ');
  if (!/[\p{L}\p{N}]/u.test(words)) return hasGaps ? 'ellipses' : 'missing';
  return /<u[\s>]/i.test(quote) ? 'underlined' : 'full';
}

/** Statuses a reader can fill in by suggesting text. */
export function canSuggestText(status: ReferenceQuoteStatus): boolean {
  return status === 'missing' || status === 'ellipses';
}
