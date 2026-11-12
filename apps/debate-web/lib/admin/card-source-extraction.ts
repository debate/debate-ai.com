/**
 * @fileoverview Pulls the original source text behind each parsed debate
 * card — the article, report or paper the card was cut from.
 *
 * For each card the admin run ({@link extractCardSourcesPage}):
 *
 * 1. uses the card's `source_url` (the URL `debate-card-parser` found in its
 *    citation) when it has one, and runs it through QwkSearch's
 *    `GET /api/doc/article` (extract-webpage, server side, cached);
 * 2. otherwise builds a search query from the citation — the quoted article
 *    title and the author's name when the cite has them
 *    ({@link searchQueryForCite}) — runs it through QwkSearch's
 *    `GET /api/agent/search`, and extracts the top results in turn, keeping
 *    the one whose text contains the most of the card's own words
 *    ({@link matchScore}). A result below {@link MIN_SEARCH_MATCH} is not the
 *    card's source, so the card is recorded as `not_found`.
 *
 * The extracted text goes to the CARD_TEXT R2 bucket as
 * `card-sources/<id>.json`; one `debate_card_sources` row per card records
 * the outcome, so a re-run skips cards already handled (only `failed` ones
 * are retried, and only when asked) and the panel can chart its progress
 * ({@link readCardSourceStats}).
 *
 * @module lib/admin/card-source-extraction
 */

import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import { debateCardSources, debateCards } from "@/lib/database/schema";
import { type CardTextBucket, hydrateCardText } from "@/lib/search/card-text-store";

export type CardSourceStatus = "extracted" | "not_found" | "failed";
export type CardSourceVia = "cite" | "search" | "";

/** Idempotent DDL matching `debateCardSources` in lib/database/schema.ts. */
export const CARD_SOURCE_DDL = [
  `CREATE TABLE IF NOT EXISTS "debate_card_sources" (
  "card_id" integer PRIMARY KEY NOT NULL,
  "url" text DEFAULT '' NOT NULL,
  "via" text DEFAULT '' NOT NULL,
  "status" text NOT NULL,
  "title" text,
  "word_count" integer DEFAULT 0 NOT NULL,
  "match_score" real,
  "error" text,
  "extracted_at" integer NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS "idx_debate_card_sources_status" ON "debate_card_sources" ("status")`,
];

/** A search result whose text holds less than this share of the card's words is not its source. */
export const MIN_SEARCH_MATCH = 0.35;
/** Search results extracted per card, best-looking first, before giving up. */
const SEARCH_CANDIDATES = 3;
/** Below this many words an extraction counts as having found nothing. */
const MIN_ARTICLE_WORDS = 40;
const FETCH_TIMEOUT_MS = 20_000;
/** Cards worked on at once within one page. */
const CARD_CONCURRENCY = 3;

const R2_PREFIX = "card-sources";

export function cardSourceKey(id: number): string {
  return `${R2_PREFIX}/${id}.json`;
}

type RawDB = { run(query: ReturnType<typeof sql.raw>): Promise<unknown> };

let ensured: Promise<void> | null = null;

/** Creates the bookkeeping table once per isolate; a failure is forgotten and retried. */
export function ensureCardSourceTable(db: unknown): Promise<void> {
  ensured ??= (async () => {
    for (const statement of CARD_SOURCE_DDL) await (db as RawDB).run(sql.raw(statement));
  })();
  ensured.catch(() => {
    ensured = null;
  });
  return ensured;
}

/** Test-only: forget that the table was already created. */
export function resetEnsuredCardSourceTable(): void {
  ensured = null;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  "that this with from have they their there were which would could should about these those than then them what when where while will been being into more most also only other such over under very just some because after before between through".split(
    " ",
  ),
);

/** Lower-case words of four or more letters, minus common function words. */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'’-]{3,}/g) ?? [])
    .map((word) => word.replace(/['’-]+$/g, ""))
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

/**
 * The share (0–1) of the card's distinct content words that appear in the
 * candidate text. A card cut from a page scores near 1 against it; an
 * unrelated page on the same topic rarely passes half.
 */
export function matchScore(cardText: string, candidateText: string): number {
  const wanted = new Set(contentWords(cardText));
  if (wanted.size === 0) return 0;
  const have = new Set(contentWords(candidateText));
  let found = 0;
  for (const word of wanted) if (have.has(word)) found++;
  return found / wanted.size;
}

const QUOTED = /[“"‘]([^“”"‘’]{12,240})[”"’]/g;
const URLS = /\b(?:https?:\/\/|www\.)\S+/gi;

/**
 * A web search query for a card's citation, or `null` when it names nothing
 * searchable. Debate cites run like `Smith 20 [John Smith, professor at X,
 * "The Article Title," Publisher, 3-4-2020]`: the quoted title plus the
 * author's surname finds the page far more often than the whole cite does,
 * so that is preferred; otherwise the cite's words, minus URLs, dates and
 * brackets, cut to a search-engine-friendly length.
 */
export function searchQueryForCite(cite: string, fullcite = ""): string | null {
  const text = `${fullcite || cite}`.replace(URLS, " ");
  const titles = [...text.matchAll(QUOTED)].map((match) => match[1].replace(/[\s,.;:]+$/, "").trim());
  const title = titles.sort((a, b) => b.length - a.length)[0];
  const author = (cite || fullcite).trim().match(/^([A-Z][A-Za-z'’-]{1,40})/)?.[1];
  if (title) return author && !title.includes(author) ? `"${title}" ${author}` : `"${title}"`;

  const words = text
    .replace(/[[\](){}]/g, " ")
    .replace(/\b\d{1,4}[-/.]\d{1,2}(?:[-/.]\d{1,4})?\b/g, " ")
    .replace(/\b(?:accessed|retrieved|date|last|modified|updated)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
  const query = words.slice(0, 24).join(" ").slice(0, 200).trim();
  return contentWords(query).length >= 2 ? query : null;
}

/** Plain text of extracted HTML, for matching and word counts. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── QwkSearch ─────────────────────────────────────────────────────────────

/** What the run needs from QwkSearch; the route passes the live one, tests a stub. */
export interface QwkSearchClient {
  search(query: string): Promise<Array<{ title?: string; url?: string; content?: string }>>;
  article(url: string): Promise<ExtractedArticle | null>;
}

export interface ExtractedArticle {
  url: string;
  html: string;
  title?: string;
  author?: string;
  date?: string;
  source?: string;
  cite?: string;
}

async function getJson(fetchImpl: typeof fetch, url: string, apiKey?: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`QwkSearch answered HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new Error(`QwkSearch timed out after ${FETCH_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** The QwkSearch API over HTTP: `/api/agent/search` and `/api/doc/article`. */
export function qwkSearchClient(
  origin: string,
  { apiKey, fetchImpl = fetch }: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): QwkSearchClient {
  const base = origin.replace(/\/+$/, "");
  return {
    async search(query) {
      const data = (await getJson(fetchImpl, `${base}/api/agent/search?q=${encodeURIComponent(query)}`, apiKey)) as {
        results?: unknown;
      };
      return Array.isArray(data?.results) ? (data.results as Array<{ title?: string; url?: string; content?: string }>) : [];
    },
    async article(url) {
      const data = (await getJson(fetchImpl, `${base}/api/doc/article?url=${encodeURIComponent(url)}`, apiKey)) as {
        article?: Record<string, unknown>;
      };
      const article = data?.article;
      if (!article || article.error || typeof article.html !== "string") return null;
      return {
        url: str(article.url) ?? url,
        html: article.html,
        title: str(article.title),
        author: str(article.author),
        date: str(article.date),
        source: str(article.source),
        cite: str(article.cite),
      };
    },
  };
}

// ─── One card ──────────────────────────────────────────────────────────────

export interface CardForSource {
  id: number;
  cite: string;
  fullcite: string;
  sourceUrl: string;
  spoken: string;
  fulltext: string;
}

export interface CardSourceResult {
  cardId: number;
  status: CardSourceStatus;
  via: CardSourceVia;
  url: string;
  title?: string;
  wordCount: number;
  matchScore?: number;
  error?: string;
  /** Only for `extracted`: what goes to R2. */
  stored?: ExtractedArticle & { text: string };
}

/** The words a candidate page is matched against: the card's body, else what is read aloud. */
function cardBody(card: CardForSource): string {
  return card.fulltext || card.spoken || "";
}

/**
 * Finds and extracts one card's original source. Never throws: a QwkSearch
 * error is recorded as `failed` so the run moves on (and a later run with
 * "retry failed" tries again).
 */
export async function extractCardSource(card: CardForSource, qwk: QwkSearchClient): Promise<CardSourceResult> {
  const body = cardBody(card);
  const finish = (article: ExtractedArticle, via: CardSourceVia, score: number): CardSourceResult => {
    const text = htmlToText(article.html);
    return {
      cardId: card.id,
      status: "extracted",
      via,
      url: article.url,
      title: article.title,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      matchScore: Math.round(score * 1000) / 1000,
      stored: { ...article, text },
    };
  };
  const readable = (article: ExtractedArticle | null): article is ExtractedArticle =>
    !!article && htmlToText(article.html).split(/\s+/).length >= MIN_ARTICLE_WORDS;

  try {
    if (card.sourceUrl) {
      const article = await qwk.article(card.sourceUrl);
      if (readable(article)) return finish(article, "cite", matchScore(body, htmlToText(article.html)));
      // The cited page is gone or unreadable; fall through to a search.
    }

    const query = searchQueryForCite(card.cite, card.fullcite);
    if (!query) {
      return {
        cardId: card.id,
        status: "not_found",
        via: "",
        url: "",
        wordCount: 0,
        error: card.sourceUrl ? "Cited page had no readable text; the cite has nothing to search for" : "Citation has no URL or searchable text",
      };
    }

    const cueText = `${card.cite} ${card.fullcite} ${card.spoken}`;
    const results = (await qwk.search(query))
      .filter((result) => typeof result.url === "string" && /^https?:\/\//i.test(result.url) && result.url !== card.sourceUrl)
      .map((result, rank) => ({ result, rank, cue: matchScore(`${result.title ?? ""} ${result.content ?? ""}`, cueText) }))
      // Search order first, nudged by how much of the snippet echoes the cite and card.
      .sort((a, b) => b.cue - a.cue + (a.rank - b.rank) * 0.05)
      .slice(0, SEARCH_CANDIDATES);

    let best: { article: ExtractedArticle; score: number } | null = null;
    for (const { result } of results) {
      let article: ExtractedArticle | null = null;
      try {
        article = await qwk.article(result.url!);
      } catch {
        continue; // One unreadable result shouldn't stop the others.
      }
      if (!readable(article)) continue;
      const score = matchScore(body, htmlToText(article.html));
      if (!best || score > best.score) best = { article: { ...article, title: article.title ?? result.title }, score };
      if (score >= 0.8) break;
    }
    if (best && best.score >= MIN_SEARCH_MATCH) return finish(best.article, "search", best.score);
    return {
      cardId: card.id,
      status: "not_found",
      via: "",
      url: best?.article.url ?? "",
      wordCount: 0,
      matchScore: best ? Math.round(best.score * 1000) / 1000 : undefined,
      error: results.length === 0 ? `No search results for ${query}` : `No search result matched the card (searched ${query})`,
    };
  } catch (error) {
    return {
      cardId: card.id,
      status: "failed",
      via: "",
      url: card.sourceUrl,
      wordCount: 0,
      error: (error as Error)?.message ?? String(error),
    };
  }
}

// ─── A page of the run ─────────────────────────────────────────────────────

export interface CardSourceFilter {
  /** Caselist season year, e.g. 2024; 0 or absent for all. */
  year?: number;
  /** Debate format (`debate_cards.event`: "ld", "pf", "cx"…); "" or absent for all. */
  event?: string;
}

export interface CardSourcePageOptions extends CardSourceFilter {
  afterId: number;
  limit: number;
  /** Also redo cards whose last attempt `failed`. */
  retryFailed?: boolean;
  now?: number;
}

export interface CardSourcePage {
  processed: number;
  extracted: number;
  viaCite: number;
  viaSearch: number;
  notFound: number;
  failed: number;
  /** A few of this page's outcomes, for the panel's recent-activity list. */
  results: Array<Omit<CardSourceResult, "stored">>;
  nextAfterId: number;
  done: boolean;
}

function filterConditions(filter: CardSourceFilter): SQL[] {
  const conditions: SQL[] = [];
  if (filter.year) conditions.push(eq(debateCards.year, filter.year));
  if (filter.event) conditions.push(eq(debateCards.event, filter.event));
  return conditions;
}

/** Runs `task` over `items` with at most `limit` in flight. */
async function forEachLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

/**
 * Handles the next page of cards (in id order after `afterId`) that have no
 * `debate_card_sources` row yet — or a `failed` one, with `retryFailed`.
 * The caller loops on `nextAfterId` until `done`; stopping and starting again
 * from 0 is safe, because finished cards are skipped.
 */
export async function extractCardSourcesPage(
  db: any,
  bucket: CardTextBucket,
  qwk: QwkSearchClient,
  options: CardSourcePageOptions,
): Promise<CardSourcePage> {
  await ensureCardSourceTable(db);
  const pending = options.retryFailed
    ? sql`(${debateCardSources.cardId} IS NULL OR ${debateCardSources.status} = 'failed')`
    : sql`${debateCardSources.cardId} IS NULL`;
  const rows: Array<CardForSource & { markup: string }> = await db
    .select({
      id: debateCards.id,
      cite: debateCards.cite,
      fullcite: debateCards.fullcite,
      sourceUrl: debateCards.sourceUrl,
      spoken: debateCards.spoken,
      fulltext: debateCards.fulltext,
      markup: debateCards.markup,
    })
    .from(debateCards)
    .leftJoin(debateCardSources, eq(debateCardSources.cardId, debateCards.id))
    .where(and(gt(debateCards.id, options.afterId), pending, ...filterConditions(options)))
    .orderBy(debateCards.id)
    .limit(options.limit);

  const cards = await hydrateCardText(rows, bucket);
  const results: CardSourceResult[] = [];
  await forEachLimited(cards, CARD_CONCURRENCY, async (card) => {
    const result = await extractCardSource(card, qwk);
    if (result.stored) {
      try {
        await bucket.put(cardSourceKey(card.id), JSON.stringify({ ...result.stored, via: result.via }), {
          httpMetadata: { contentType: "application/json" },
        });
      } catch (error) {
        results.push({ ...result, status: "failed", stored: undefined, error: `Saving to R2 failed: ${(error as Error).message}` });
        return;
      }
    }
    results.push(result);
  });

  await saveCardSourceResults(db, results, options.now);

  const count = (status: CardSourceStatus) => results.filter((result) => result.status === status).length;
  const last = rows[rows.length - 1];
  return {
    processed: rows.length,
    extracted: count("extracted"),
    viaCite: results.filter((result) => result.status === "extracted" && result.via === "cite").length,
    viaSearch: results.filter((result) => result.status === "extracted" && result.via === "search").length,
    notFound: count("not_found"),
    failed: count("failed"),
    results: results
      .sort((a, b) => a.cardId - b.cardId)
      .map(({ stored: _stored, ...rest }) => rest),
    nextAfterId: last ? last.id : options.afterId,
    done: rows.length < options.limit,
  };
}

/** 9 bound values per row — kept under D1's 100-parameter ceiling. */
const ROWS_PER_UPSERT = 10;

export async function saveCardSourceResults(
  db: any,
  results: readonly CardSourceResult[],
  now: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  if (results.length === 0) return;
  await ensureCardSourceTable(db);
  const statements: unknown[] = [];
  for (let start = 0; start < results.length; start += ROWS_PER_UPSERT) {
    const values = results.slice(start, start + ROWS_PER_UPSERT).map((result) => ({
      cardId: result.cardId,
      url: result.url,
      via: result.via,
      status: result.status,
      title: result.title?.slice(0, 500) ?? null,
      wordCount: result.wordCount,
      matchScore: result.matchScore ?? null,
      error: result.error?.slice(0, 500) ?? null,
      extractedAt: now,
    }));
    statements.push(
      db
        .insert(debateCardSources)
        .values(values)
        .onConflictDoUpdate({
          target: debateCardSources.cardId,
          set: {
            url: sql.raw("excluded.url"),
            via: sql.raw("excluded.via"),
            status: sql.raw("excluded.status"),
            title: sql.raw("excluded.title"),
            wordCount: sql.raw("excluded.word_count"),
            matchScore: sql.raw("excluded.match_score"),
            error: sql.raw("excluded.error"),
            extractedAt: sql.raw("excluded.extracted_at"),
          },
        }),
    );
  }
  if (typeof db.batch === "function") await db.batch(statements);
  else for (const statement of statements) await statement;
}

// ─── Progress chart ────────────────────────────────────────────────────────

export interface CardSourceStats {
  total: number;
  withUrl: number;
  extracted: number;
  viaCite: number;
  viaSearch: number;
  notFound: number;
  failed: number;
  /** Every season year and format in the library, for the chart's filters. */
  years: number[];
  events: string[];
}

/**
 * The panel's two progress bars: how many cards (in the chosen year and
 * format) cite a URL, and how many have had their original source extracted.
 */
export async function readCardSourceStats(db: any, filter: CardSourceFilter = {}): Promise<CardSourceStats> {
  await ensureCardSourceTable(db);
  const where = filterConditions(filter);
  const scope = where.length ? and(...where) : undefined;

  const [totals] = await db
    .select({
      total: sql<number>`count(*)`,
      withUrl: sql<number>`sum(case when ${debateCards.sourceUrl} <> '' then 1 else 0 end)`,
    })
    .from(debateCards)
    .where(scope);

  const outcomes: Array<{ status: string; via: string; n: number }> = await db
    .select({ status: debateCardSources.status, via: debateCardSources.via, n: sql<number>`count(*)` })
    .from(debateCardSources)
    .innerJoin(debateCards, eq(debateCards.id, debateCardSources.cardId))
    .where(scope)
    .groupBy(debateCardSources.status, debateCardSources.via);

  const years: Array<{ year: number }> = await db
    .selectDistinct({ year: debateCards.year })
    .from(debateCards)
    .orderBy(sql`${debateCards.year} desc`);
  const events: Array<{ event: string }> = await db
    .selectDistinct({ event: debateCards.event })
    .from(debateCards)
    .orderBy(debateCards.event);

  const sum = (match: (row: { status: string; via: string }) => boolean) =>
    outcomes.filter(match).reduce((total, row) => total + Number(row.n), 0);
  return {
    total: Number(totals?.total ?? 0),
    withUrl: Number(totals?.withUrl ?? 0),
    extracted: sum((row) => row.status === "extracted"),
    viaCite: sum((row) => row.status === "extracted" && row.via === "cite"),
    viaSearch: sum((row) => row.status === "extracted" && row.via === "search"),
    notFound: sum((row) => row.status === "not_found"),
    failed: sum((row) => row.status === "failed"),
    years: years.map((row) => Number(row.year)).filter((year) => year > 0),
    events: events.map((row) => row.event).filter(Boolean),
  };
}
