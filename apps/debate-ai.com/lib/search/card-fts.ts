/**
 * @fileoverview Full-text index over the imported card corpus, built on
 * SQLite's FTS5 (which D1 ships with).
 *
 * The `LIKE` search in `debate-card-search.ts` has no notion of relevance —
 * it returns whichever matching rows the table scan reaches first — and it
 * scans every text column of every card on each keystroke. FTS5 keeps an
 * inverted index with token positions inside the database, so a search can
 * rank by BM25, match quoted phrases exactly, and prefix-match the word being
 * typed, while `fts5vocab` exposes the indexed words for autocomplete.
 *
 * The index is an *external-content* table: it stores tokens only and reads
 * card text back from `debate_cards`, kept in step by three triggers. There is
 * no tracked migration folder for the app (see `ensure-columns.ts`), so the
 * objects are created on first use by {@link ensureCardFts}, the same way
 * missing columns are.
 *
 * Every write to `debate_cards` must go through the triggers: an
 * `INSERT OR REPLACE` that hits an existing row deletes it without firing the
 * delete trigger, which leaves stale tokens behind. The importer upserts with
 * `ON CONFLICT DO UPDATE`, which is safe; after restoring a SQL backup (which
 * uses `INSERT OR REPLACE`), rebuild the index from `/api/admin/search-index`.
 *
 * @module lib/search/card-fts
 */

import { type SQL, and, asc, desc, eq, sql } from "drizzle-orm";
import { type BaseSQLiteDatabase, integer, sqliteTable } from "drizzle-orm/sqlite-core";
import { debateCards, type DebateCardRow } from "@/lib/database/schema";
import { describeError } from "@/lib/database/errors";
import type { CardSearchScope } from "./debate-card-search";

/** The FTS5 table holding the card index. */
export const CARD_FTS_TABLE = "debate_cards_fts";
/** The `fts5vocab` view over {@link CARD_FTS_TABLE}: one row per indexed word. */
export const CARD_VOCAB_TABLE = "debate_cards_vocab";
/** One-row table recording whether the index covers the whole corpus. */
export const CARD_FTS_STATE_TABLE = "debate_cards_fts_state";

/**
 * The indexed `debate_cards` columns, in FTS column order, with their BM25
 * weights. A word in the tag outweighs the same word in the card body: the tag
 * is the claim the card is cut to prove, so it is what a search names.
 *
 * Names must match `debate_cards` exactly — an external-content index reads
 * the text back from the content table by column name.
 */
export const CARD_FTS_COLUMNS = [
  { name: "tag", weight: 8 },
  { name: "summary", weight: 3 },
  { name: "spoken", weight: 4 },
  { name: "fulltext", weight: 1 },
  { name: "cite", weight: 3 },
  { name: "fullcite", weight: 1 },
  { name: "pocket", weight: 2 },
  { name: "hat", weight: 2 },
  { name: "block", weight: 3 },
] as const;

type CardFtsColumn = (typeof CARD_FTS_COLUMNS)[number]["name"];

const COLUMN_LIST = CARD_FTS_COLUMNS.map((column) => column.name).join(", ");
const NEW_VALUES = CARD_FTS_COLUMNS.map((column) => `new.${column.name}`).join(", ");
const OLD_VALUES = CARD_FTS_COLUMNS.map((column) => `old.${column.name}`).join(", ");

/**
 * Corpora up to this size are indexed inline the first time a search needs
 * the index. Past it a single `rebuild` risks D1's per-query time limit, so the
 * index is left for the admin backfill to fill in chunks and searches keep
 * using `LIKE` until it is complete.
 */
export const INLINE_REBUILD_MAX_CARDS = 20_000;

/** Cards indexed per statement by {@link backfillCardFts}. */
export const BACKFILL_CHUNK = 2_000;

/**
 * Statements that create the index, its triggers, the vocabulary view and the
 * state row. Each is idempotent, so re-running them is harmless.
 */
export function cardFtsStatements(): string[] {
  return [
    // detail=full keeps token positions, which phrase queries need.
    // prefix='2 3 4' indexes short prefixes so `"nuc"*` is an index lookup.
    // No stemmer: autocomplete should offer whole words, not stems.
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${CARD_FTS_TABLE} USING fts5(
      ${COLUMN_LIST},
      content='debate_cards',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2',
      detail=full,
      prefix='2 3 4'
    )`,
    `CREATE TRIGGER IF NOT EXISTS debate_cards_fts_ai AFTER INSERT ON debate_cards BEGIN
      INSERT INTO ${CARD_FTS_TABLE}(rowid, ${COLUMN_LIST}) VALUES (new.id, ${NEW_VALUES});
    END`,
    `CREATE TRIGGER IF NOT EXISTS debate_cards_fts_ad AFTER DELETE ON debate_cards BEGIN
      INSERT INTO ${CARD_FTS_TABLE}(${CARD_FTS_TABLE}, rowid, ${COLUMN_LIST}) VALUES ('delete', old.id, ${OLD_VALUES});
    END`,
    // Only an edit to indexed text re-indexes the card: the importer's
    // source-URL backfill rewrites `source_url` across the corpus, and that
    // must not tokenize every card again.
    `CREATE TRIGGER IF NOT EXISTS debate_cards_fts_au AFTER UPDATE OF ${COLUMN_LIST} ON debate_cards BEGIN
      INSERT INTO ${CARD_FTS_TABLE}(${CARD_FTS_TABLE}, rowid, ${COLUMN_LIST}) VALUES ('delete', old.id, ${OLD_VALUES});
      INSERT INTO ${CARD_FTS_TABLE}(rowid, ${COLUMN_LIST}) VALUES (new.id, ${NEW_VALUES});
    END`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${CARD_VOCAB_TABLE} USING fts5vocab(${CARD_FTS_TABLE}, 'row')`,
    `CREATE TABLE IF NOT EXISTS ${CARD_FTS_STATE_TABLE} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      complete INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `INSERT OR IGNORE INTO ${CARD_FTS_STATE_TABLE} (id, complete) VALUES (1, 0)`,
  ];
}

/**
 * The FTS table as a drizzle table, so a query can join it to `debate_cards`.
 * Deliberately not in `schema.ts`: drizzle-kit would try to create it as an
 * ordinary table.
 */
export const debateCardsFts = sqliteTable(CARD_FTS_TABLE, {
  rowid: integer("rowid").notNull(),
});

/** BM25 over the index with the per-column weights above; lower is better. */
export function cardBm25(): SQL {
  return sql.raw(`bm25(${CARD_FTS_TABLE}, ${CARD_FTS_COLUMNS.map((column) => column.weight.toFixed(1)).join(", ")})`);
}

// ── Query building ────────────────────────────────────────────────────────

/** How unquoted words in a query combine. Quoted phrases are always required. */
export type FtsOperator = "AND" | "OR";

/** Quotes text as one FTS string. Bound SQL parameters do not escape FTS syntax. */
export function ftsLiteral(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

const WORD = /[\p{L}\p{N}]+/gu;

export interface FtsMatchOptions {
  /** How unquoted words combine; `OR` ranks by how many match, `AND` requires all. */
  operator?: FtsOperator;
  /**
   * Treat the last unquoted word as a prefix (`"nuc"*`) — the search runs as
   * the user types, and the word under the cursor is usually unfinished.
   * Skipped when the query ends in whitespace or a closing quote.
   */
  prefixLastWord?: boolean;
  /** Restrict the match to these columns; all columns when omitted. */
  columns?: readonly CardFtsColumn[];
}

/**
 * Turns a search-box query into an FTS5 `MATCH` expression.
 *
 * Every word and phrase is quoted, so user input can never be read as FTS
 * syntax (`AND`, `NEAR`, `*`, column filters). `"exact phrase"` in the query
 * must match as a phrase.
 *
 * @returns The expression, or `""` when the query holds no searchable words.
 */
export function buildFtsMatch(query: string, options: FtsMatchOptions = {}): string {
  const operator = options.operator ?? "OR";
  const phrases: string[] = [];

  // An unbalanced trailing quote is a phrase still being typed: treat its
  // words as ordinary words rather than dropping them.
  const unquoted = query.replace(/"([^"]+)"/g, (_match, phrase: string) => {
    const words = phrase.match(WORD);
    if (words) phrases.push(ftsLiteral(words.join(" ")));
    return " ";
  });

  const words = unquoted.match(WORD) ?? [];
  const terms = words.map(ftsLiteral);
  if (terms.length > 0 && options.prefixLastWord && /[\p{L}\p{N}]$/u.test(query)) {
    terms[terms.length - 1] += "*";
  }

  const parts: string[] = [];
  if (terms.length > 0) parts.push(terms.length === 1 ? terms[0] : `(${terms.join(` ${operator} `)})`);
  parts.push(...phrases);
  if (parts.length === 0) return "";

  const expression = parts.join(" AND ");
  if (!options.columns || options.columns.length === 0) return expression;
  return `{${options.columns.join(" ")}} : (${expression})`;
}

/**
 * The index columns a search scope maps to.
 *
 * @returns `undefined` for every column, or `null` when the scope needs a
 *   match the index cannot express — underlined text exists only as `<u>`
 *   tags inside `markup`, which is not indexed — so the caller must fall back
 *   to `LIKE`.
 */
export function ftsColumnsForScope(scope: CardSearchScope): readonly CardFtsColumn[] | undefined | null {
  const scoped =
    scope.searchHighlighted || scope.searchUnderlined || scope.searchSummaries || scope.searchBlockAndFileTitles;
  if (!scoped || scope.searchAllText) return undefined;
  if (scope.searchUnderlined) return null;

  const columns: CardFtsColumn[] = [];
  if (scope.searchHighlighted) columns.push("spoken");
  if (scope.searchSummaries) columns.push("summary");
  if (scope.searchBlockAndFileTitles) columns.push("pocket", "hat", "block");
  return columns;
}

/** Reads the `operator` query parameter; anything but `AND` means `OR`. */
export function readFtsOperator(params: URLSearchParams): FtsOperator {
  return params.get("operator")?.toUpperCase() === "AND" ? "AND" : "OR";
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

type RawDB = {
  all(query: SQL): Promise<unknown>;
  run(query: SQL): Promise<unknown>;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return ((result as { results?: unknown[]; rows?: unknown[] })?.results ??
    (result as { rows?: unknown[] })?.rows ??
    []) as Record<string, unknown>[];
}

async function scalar(db: RawDB, query: string): Promise<number> {
  const [row] = rowsOf(await db.all(sql.raw(query)));
  return row ? Number(Object.values(row)[0]) || 0 : 0;
}

async function setComplete(db: RawDB, complete: boolean): Promise<void> {
  await db.run(
    sql.raw(
      `UPDATE ${CARD_FTS_STATE_TABLE} SET complete = ${complete ? 1 : 0}, updated_at = unixepoch() WHERE id = 1`,
    ),
  );
}

/** Creates the index objects that are missing. Safe to call repeatedly. */
export async function createCardFts(db: unknown): Promise<void> {
  const raw = db as RawDB;
  for (const statement of cardFtsStatements()) await raw.run(sql.raw(statement));
}

/** Re-indexes every card from scratch, in one statement, and marks the index complete. */
export async function rebuildCardFts(db: unknown): Promise<void> {
  const raw = db as RawDB;
  await createCardFts(raw);
  await raw.run(sql.raw(`INSERT INTO ${CARD_FTS_TABLE}(${CARD_FTS_TABLE}) VALUES ('rebuild')`));
  await setComplete(raw, true);
}

/** Merges the index's b-tree segments; worth running after a large import. */
export async function optimizeCardFts(db: unknown): Promise<void> {
  await (db as RawDB).run(sql.raw(`INSERT INTO ${CARD_FTS_TABLE}(${CARD_FTS_TABLE}) VALUES ('optimize')`));
}

export interface CardFtsStatus {
  /** Cards in `debate_cards`. */
  cards: number;
  /** Cards the index holds. */
  indexed: number;
  /** Whether searches use the index. */
  complete: boolean;
}

/** How much of the corpus the index covers. */
export async function cardFtsStatus(db: unknown): Promise<CardFtsStatus> {
  const raw = db as RawDB;
  await createCardFts(raw);
  const [cards, indexed, complete] = await Promise.all([
    scalar(raw, "SELECT count(*) FROM debate_cards"),
    // The docsize shadow table has one row per indexed document; counting the
    // FTS table itself would count the *content* table.
    scalar(raw, `SELECT count(*) FROM ${CARD_FTS_TABLE}_docsize`),
    scalar(raw, `SELECT complete FROM ${CARD_FTS_STATE_TABLE} WHERE id = 1`),
  ]);
  return { cards, indexed, complete: complete === 1 };
}

/**
 * Indexes up to `chunks × BACKFILL_CHUNK` cards the index does not hold yet,
 * and marks the index complete once nothing is left.
 *
 * Unlike `rebuild` this is resumable and bounded, so a corpus too large to
 * index in one statement can be indexed across several admin requests. Cards
 * the triggers already indexed are skipped — indexing a row twice in an
 * external-content table corrupts its entry.
 */
export async function backfillCardFts(db: unknown, chunks = 5): Promise<CardFtsStatus> {
  const raw = db as RawDB;
  await createCardFts(raw);
  for (let chunk = 0; chunk < chunks; chunk++) {
    const before = await scalar(raw, `SELECT count(*) FROM ${CARD_FTS_TABLE}_docsize`);
    await raw.run(
      sql.raw(
        `INSERT INTO ${CARD_FTS_TABLE}(rowid, ${COLUMN_LIST})
         SELECT id, ${COLUMN_LIST} FROM debate_cards
         WHERE id NOT IN (SELECT id FROM ${CARD_FTS_TABLE}_docsize)
         ORDER BY id LIMIT ${BACKFILL_CHUNK}`,
      ),
    );
    const after = await scalar(raw, `SELECT count(*) FROM ${CARD_FTS_TABLE}_docsize`);
    if (after - before < BACKFILL_CHUNK) break;
  }
  const status = await cardFtsStatus(raw);
  if (!status.complete && status.indexed >= status.cards) {
    await setComplete(raw, true);
    return { ...status, complete: true };
  }
  return status;
}

/** Per-isolate memo of {@link ensureCardFts}: the promise, and when an incomplete answer expires. */
let ensured: { ready: Promise<boolean>; expires: number } | undefined;

/** How long an isolate trusts an "index incomplete" answer before asking again. */
const INCOMPLETE_RECHECK_MS = 60_000;

/**
 * Makes sure the card index exists, and says whether searches can use it.
 *
 * The first call on a database creates the index; while it is incomplete, a
 * corpus small enough is indexed there and then, and a larger one waits for
 * the admin backfill. Any
 * failure — an engine without FTS5, a timeout — answers `false`, and the
 * caller falls back to `LIKE` rather than failing the search.
 *
 * Memoized per isolate: a ready index is never checked again, an incomplete
 * one is re-checked at most once a minute.
 */
export function ensureCardFts(db: unknown, now = Date.now()): Promise<boolean> {
  if (ensured && ensured.expires > now) return ensured.ready;

  const ready = (async () => {
    const raw = db as RawDB;
    try {
      const exists = await scalar(raw, `SELECT count(*) FROM sqlite_master WHERE name = '${CARD_FTS_STATE_TABLE}'`);
      if (!exists) await createCardFts(raw);
      const complete = await scalar(raw, `SELECT complete FROM ${CARD_FTS_STATE_TABLE} WHERE id = 1`);
      if (complete === 1) return true;

      const cards = await scalar(raw, "SELECT count(*) FROM debate_cards");
      if (cards > INLINE_REBUILD_MAX_CARDS) return false;
      await rebuildCardFts(raw);
      return true;
    } catch (error) {
      console.error("Card search index unavailable:", describeError(error));
      return false;
    }
  })();

  ensured = { ready, expires: Number.POSITIVE_INFINITY };
  void ready.then((ok) => {
    if (!ok && ensured?.ready === ready) ensured.expires = now + INCOMPLETE_RECHECK_MS;
  });
  return ready;
}

/** Test-only: forget what this isolate learned about the index. */
export function resetCardFtsMemo(): void {
  ensured = undefined;
}

// ── Autocomplete ──────────────────────────────────────────────────────────

/**
 * Words too common to be worth suggesting. They stay in the index — phrase
 * search needs every word — and are only kept out of the dropdown.
 */
const AUTOCOMPLETE_STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "are", "was", "but", "not", "you",
  "his", "her", "its", "has", "have", "had", "they", "their", "from", "which",
  "will", "would", "can", "could", "been", "were", "there", "than", "then",
  "into", "also", "more", "such", "these", "those", "what", "when", "who",
  "our", "out", "all", "any", "one", "may", "about",
]);

/** Shortest prefix the vocabulary is searched for; shorter ones match too many words to rank cheaply. */
export const AUTOCOMPLETE_MIN_PREFIX = 2;

/** Lowercases and strips diacritics the way the `unicode61 remove_diacritics 2` tokenizer does, for Latin text. */
export function normalizePrefix(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export interface AutocompleteSuggestion {
  /** The indexed word. */
  word: string;
  /** The whole query with its last word replaced by `word`. */
  completion: string;
  /** Times the word occurs across the corpus. */
  occurrences: number;
  /** Cards the word occurs in. */
  documentCount: number;
}

/**
 * Completes the last word of a query from the indexed vocabulary, most
 * frequent first.
 *
 * Frequencies are of words in the cards, not of past searches. Queries that
 * end in whitespace, or whose last word is shorter than
 * {@link AUTOCOMPLETE_MIN_PREFIX}, get no suggestions.
 */
export async function autocompleteCardTerms(db: unknown, input: string, limit: number): Promise<AutocompleteSuggestion[]> {
  const match = /([\p{L}\p{N}]+)$/u.exec(input);
  if (!match) return [];
  const prefix = normalizePrefix(match[1]);
  if (prefix.length < AUTOCOMPLETE_MIN_PREFIX) return [];
  const before = input.slice(0, match.index);
  const numeric = /^\d+$/.test(prefix);

  // Over-fetch so dropping stopwords and the prefix itself still fills `limit`.
  const rows = rowsOf(
    await (db as RawDB).all(sql`
      SELECT term, doc, cnt FROM ${sql.raw(CARD_VOCAB_TABLE)}
      WHERE term >= ${prefix} AND term < ${`${prefix}\u{10FFFF}`} AND length(term) > 1
      ORDER BY cnt DESC, doc DESC, term ASC
      LIMIT ${limit + AUTOCOMPLETE_STOPWORDS.size}
    `),
  );

  return rows
    .map((row) => ({ term: String(row.term), doc: Number(row.doc) || 0, cnt: Number(row.cnt) || 0 }))
    // Bare numbers (years, page counts) crowd out words unless a number is what is being typed.
    .filter((row) => !AUTOCOMPLETE_STOPWORDS.has(row.term) && (numeric || !/^\d+$/.test(row.term)))
    .slice(0, limit)
    .map((row) => ({
      word: row.term,
      completion: before + row.term,
      occurrences: row.cnt,
      documentCount: row.doc,
    }));
}

// ── Ranked search ─────────────────────────────────────────────────────────

/**
 * Cards matching an FTS expression, best BM25 match first.
 *
 * Ties — common when a one-word query matches many cards equally — go to the
 * card read in more rounds, then the lower id so pages are stable.
 *
 * @param match - An expression from {@link buildFtsMatch}.
 * @param where - The non-text filters (season, school, event…), if any.
 * @param orderBy - An explicit sort ("Most read") to apply instead of BM25.
 */
export async function searchCardsRanked(
  db: BaseSQLiteDatabase<"async", any, any>,
  match: string,
  where: SQL | undefined,
  limit: number,
  orderBy: SQL[] = [],
): Promise<DebateCardRow[]> {
  const rows = await db
    .select({ card: debateCards })
    .from(debateCardsFts)
    .innerJoin(debateCards, eq(debateCards.id, debateCardsFts.rowid))
    .where(and(sql`${sql.raw(CARD_FTS_TABLE)} MATCH ${match}`, where))
    .orderBy(...(orderBy.length > 0 ? orderBy : [cardBm25(), desc(debateCards.duplicateCount), asc(debateCards.id)]))
    .limit(limit);
  return rows.map((row) => row.card);
}
