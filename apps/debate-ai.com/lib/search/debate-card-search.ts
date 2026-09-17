/**
 * @fileoverview Query building and row mapping for the public card search.
 *
 * Split out of the `/api/search` route so the SQL it issues can be exercised
 * against a real database in tests. It has to be: the route previously matched
 * text with drizzle's `ilike`, which compiles to Postgres' `ILIKE` operator.
 * The card corpus lives in D1/SQLite, which has no such operator, so every
 * search with a term in it threw and was swallowed by the route's catch —
 * typing anything into the search box emptied the results list.
 *
 * SQLite's `LIKE` is already case-insensitive for ASCII, so plain `LIKE` is
 * the portable equivalent.
 *
 * @module lib/search/debate-card-search
 */

import { type SQL, and, or, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { debateCards } from "@/lib/database/schema";

/**
 * Escapes the wildcards `LIKE` would otherwise interpret in user input.
 *
 * Without this, a search for `100%` matches every card in the corpus and `_`
 * matches any character, neither of which is what was typed.
 *
 * @param value - Raw text from the search box or a filter field.
 * @returns The text with `\`, `%` and `_` escaped for use with `ESCAPE '\'`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Case-insensitive "column contains this text" condition.
 *
 * @param column - The column to match against.
 * @param value - Text to look for anywhere in the column.
 * @returns A SQLite-compatible `LIKE` condition.
 */
export function contains(column: SQLiteColumn, value: string): SQL {
  return sql`${column} LIKE ${`%${escapeLikePattern(value)}%`} ESCAPE '\\'`;
}

/**
 * Matches text that falls somewhere inside a pair of markup tags.
 *
 * A coarse approximation — `LIKE` cannot pair an opening tag with its own
 * closing one — but it is the only handle the stored markup gives on
 * underlined text, which has no projection of its own the way highlighted
 * text has `spoken`.
 *
 * @param column - The markup column to match against.
 * @param value - Text to look for between the tags.
 * @param tag - Tag name, e.g. `"u"`.
 * @returns A SQLite-compatible `LIKE` condition.
 */
export function containsWithinTag(column: SQLiteColumn, value: string, tag: string): SQL {
  const pattern = `%<${tag}>%${escapeLikePattern(value)}%</${tag}>%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

/** Which projections of a card a query should be matched against. */
export interface CardSearchScope {
  /** Match only text the card highlights for reading. */
  searchHighlighted?: boolean;
  /** Match only text the card underlines. */
  searchUnderlined?: boolean;
  /** Match only the card's summary line. */
  searchSummaries?: boolean;
  /** Match only the outline path: pocket, hat and block titles. */
  searchBlockAndFileTitles?: boolean;
  /** Match every indexed field — the default when no scope is chosen. */
  searchAllText?: boolean;
}

/** Everything the search endpoint filters a card list by. */
export interface CardSearchInput extends CardSearchScope {
  /** Raw search term; blank means "no text constraint". */
  query?: string;
  /** Season year, as either `"2024"` or `"24"`. */
  year?: string;
  /** School name fragment. */
  school?: string;
  /** Debater name fragment; unsupported by the current schema. */
  team?: string;
  /** Tournament name fragment. */
  tournament?: string;
  /** Debate format, where `"all"` means no constraint. */
  event?: string;
}

/**
 * Builds the text-matching half of a card search.
 *
 * @param query - Trimmed, non-empty search term.
 * @param scope - Which projections of a card to match against.
 * @returns A condition matching any in-scope field, or `undefined` when the
 *   chosen scope has nothing to match against.
 */
function buildTextCondition(query: string, scope: CardSearchScope): SQL | undefined {
  const scoped =
    scope.searchHighlighted ||
    scope.searchUnderlined ||
    scope.searchSummaries ||
    scope.searchBlockAndFileTitles;

  if (!scoped || scope.searchAllText) {
    return or(
      contains(debateCards.summary, query),
      contains(debateCards.fulltext, query),
      contains(debateCards.tag, query),
      contains(debateCards.pocket, query),
      contains(debateCards.hat, query),
      contains(debateCards.block, query),
      contains(debateCards.cite, query),
      contains(debateCards.fullcite, query),
      contains(debateCards.markup, query),
    );
  }

  const conditions: SQL[] = [];
  // `spoken` is the dump's highlighted-text projection, so a highlight-scoped
  // search is an ordinary match against it rather than a guess at where the
  // <mark> tags fall around the term in `markup`.
  if (scope.searchHighlighted) conditions.push(contains(debateCards.spoken, query));
  if (scope.searchUnderlined) conditions.push(containsWithinTag(debateCards.markup, query, "u"));
  if (scope.searchSummaries) conditions.push(contains(debateCards.summary, query));
  if (scope.searchBlockAndFileTitles) {
    conditions.push(contains(debateCards.pocket, query));
    conditions.push(contains(debateCards.hat, query));
    conditions.push(contains(debateCards.block, query));
  }
  return conditions.length > 0 ? or(...conditions) : undefined;
}

/**
 * Builds the `where` clause for a card search.
 *
 * @param input - Search term, scope and filters from the request.
 * @returns The combined condition, or `undefined` when nothing constrains the
 *   query and the whole corpus should be returned.
 */
export function buildCardSearchWhere(input: CardSearchInput): SQL | undefined {
  const conditions: SQL[] = [];

  const query = (input.query ?? "").trim();
  if (query) {
    const textCondition = buildTextCondition(query, input);
    if (textCondition) conditions.push(textCondition);
  }

  const year = (input.year ?? "").trim();
  if (year) {
    // The dump stores the season as two digits on some shards and four on
    // others, so either form of the filter has to match either form of the
    // stored value.
    const digits = year.replace(/\D/g, "");
    const forms = new Set([year, digits]);
    if (digits.length === 2) forms.add(`20${digits}`);
    if (digits.length === 4) forms.add(digits.slice(2));
    conditions.push(
      or(...[...forms].map((form) => sql`CAST(${debateCards.year} AS TEXT) = ${form}`)) as SQL,
    );
  }

  const school = (input.school ?? "").trim();
  if (school) conditions.push(contains(debateCards.caselistDisplayName, school));

  // The corpus has no per-debater column, so a name filter can only be honest
  // about matching nothing.
  if ((input.team ?? "").trim()) conditions.push(sql`1 = 0`);

  const tournament = (input.tournament ?? "").trim();
  if (tournament) conditions.push(contains(debateCards.caselistDisplayName, tournament));

  const event = (input.event ?? "").trim();
  if (event && event !== "all") {
    conditions.push(sql`LOWER(${debateCards.event}) = LOWER(${event})`);
  }

  if (conditions.length === 0) return undefined;
  return and(...conditions) as SQL;
}

/** Search-scope flags, read off a request's query string. */
export function readSearchScope(params: URLSearchParams): CardSearchScope {
  return {
    searchHighlighted: params.get("searchHighlighted") === "1",
    searchUnderlined: params.get("searchUnderlined") === "1",
    searchSummaries: params.get("searchSummaries") === "1",
    searchBlockAndFileTitles: params.get("searchBlockAndFileTitles") === "1",
    searchAllText: params.get("searchAllText") === "1",
  };
}

/** Maps the three outline levels a pocket/hat/block triple represents. */
const CATEGORY_MAP: Record<string, string> = {
  DA: "DA",
  CP: "CP",
  K: "K",
  I: "I",
  T: "T",
  AFF: "I",
  NEG: "DA",
};

/**
 * Projects a stored card row into the shape the search UI renders.
 *
 * @param card - A `debate_cards` row.
 * @returns The search result the `/cards` interface expects.
 */
export function mapDebateCardToSearchResult(card: any): any {
  const pocket = card.pocket || "";
  const hat = card.hat || "";
  const block = card.block || "";
  const argBlock = [pocket, hat, block].filter(Boolean).join(" > ") || card.tag || "Untitled";

  const fulltext = card.fulltext || "";
  const markup = card.markup || "";
  const html = markup || fulltext || "";

  const wordCount = card.textLength > 0 ? Math.round(card.textLength / 5) : 0;
  const highlightLength = (markup.match(/<mark>/gi) || []).length * 50;

  const citeShort = card.cite
    ? card.cite.split(".")[0]?.substring(0, 80) || card.cite.substring(0, 80)
    : "";

  const caselist = card.caselistDisplayName || "";
  const school = caselist || "Unknown";
  const tournament = caselist || "Unknown";

  const category = pocket ? CATEGORY_MAP[pocket.toUpperCase()] || "DA" : "DA";

  return {
    id: card.id,
    category,
    researchField: pocket || "General",
    argBlock,
    summary: card.summary || card.spoken || fulltext.substring(0, 200) || "",
    cite_short: citeShort,
    cite: card.cite || card.fullcite || "",
    readCount: 0,
    highlightLength,
    textLength: card.textLength || 0,
    word_count: wordCount,
    html,
    tag: card.tag || "",
    year: String(card.year || ""),
    page: "",
    school,
    team: "",
    side: card.side || "",
    tournament,
    round: "",
    event: card.event || "CX",
  };
}

/**
 * Sorts mapped results by the UI's `field:direction` sort expression.
 *
 * `_text_match` has no score to sort by in a `LIKE` search, so it leaves the
 * database order alone.
 *
 * @param results - Mapped search results, sorted in place.
 * @param sortBy - Sort expression such as `"year:desc"`.
 * @returns The same array, for chaining.
 */
export function sortSearchResults(results: any[], sortBy: string): any[] {
  const [field, order] = sortBy.split(":");
  const readers: Record<string, (result: any) => number> = {
    readCount: (result) => Number(result.readCount) || 0,
    year: (result) => Number.parseInt(result.year) || 0,
    highlightLength: (result) => Number(result.highlightLength) || 0,
  };

  const read = readers[field];
  if (!read) return results;
  return results.sort((a, b) => (order === "asc" ? read(a) - read(b) : read(b) - read(a)));
}
