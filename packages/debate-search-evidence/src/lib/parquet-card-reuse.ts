/**
 * @fileoverview Connects the Parquet card corpus to the on-page card reuse
 * check.
 *
 * The reuse check answers "has this page already been cut?" from the
 * `evidence_reuse_index` table, which the library's own cards register into
 * one at a time. The corpus imported from Parquet shards is far larger and
 * never did, so a page cut thousands of times in the caselist still came back
 * "safe to cut". Every imported card is now run through `debate-card-parser`
 * to find the URL its citation names, and that URL is registered under a
 * `card:<id>` entry — the same index, so the check needs no second lookup.
 *
 * The same parse, run again at lookup time over the stored row, gives the
 * extension each match's author, year and highlighted quotes.
 *
 * Kept free of I/O so the ingest endpoint, the backfill route and the tests
 * share exactly one mapping.
 *
 * @module lib/parquet-card-reuse
 */

import { parseCardRecord, type ParsedCardRecord } from "debate-card-parser";

import type { DebateCardRecord } from "./parquet-card-import";
import { normalizeSourceUrl } from "./shared-evidence-library";

/** Prefix that marks a reuse-index entry as registered from the card corpus. */
export const PARQUET_CARD_REUSE_ID_PREFIX = "card:";

/** Longest value stored in a reuse-index text column, matching the reuse route's POST cap. */
const MAX_REUSE_FIELD_CHARS = 500;

/** Quotes returned per match — enough to recognize the card in a 320px popup. */
export const MAX_REUSE_CARD_QUOTES = 6;

/** One `evidence_reuse_index` row, as the ingest endpoint writes it. */
export interface ParquetCardReuseEntry {
  id: string;
  sourceUrl: string;
  normalizedUrl: string;
  cite: string;
  argBlock: string;
  topic: string;
  contributorId: string;
}

/** The card columns the reuse mapping reads. */
export type ParquetCardReuseInput = Pick<
  DebateCardRecord,
  "id" | "tag" | "cite" | "fullcite" | "caselistDisplayName"
>;

/** The reuse-index id for a corpus card. */
export function parquetCardReuseId(cardId: number): string {
  return `${PARQUET_CARD_REUSE_ID_PREFIX}${cardId}`;
}

/**
 * The corpus card id behind a reuse-index id.
 *
 * @returns The card id, or `null` for an entry that did not come from the corpus.
 */
export function parseParquetCardReuseId(id: string): number | null {
  if (!id.startsWith(PARQUET_CARD_REUSE_ID_PREFIX)) return null;
  const cardId = Number(id.slice(PARQUET_CARD_REUSE_ID_PREFIX.length));
  return Number.isSafeInteger(cardId) && cardId > 0 ? cardId : null;
}

/**
 * Maps a corpus card onto the reuse-index row that makes its source page
 * show up as already cut.
 *
 * @param card - The card's id, tag and cite columns.
 * @returns The row to upsert, or `null` when the citation names no URL.
 */
export function buildParquetCardReuseEntry(card: ParquetCardReuseInput): ParquetCardReuseEntry | null {
  const { sourceUrl } = parseCardRecord({ cite: card.cite, fullcite: card.fullcite });
  if (!sourceUrl) return null;
  const normalizedUrl = normalizeSourceUrl(sourceUrl);
  if (!normalizedUrl) return null;
  return {
    id: parquetCardReuseId(card.id),
    sourceUrl: sourceUrl.slice(0, 2_000),
    normalizedUrl,
    cite: card.cite.slice(0, MAX_REUSE_FIELD_CHARS),
    // The popup titles a match with `argBlock`; for a corpus card the tag is
    // the claim the card was cut for, which is what a debater recognizes.
    argBlock: card.tag.slice(0, MAX_REUSE_FIELD_CHARS),
    topic: card.caselistDisplayName.slice(0, MAX_REUSE_FIELD_CHARS),
    contributorId: "",
  };
}

/** What the reuse check returns about a corpus card that matched the page. */
export interface ReuseCardDetails {
  cardId: number;
  tag: string;
  cite: string;
  fullcite: string;
  author: string | null;
  year: ParsedCardRecord["year"];
  /** Highlighted runs, capped at {@link MAX_REUSE_CARD_QUOTES}. */
  quotes: string[];
  caselist: string;
  event: string;
  level: string;
  side: string;
  /** How many times the dump saw this card across caselists. */
  duplicateCount: number;
}

/**
 * Parses a stored corpus card into the details the reuse check shows.
 *
 * @param card - The stored row's text and label columns.
 * @returns Parsed author, year and quotes alongside the row's labels.
 */
export function buildReuseCardDetails(
  card: Pick<
    DebateCardRecord,
    | "id"
    | "tag"
    | "cite"
    | "fullcite"
    | "markup"
    | "spoken"
    | "caselistDisplayName"
    | "event"
    | "level"
    | "side"
    | "duplicateCount"
  >,
): ReuseCardDetails {
  const parsed = parseCardRecord(card);
  return {
    cardId: card.id,
    tag: card.tag,
    cite: card.cite,
    fullcite: card.fullcite,
    author: parsed.author,
    year: parsed.year,
    quotes: parsed.quotes.slice(0, MAX_REUSE_CARD_QUOTES),
    caselist: card.caselistDisplayName,
    event: card.event,
    level: card.level,
    side: card.side,
    duplicateCount: card.duplicateCount,
  };
}
