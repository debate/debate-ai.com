/**
 * @fileoverview Parses one already-cut card record — the tag/cite/markup
 * columns of the Parquet card dump — into the citation and quote fields the
 * rest of the product reads: the source URL the card was cut from, the
 * author and year, and the highlighted and underlined text.
 *
 * `htmlToCards` finds these while walking a whole Verbatim document; a dump
 * row has already been split into columns, so this runs the same extractors
 * over those columns directly instead of re-assembling a document.
 */
import { decodeXmlEntities } from "../parsers/docx-import";
import type { AuthorType, CardYear } from "../types/types";
import { cleanUrl, extractCiteInfo } from "./citation-extractor";

/** The card columns this parser reads; every one is optional. */
export interface CardRecordInput {
  /** Short cite, the bolded "Smith 23" part. */
  cite?: string | null;
  /** Full citation with author credentials and, usually, the source URL. */
  fullcite?: string | null;
  /** Card HTML with `<mark>`/`<u>` highlighting intact. */
  markup?: string | null;
  /** Highlighted text as read aloud, used when `markup` carries no `<mark>`. */
  spoken?: string | null;
}

/** What {@link parseCardRecord} recovered from one card. */
export interface ParsedCardRecord {
  /** First http(s) URL in the citation, trailing punctuation removed. */
  sourceUrl: string | null;
  author: string | null;
  authorType: AuthorType;
  year: CardYear;
  /** Each highlighted (`<mark>`) run, in card order. */
  quotes: string[];
  /** Each underlined (`<u>`) run, in card order. */
  underlined: string[];
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'\]]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<>"'\]]*/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Finds the source URL in a citation.
 *
 * Cites carry the URL anywhere in the bracketed credentials, often followed
 * by "accessed …" or closing punctuation, and old files drop the scheme
 * ("www.example.com/x"), which is given back `https://` so it parses as a URL.
 *
 * @param citation - Citation text or HTML.
 * @returns The URL, or `null` when the citation names none.
 */
export function extractSourceUrl(citation: string | null | undefined): string | null {
  if (!citation) return null;
  const text = decodeXmlEntities(stripTags(citation));
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  const url = cleanUrl(match[0]);
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function extractRuns(html: string, tag: string): string[] {
  const runs: string[] = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = collapse(decodeXmlEntities(stripTags(match[1])));
    if (text) runs.push(text);
  }
  return runs;
}

/**
 * Parses one card record into its citation and quote fields.
 *
 * Never throws: a card with no cite, no markup, or HTML the extractors cannot
 * read comes back with `null`s and empty lists rather than failing an import
 * of millions of rows.
 *
 * @param card - The card's cite and text columns.
 * @returns Source URL, author, year, and highlighted/underlined runs.
 */
export function parseCardRecord(card: CardRecordInput): ParsedCardRecord {
  const cite = collapse(decodeXmlEntities(stripTags(card.cite ?? "")));
  const fullcite = collapse(decodeXmlEntities(stripTags(card.fullcite ?? "")));
  const markup = card.markup ?? "";

  const citeInfo = fullcite || cite ? extractCiteInfo(fullcite || cite, cite || fullcite) : null;

  let quotes = extractRuns(markup, "mark");
  if (quotes.length === 0 && card.spoken) {
    const spoken = collapse(card.spoken);
    if (spoken) quotes = [spoken];
  }

  return {
    sourceUrl: extractSourceUrl(card.fullcite) ?? extractSourceUrl(card.cite),
    author: citeInfo?.author ?? null,
    authorType: citeInfo?.author_type ?? null,
    year: citeInfo?.year ?? null,
    quotes,
    underlined: extractRuns(markup, "u"),
  };
}
