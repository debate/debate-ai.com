/**
 * @fileoverview Finds and reads the article behind one bibliography entry, for
 * the "Reading mode" button on the docs' References side panel
 * (`GET /api/reference-article`).
 *
 * 1. **The entry's own link.** When the entry has a URL, and it passes the
 *    SSRF gate (`isSafeArticleUrl`: public http(s) pages only), QwkSearch's
 *    `GET /api/doc/article` extracts it server side (extract-webpage: web
 *    pages, PDFs, YouTube; cached on QwkSearch's side). That page is the
 *    article, whatever it says: it is what the entry cites.
 * 2. **Search.** With no link, or when the link is unsafe, unreachable or has
 *    no readable text, the entry's title, author, publication and year go to
 *    QwkSearch's quick search (`GET /api/agent/search`). The best-ranked hits
 *    (`rankSearchResults`) are extracted and each is checked against the
 *    entry (`verifyArticle`): only a page whose title and text agree with the
 *    entry is returned. Anything weaker is `not_found`, with the unconfirmed
 *    hits listed as links so the reader can judge for themselves.
 *
 * The whole run has a time budget; each QwkSearch call is given what is left
 * of it. Pure over a `QwkSearchClient`, so tests drive it with a stub.
 *
 * @module lib/reference-article/resolve
 */

import {
  isSafeArticleUrl,
  rankSearchResults,
  referenceSearchQueries,
  verifyArticle,
  contentWords,
  type ReferenceArticle,
  type ReferenceArticleResponse,
  type ReferenceCandidate,
  type ReferenceDescription,
  type UrlFailure,
} from "@debate-ai/reading-mode/references";
import type { ExtractedArticle, QwkSearchClient } from "@/lib/qwksearch/api-client";

/** Longest each field of a request may be. */
export const MAX_FIELD_LENGTH = { url: 2048, title: 300, authors: 150, publication: 200, citation: 800, year: 8 } as const;

/** Total time one request may spend, across every QwkSearch call. */
export const RESOLVE_BUDGET_MS = 40_000;
const URL_TIMEOUT_MS = 20_000;
const SEARCH_TIMEOUT_MS = 10_000;
const EXTRACT_TIMEOUT_MS = 15_000;
/** Below this, there is no time left for another call. */
const MIN_CALL_MS = 2_500;

/** The entry's own link is read if it holds at least this many words. */
const MIN_URL_WORDS = 20;
/** A search hit must hold this many words to be a candidate article. */
const MIN_SEARCH_WORDS = 40;
/** Search hits extracted per query, best-ranked first. */
const EXTRACT_PER_QUERY = 3;
/** Unconfirmed hits listed with a `not_found`. */
const MAX_CANDIDATES = 5;

export type ReferenceArticleResult = ReferenceArticleResponse | { status: "error"; error: string; urlFailed?: UrlFailure };

export type ParsedReferenceQuery = ReferenceDescription;

export type ParseResult = { ok: true; value: ParsedReferenceQuery } | { ok: false; error: string };

function field(params: URLSearchParams, key: keyof typeof MAX_FIELD_LENGTH): string | { tooLong: true } {
  const value = (params.get(key) ?? "")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return value.length > MAX_FIELD_LENGTH[key] ? { tooLong: true } : value;
}

/** Checks a request's query string; returns the entry it describes or the first problem. */
export function parseReferenceArticleQuery(params: URLSearchParams): ParseResult {
  const values = {} as Record<keyof typeof MAX_FIELD_LENGTH, string>;
  for (const key of Object.keys(MAX_FIELD_LENGTH) as Array<keyof typeof MAX_FIELD_LENGTH>) {
    const value = field(params, key);
    if (typeof value !== "string") return { ok: false, error: `${key} is too long.` };
    values[key] = value;
  }
  if (values.year && !/^\d{4}$/.test(values.year)) values.year = "";
  if (!values.url && !values.title && contentWords(values.citation).length === 0) {
    return { ok: false, error: "Send the reference's url, title or citation." };
  }
  return { ok: true, value: { ...values } };
}

const wordsOf = (html: string) => html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").match(/\S+/g)?.length ?? 0;

function textOf(html: string): string {
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

function toArticle(extracted: ExtractedArticle, fallbackTitle?: string): ReferenceArticle {
  return {
    html: extracted.html,
    title: extracted.title ?? fallbackTitle,
    author: extracted.author,
    date: extracted.date,
    source: extracted.source,
    wordCount: wordsOf(extracted.html),
  };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface ResolveOptions {
  budgetMs?: number;
  now?: () => number;
}

/** Finds the article for an entry (see the module doc). Never throws. */
export async function resolveReferenceArticle(
  ref: ParsedReferenceQuery,
  qwk: QwkSearchClient,
  { budgetMs = RESOLVE_BUDGET_MS, now = Date.now }: ResolveOptions = {},
): Promise<ReferenceArticleResult> {
  const deadline = now() + budgetMs;
  const remaining = () => deadline - now();
  const timeout = (cap: number) => Math.min(cap, remaining());

  let urlFailed: UrlFailure | undefined;
  let attempts = 0;
  let failures = 0;
  let lastError = "";

  if (ref.url) {
    const safe = isSafeArticleUrl(ref.url);
    if (!safe.ok) {
      urlFailed = { url: ref.url, reason: safe.reason };
    } else {
      attempts++;
      try {
        const extracted = await qwk.article(safe.url, { timeoutMs: timeout(URL_TIMEOUT_MS) });
        if (extracted && wordsOf(extracted.html) >= MIN_URL_WORDS) {
          return { status: "found", via: "url", url: extracted.url || safe.url, article: toArticle(extracted) };
        }
        urlFailed = { url: safe.url, reason: "No readable text was found at this address." };
      } catch (error) {
        failures++;
        lastError = message(error);
        urlFailed = { url: safe.url, reason: lastError };
      }
    }
  }

  const queries = referenceSearchQueries(ref);
  const candidates: ReferenceCandidate[] = [];
  const listed = new Set<string>();
  const failedUrl = urlFailed?.url;

  for (const query of queries) {
    if (remaining() < MIN_CALL_MS) break;
    attempts++;
    let hits;
    try {
      hits = await qwk.search(query, { timeoutMs: timeout(SEARCH_TIMEOUT_MS) });
    } catch (error) {
      failures++;
      lastError = message(error);
      continue;
    }
    const ranked = rankSearchResults(hits, ref).filter((hit) => hit.url !== failedUrl);
    for (const hit of ranked.slice(0, MAX_CANDIDATES)) {
      if (listed.has(hit.url) || candidates.length >= MAX_CANDIDATES) continue;
      listed.add(hit.url);
      candidates.push({ title: hit.title?.trim() || hit.url, url: hit.url });
    }
    if (remaining() < MIN_CALL_MS) break;

    const top = ranked.slice(0, EXTRACT_PER_QUERY);
    const settled = await Promise.allSettled(
      top.map((hit) => qwk.article(hit.url, { timeoutMs: timeout(EXTRACT_TIMEOUT_MS) })),
    );
    attempts += top.length;

    let best: { extracted: ExtractedArticle; title?: string; score: number; order: number } | null = null;
    settled.forEach((outcome, order) => {
      const hit = top[order]!;
      if (outcome.status === "rejected") {
        failures++;
        lastError = message(outcome.reason);
        return;
      }
      const extracted = outcome.value;
      if (!extracted || wordsOf(extracted.html) < MIN_SEARCH_WORDS) return;
      const verdict = verifyArticle(
        { title: extracted.title ?? hit.title, author: extracted.author, text: textOf(extracted.html) },
        ref,
      );
      if (!verdict.accepted) return;
      if (!best || verdict.score > best.score) best = { extracted, title: hit.title, score: verdict.score, order };
    });
    if (best) {
      const { extracted, title, score } = best as { extracted: ExtractedArticle; title?: string; score: number };
      return {
        status: "found",
        via: "search",
        url: extracted.url,
        query,
        confidence: score,
        ...(urlFailed ? { urlFailed } : {}),
        article: toArticle(extracted, title),
      };
    }
  }

  if (attempts > 0 && failures === attempts) {
    return {
      status: "error",
      error: `The article service did not answer${lastError ? ` (${lastError})` : ""}.`,
      ...(urlFailed ? { urlFailed } : {}),
    };
  }
  return { status: "not_found", queries, ...(urlFailed ? { urlFailed } : {}), candidates };
}
