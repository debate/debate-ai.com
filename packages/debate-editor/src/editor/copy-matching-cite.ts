/**
 * Copy All Cards With Matching Cite (2026-09-19).
 *
 * From a cite paragraph, gather every card in the document that shares
 * it. The selection decides the match:
 *   - a cursor inside a cite, or a selection covering the whole cite
 *     (a whole card selected, say): every card whose cite EQUALS this
 *     one;
 *   - a selection of part of a cite — the cite mark, the title, the
 *     URL, the journal: every card whose cite CONTAINS that text;
 *   - a selection that runs past the cite into other content: only the
 *     part inside the (first) cite paragraph counts;
 *   - no cite paragraph touched at all: nothing (the command no-ops).
 * Comparison folds curly quotes, dashes and ellipses the way Find does
 * (`normalizeForMatch`), collapses whitespace and ignores case, so a
 * cite pasted twice with a smart quote in one copy still matches.
 *
 * The cards come back in document order with their numbering cleared
 * (`numRole` none, no restart), so the paste carries no numbers. Cards
 * inside a live view are its source's mirrors and are skipped — the
 * source card itself matches; cards inside a linked copy are real
 * content here and count. An analytic unit with a cite paragraph counts
 * as a card. The clipboard write lives in the editor host.
 */
import type { Node as PMNode } from 'prosemirror-model';
import type { Selection } from 'prosemirror-state';
import { normalizeForMatch } from './word-break.js';

export interface CiteMatchQuery {
  /** The normalized text to match. */
  needle: string;
  /** True: a card's cite must equal the needle; false: contain it. */
  whole: boolean;
}

const CARD_TYPES = new Set(['card', 'analytic_unit']);

/** Fold, collapse whitespace, lowercase — one comparable form for both
 *  the selection and every cite in the document. */
export function normalizeCiteText(text: string): string {
  return normalizeForMatch(text).text.replace(/\s+/g, ' ').trim().toLowerCase();
}

const citeText = (cite: PMNode): string => cite.textBetween(0, cite.content.size, '', ' ');

/** The match the selection asks for, or null when it touches no cite. */
export function citeQueryFromSelection(doc: PMNode, selection: Selection): CiteMatchQuery | null {
  const { from, to, $from } = selection;
  if (from === to) {
    if ($from.parent.type.name !== 'cite_paragraph') return null;
    return { needle: normalizeCiteText(citeText($from.parent)), whole: true };
  }
  // The first cite paragraph the selection reaches, and the slice of it
  // that is selected.
  let hit: { node: PMNode; start: number } | null = null;
  doc.nodesBetween(from, to, (node, pos) => {
    if (hit) return false;
    if (node.type.name === 'cite_paragraph') {
      hit = { node, start: pos + 1 };
      return false;
    }
    return true;
  });
  if (!hit) return null;
  const { node, start } = hit as { node: PMNode; start: number };
  const end = start + node.content.size;
  const a = Math.max(from, start);
  const b = Math.min(to, end);
  const wholeCite = a <= start && b >= end;
  const part = wholeCite ? citeText(node) : doc.textBetween(a, b, '', ' ');
  const needle = normalizeCiteText(part);
  // Nothing selectable inside the cite (whitespace only): treat as the whole cite.
  if (!needle) return { needle: normalizeCiteText(citeText(node)), whole: true };
  return { needle, whole: wholeCite };
}

function citeMatches(container: PMNode, query: CiteMatchQuery): boolean {
  for (let i = 0; i < container.childCount; i++) {
    const child = container.child(i);
    if (child.type.name !== 'cite_paragraph') continue;
    const hay = normalizeCiteText(citeText(child));
    if (query.whole ? hay === query.needle : hay.includes(query.needle)) return true;
  }
  return false;
}

/** Every card (or analytic unit) whose cite matches, in document order,
 *  with its numbering cleared. */
export function cardsWithMatchingCite(doc: PMNode, query: CiteMatchQuery): PMNode[] {
  const out: PMNode[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'self_ref') return false; // mirrors of cards found elsewhere
    if (!CARD_TYPES.has(node.type.name)) return true;
    if (citeMatches(node, query)) out.push(stripNumbering(node));
    return false; // a card holds no cards
  });
  return out;
}

/** The card without its numbering role, so a paste carries no number. */
export function stripNumbering(card: PMNode): PMNode {
  if (card.attrs['numRole'] === 'none' && card.attrs['numRestart'] === false) return card;
  return card.type.create({ ...card.attrs, numRole: 'none', numRestart: false }, card.content, card.marks);
}

/** The whole operation from a selection: the cards to copy and the query
 *  they matched, or null when the selection asks for nothing. */
export function collectCardsWithMatchingCite(doc: PMNode, selection: Selection): { cards: PMNode[]; query: CiteMatchQuery } | null {
  const query = citeQueryFromSelection(doc, selection);
  if (!query) return null;
  return { cards: cardsWithMatchingCite(doc, query), query };
}
