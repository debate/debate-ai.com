/**
 * Quick Cards search matcher.
 *
 * Block-Search-style ranking (see `reference-docs/SPEC-quick-cards.md`
 * §7): order-independent multi-token substring AND-matching, scoped by
 * the active-tags filter, with two tiers — cards whose NAME matches
 * come first, then cards that match only on CONTENT (with a small
 * snippet of the matched region). Not edit-distance fuzz.
 */

import type { QuickCard } from './quick-cards-store.js';

export interface QuickCardSearchResult {
  card: QuickCard;
  /** True when the query matched the card's name; false = content-only
   *  match (in which case `snippet` shows the matched region). */
  matchedName: boolean;
  /** Content-match preview around the first matched token (lowercased,
   *  from the card's denormalized text key); null for name matches. */
  snippet: string | null;
}

/** Chars of context on each side of a content match (~40 total). */
const SNIPPET_RADIUS = 18;

/** Whether a card is in scope for the active-tags filter: empty filter
 *  = everything; otherwise a card needs ≥1 active tag — and untagged
 *  cards are ALWAYS in scope. `activeTagsLower` holds normalized tags. */
export function isInScope(card: QuickCard, activeTagsLower: ReadonlySet<string>): boolean {
  if (activeTagsLower.size === 0) return true;
  if (card.tagsLower.length === 0) return true;
  return card.tagsLower.some((t) => activeTagsLower.has(t));
}

export function searchQuickCards(
  cards: readonly QuickCard[],
  query: string,
  activeTagsLower: ReadonlySet<string>,
): QuickCardSearchResult[] {
  const scoped = cards.filter((c) => isInScope(c, activeTagsLower));
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Empty query → browse the whole in-scope library, newest first.
  if (tokens.length === 0) {
    return [...scoped]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((card) => ({ card, matchedName: true, snippet: null }));
  }

  const nameMatches: QuickCard[] = [];
  const contentMatches: QuickCard[] = [];
  for (const c of scoped) {
    if (tokens.every((t) => c.nameLower.includes(t))) nameMatches.push(c);
    else if (tokens.every((t) => c.textLower.includes(t))) contentMatches.push(c);
  }

  const t0 = tokens[0]!;
  // Name tier: earliest first-token position wins (prefix matches
  // float up), then most-recently-updated.
  nameMatches.sort((a, b) => {
    const d = a.nameLower.indexOf(t0) - b.nameLower.indexOf(t0);
    return d !== 0 ? d : b.updatedAt - a.updatedAt;
  });
  contentMatches.sort((a, b) => b.updatedAt - a.updatedAt);

  return [
    ...nameMatches.map((card) => ({ card, matchedName: true, snippet: null as string | null })),
    ...contentMatches.map((card) => ({
      card,
      matchedName: false,
      snippet: makeSnippet(card.textLower, t0),
    })),
  ];
}

function makeSnippet(textLower: string, token: string): string {
  const i = textLower.indexOf(token);
  if (i < 0) return '';
  const start = Math.max(0, i - SNIPPET_RADIUS);
  const end = Math.min(textLower.length, i + token.length + SNIPPET_RADIUS);
  let s = textLower.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) s = '…' + s;
  if (end < textLower.length) s = s + '…';
  return s;
}
