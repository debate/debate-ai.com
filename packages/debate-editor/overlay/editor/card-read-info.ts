/**
 * What read mode needs to know about each card, parsed once per card node.
 *
 *  - `hasHighlight` — whether any body text of the card (card_body
 *    paragraphs and table-cell paragraphs) is highlighted. Read mode shows
 *    a highlighted card's highlighting only; a card with none falls back
 *    to its underlined (underline / emphasis) text.
 *  - the cite's first author's last name and year — parsed from the cite
 *    paragraph by a short-cite regex ("Smith 21", "Smith & Jones '19",
 *    "Smith et al., 2019"), then by `debate-card-parser`'s
 *    `extractCiteInfo` (extract-cite's name heuristics, the same ones the
 *    card importer uses). Read mode shows them in bold as one short label
 *    ("Smith 21") in place of the cite's text — only when BOTH parsed; a
 *    cite missing either is shown whole instead.
 *
 * ProseMirror nodes are immutable, so both results are cached per node in
 * a WeakMap: an edit replaces the card node and the next lookup re-parses.
 */
import type { Node as PMNode } from 'prosemirror-model';
import type { CardYear } from '@debate-ai/card-parser/src/types/types';
import { extractCiteInfo } from '@debate-ai/card-parser/src/extractors/citation-extractor';

/** Body-text facts about a card. `hasShading` is reported separately so
 *  "Read mode: show background color" can count it as highlighting at
 *  decoration time without invalidating the cache. */
export interface CardHighlightInfo {
  hasHighlight: boolean;
  hasShading: boolean;
}

export interface CiteAuthorYear {
  /** The first author's last name — "Smith" for "Smith & Jones" — or null if none was found. */
  lastName: string | null;
  /** The year, or "ND" when the cite says "no date", or null if none was found. */
  year: CardYear | null;
}

const highlightCache = new WeakMap<PMNode, CardHighlightInfo>();
const citeCache = new WeakMap<PMNode, CiteAuthorYear>();

/** Whether the card's body (not its tag, cite or undertags) carries
 *  highlight / background-color marks anywhere. */
export function cardHighlightInfo(card: PMNode): CardHighlightInfo {
  const cached = highlightCache.get(card);
  if (cached) return cached;
  const info: CardHighlightInfo = { hasHighlight: false, hasShading: false };
  const scan = (para: PMNode): void => {
    para.forEach((child) => {
      if (!child.isText || !child.text?.trim()) return;
      for (const m of child.marks) {
        if (m.type.name === 'highlight') info.hasHighlight = true;
        else if (m.type.name === 'shading') info.hasShading = true;
      }
    });
  };
  card.forEach((child) => {
    if (child.type.name === 'card_body') scan(child);
    else if (child.type.name === 'table') {
      child.descendants((d) => {
        if (d.type.name !== 'paragraph') return true;
        scan(d);
        return false;
      });
    }
  });
  highlightCache.set(card, info);
  return info;
}

/** A parsed "author" longer than this is a phrase, not a name. */
const MAX_AUTHOR_WORDS = 4;

/** A name word: capitalised, letters plus apostrophes / hyphens. */
const NAME = String.raw`\p{Lu}[\p{L}'’\x60-]+`;
/** "Smith 21", "Smith '21", "Smith, 2021", "Smith & Jones 21",
 *  "Smith and Jones '21", "Smith et al. 2021" — at the start of the cite. */
const SHORT_CITE_RE = new RegExp(
  String.raw`^(${NAME})(?:\s+et\s+al\.?|\s*(?:&|\band\b)\s*${NAME})?\s*,?\s*['’]?(\d{4}|\d{2})(?!\d)`,
  'u',
);

/** Two-digit years pivot like the card importer: 00–30 → 2000s. */
function expandYear(digits: string): number {
  const n = Number.parseInt(digits, 10);
  if (digits.length === 4) return n;
  return n <= 30 ? 2000 + n : 1900 + n;
}

/** Just the first author's last name: "Smith & Jones", "Smith and
 *  Jones", "Smith, Jones" and "Smith et al." all become "Smith". */
export function firstAuthorLastName(author: string): string | null {
  const first = author
    .split(/\s*(?:&|,|;|\band\b|\bet\s+al\b)\s*/u)[0]!
    .replace(/[.\s]+$/u, '')
    .trim();
  if (!first || first.split(/\s+/).length > MAX_AUTHOR_WORDS) return null;
  return first;
}

/** The cite paragraph's first author's last name and year. The
 *  cite-styled (cite_mark) runs are the short cite ("Smith 21") read
 *  first; a cite with none is parsed from its whole text. */
export function citeAuthorYear(cite: PMNode): CiteAuthorYear {
  const cached = citeCache.get(cite);
  if (cached) return cached;
  let full = '';
  let bold = '';
  cite.forEach((child) => {
    if (!child.isText || !child.text) return;
    full += child.text;
    if (child.marks.some((m) => m.type.name === 'cite_mark')) bold += child.text;
  });
  full = full.replace(/\s+/g, ' ').trim();
  bold = bold.replace(/\s+/g, ' ').trim();
  const result: CiteAuthorYear = { lastName: null, year: null };
  const short = SHORT_CITE_RE.exec(bold) ?? SHORT_CITE_RE.exec(full);
  if (short) {
    result.lastName = short[1]!;
    result.year = expandYear(short[2]!);
  } else if (full) {
    const info = extractCiteInfo(full, bold || full);
    result.lastName = firstAuthorLastName(info.author?.trim() ?? '');
    if (info.year !== null && info.year !== undefined) result.year = info.year;
  }
  citeCache.set(cite, result);
  return result;
}

/** "Smith 21", "Smith ND", just "Smith" (no year found) or just "21" (no
 *  author found); null when the cite yields neither. */
export function formatCiteLabel({ lastName, year }: CiteAuthorYear): string | null {
  let yearText: string | null = null;
  if (typeof year === 'number' && Number.isFinite(year)) {
    yearText = String(Math.abs(Math.trunc(year)) % 100).padStart(2, '0');
  } else if (year === 'ND') {
    yearText = 'ND';
  }
  const label = [lastName, yearText].filter(Boolean).join(' ');
  return label || null;
}

/** The read-mode label for a cite paragraph — "Smith 21" — or null
 *  unless both the author's last name and a numeric year parsed (read
 *  mode then shows the whole cite line instead). */
export function citeReadLabel(cite: PMNode): string | null {
  const info = citeAuthorYear(cite);
  if (!info.lastName || typeof info.year !== 'number' || !Number.isFinite(info.year)) return null;
  return formatCiteLabel(info);
}
